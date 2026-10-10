package ecs

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"fmt"
	"strconv"
	"strings"
	"sync"
	"time"
)

type Store struct {
	mu              sync.RWMutex
	clusters        map[string]*ECSCluster
	services        map[string]map[string]*ECSService // clusterName -> serviceName -> Service
	tasks           map[string]map[string]*ECSTask    // clusterName -> taskArn -> Task
	taskDefinitions map[string]*TaskDefinitionFamily  // family -> Family
	taskToService   map[string]string                 // taskArn -> serviceArn
	docker          DockerRunner
}

func NewStore(docker ...DockerRunner) *Store {
	var dr DockerRunner
	if len(docker) > 0 && docker[0] != nil {
		dr = docker[0]
	} else {
		dr = NewDockerClient("")
	}

	return &Store{
		clusters:        make(map[string]*ECSCluster),
		services:        make(map[string]map[string]*ECSService),
		tasks:           make(map[string]map[string]*ECSTask),
		taskDefinitions: make(map[string]*TaskDefinitionFamily),
		taskToService:   make(map[string]string),
		docker:          dr,
	}
}

func generateRandomHex(n int) string {
	bytes := make([]byte, n)
	if _, err := rand.Read(bytes); err != nil {
		return "abcdef123456"
	}
	return hex.EncodeToString(bytes)
}

// -------------------------------------------------------------------------
// Helper: Resolve Task Definition
// -------------------------------------------------------------------------

func (s *Store) resolveTaskDefinition(taskDefRef string) (*TaskDefinition, error) {
	cleanRef := strings.TrimSpace(taskDefRef)
	if cleanRef == "" {
		return nil, errors.New("task definition is required")
	}

	// If ARN, extract family and revision
	if strings.HasPrefix(cleanRef, "arn:aws:ecs:") {
		parts := strings.Split(cleanRef, "/")
		if len(parts) > 1 {
			cleanRef = parts[len(parts)-1]
		}
	}

	parts := strings.Split(cleanRef, ":")
	family := parts[0]
	var revision int
	if len(parts) > 1 {
		revision, _ = strconv.Atoi(parts[1])
	}

	fam, exists := s.taskDefinitions[family]
	if !exists || len(fam.Revisions) == 0 {
		return nil, fmt.Errorf("task definition family %q not found", family)
	}

	if revision == 0 {
		// Use latest revision
		for i := len(fam.Revisions) - 1; i >= 0; i-- {
			if fam.Revisions[i].Revision == fam.LatestRevision {
				return &fam.Revisions[i], nil
			}
		}
		return &fam.Revisions[len(fam.Revisions)-1], nil
	}

	for _, r := range fam.Revisions {
		if r.Revision == revision {
			return &r, nil
		}
	}

	return nil, fmt.Errorf("task definition %q revision %d not found", family, revision)
}

// -------------------------------------------------------------------------
// Helper: Container Launch & Stop Orchestration
// -------------------------------------------------------------------------

func (s *Store) launchTaskContainer(ctx context.Context, clusterName string, taskDef *TaskDefinition, overrides *TaskOverrides, serviceName string) (*ECSTask, error) {
	taskHex := generateRandomHex(16)
	taskArn := fmt.Sprintf("arn:aws:ecs:us-east-1:000000000000:task/%s/%s", clusterName, taskHex)

	cpuStr := taskDef.CPU
	if cpuStr == "" {
		cpuStr = "256"
	}
	memStr := taskDef.Memory
	if memStr == "" {
		memStr = "512"
	}

	cpuUnits, _ := strconv.ParseInt(cpuStr, 10, 64)
	memMB, _ := strconv.ParseInt(memStr, 10, 64)

	image := taskDef.Container.Image
	if image == "" {
		image = "nginx:alpine"
	}

	containerName := taskDef.Container.Name
	if containerName == "" {
		containerName = taskDef.Family
	}

	// Environment variables map to allow overrides
	envMap := make(map[string]string)
	for _, env := range taskDef.Container.Environment {
		envMap[env.Name] = env.Value
	}

	// Apply overrides if provided
	if overrides != nil {
		for _, co := range overrides.ContainerOverrides {
			if co.Name == "" || co.Name == containerName || co.Name == taskDef.Family {
				for _, ovEnv := range co.Environment {
					envMap[ovEnv.Name] = ovEnv.Value
				}
				if co.CPU > 0 {
					cpuUnits = int64(co.CPU)
					cpuStr = strconv.Itoa(co.CPU)
				}
				if co.Memory > 0 {
					memMB = int64(co.Memory)
					memStr = strconv.Itoa(co.Memory)
				}
			}
		}
	}

	// Build environment list
	envList := make([]string, 0, len(envMap)+4)
	for k, v := range envMap {
		envList = append(envList, fmt.Sprintf("%s=%s", k, v))
	}
	envList = append(envList,
		fmt.Sprintf("AWS_EXECUTION_ENV=AWS_ECS_FARGATE"),
		fmt.Sprintf("ECS_CONTAINER_METADATA_URI_V4=http://169.254.170.2/v4"),
		fmt.Sprintf("MINISTACK_CLUSTER=%s", clusterName),
		fmt.Sprintf("MINISTACK_TASK_ARN=%s", taskArn),
	)

	dockerContainerName := fmt.Sprintf("ecs-%s-%s-%s", clusterName, containerName, taskHex[:8])

	createConfig := ContainerCreateConfig{
		Image: image,
		Env:   envList,
		Labels: map[string]string{
			"ministack.cluster": clusterName,
			"ministack.taskArn": taskArn,
			"ministack.family":  taskDef.Family,
			"ministack.service": serviceName,
		},
		CPU:          cpuUnits,
		Memory:       memMB,
		PortMappings: taskDef.Container.PortMappings,
	}

	containerID, err := s.docker.CreateContainer(ctx, dockerContainerName, createConfig)
	if err != nil {
		return nil, fmt.Errorf("failed to create container for task: %w", err)
	}

	if err := s.docker.StartContainer(ctx, containerID); err != nil {
		// Clean up created container on start failure
		_ = s.docker.RemoveContainer(ctx, containerID, true)
		return nil, fmt.Errorf("failed to start container for task: %w", err)
	}

	var hostPortMappings []HostPortMapping
	dockerStatus := "RUNNING"
	if s.docker.IsSimulated() {
		dockerStatus = "SIMULATED"
	}

	inspect, err := s.docker.InspectContainer(ctx, containerID)
	if err == nil && inspect != nil {
		for portKey, bindings := range inspect.NetworkSettings.Ports {
			var containerPort int
			var protocol string
			if _, parseErr := fmt.Sscanf(portKey, "%d/%s", &containerPort, &protocol); parseErr == nil {
				for _, b := range bindings {
					var hostPort int
					if _, portErr := fmt.Sscanf(b.HostPort, "%d", &hostPort); portErr == nil {
						hostIP := b.HostIP
						if hostIP == "" || hostIP == "0.0.0.0" {
							hostIP = "localhost"
						}
						hostPortMappings = append(hostPortMappings, HostPortMapping{
							ContainerPort: containerPort,
							HostPort:      hostPort,
							Protocol:      protocol,
							HostIP:        hostIP,
						})
					}
				}
			}
		}
		if inspect.State.Running {
			if !s.docker.IsSimulated() {
				dockerStatus = "RUNNING"
			}
		} else if inspect.State.Status != "" {
			dockerStatus = strings.ToUpper(inspect.State.Status)
		}
	}

	now := time.Now()
	task := &ECSTask{
		TaskArn:           taskArn,
		TaskDefinitionArn: taskDef.TaskDefinitionArn,
		ClusterArn:        fmt.Sprintf("arn:aws:ecs:us-east-1:000000000000:cluster/%s", clusterName),
		LastStatus:        "RUNNING",
		DesiredStatus:     "RUNNING",
		LaunchType:        "FARGATE",
		CPU:               cpuStr,
		Memory:            memStr,
		StartedAt:         &now,
		ContainerID:       containerID,
		DockerStatus:      dockerStatus,
		HostPortMappings:  hostPortMappings,
		Overrides:         overrides,
		Containers: []ECSTaskContainer{
			{
				Name:  containerName,
				Image: image,
			},
		},
	}

	return task, nil
}

func (s *Store) stopAndRemoveTaskContainer(ctx context.Context, task *ECSTask) {
	if task == nil {
		return
	}

	if task.ContainerID != "" {
		_ = s.docker.StopContainer(ctx, task.ContainerID, 5)
		_ = s.docker.RemoveContainer(ctx, task.ContainerID, true)
		task.DockerStatus = "EXITED"
	}

	now := time.Now()
	task.StoppedAt = &now
	task.LastStatus = "STOPPED"
	task.DesiredStatus = "STOPPED"
}

// -------------------------------------------------------------------------
// Cluster Operations
// -------------------------------------------------------------------------

func (s *Store) ListClusters() []ECSCluster {
	s.mu.RLock()
	defer s.mu.RUnlock()

	result := make([]ECSCluster, 0, len(s.clusters))
	for _, c := range s.clusters {
		running := 0
		pending := 0
		for _, t := range s.tasks[c.ClusterName] {
			if t.LastStatus == "RUNNING" {
				running++
			} else if t.LastStatus == "PENDING" || t.LastStatus == "PROVISIONING" {
				pending++
			}
		}

		c.RunningTasksCount = running
		c.PendingTasksCount = pending
		c.ActiveServicesCount = len(s.services[c.ClusterName])

		result = append(result, *c)
	}
	return result
}

func (s *Store) CreateCluster(req CreateClusterRequest) (*ECSCluster, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	name := strings.TrimSpace(req.Name)
	if name == "" {
		return nil, errors.New("cluster name cannot be empty")
	}

	if _, exists := s.clusters[name]; exists {
		return nil, fmt.Errorf("cluster %s already exists", name)
	}

	capacityProviders := req.CapacityProviders
	if len(capacityProviders) == 0 {
		capacityProviders = []string{"FARGATE", "FARGATE_SPOT"}
	}

	cluster := &ECSCluster{
		ClusterArn:        fmt.Sprintf("arn:aws:ecs:us-east-1:000000000000:cluster/%s", name),
		ClusterName:       name,
		Status:            "ACTIVE",
		CapacityProviders: capacityProviders,
		CreatedAt:         time.Now(),
	}

	s.clusters[name] = cluster
	s.services[name] = make(map[string]*ECSService)
	s.tasks[name] = make(map[string]*ECSTask)

	return cluster, nil
}

func (s *Store) DeleteCluster(name string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if _, exists := s.clusters[name]; !exists {
		return fmt.Errorf("cluster %s not found", name)
	}

	ctx := context.Background()

	// Stop all containers in this cluster
	for _, task := range s.tasks[name] {
		s.stopAndRemoveTaskContainer(ctx, task)
		delete(s.taskToService, task.TaskArn)
	}

	delete(s.clusters, name)
	delete(s.services, name)
	delete(s.tasks, name)

	return nil
}

// -------------------------------------------------------------------------
// Task Definition Operations
// -------------------------------------------------------------------------

func (s *Store) ListTaskDefinitions() []TaskDefinitionFamily {
	s.mu.RLock()
	defer s.mu.RUnlock()

	result := make([]TaskDefinitionFamily, 0, len(s.taskDefinitions))
	for _, f := range s.taskDefinitions {
		result = append(result, *f)
	}
	return result
}

func (s *Store) RegisterTaskDefinition(req RegisterTaskDefinitionRequest) (*TaskDefinition, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	family := strings.TrimSpace(req.Family)
	if family == "" {
		return nil, errors.New("family is required")
	}

	if req.Container.Image == "" {
		return nil, errors.New("container image is required")
	}
	if req.Container.Name == "" {
		req.Container.Name = family
	}

	fam, exists := s.taskDefinitions[family]
	if !exists {
		fam = &TaskDefinitionFamily{
			Family:    family,
			Revisions: []TaskDefinition{},
		}
		s.taskDefinitions[family] = fam
	}

	revision := len(fam.Revisions) + 1
	arn := fmt.Sprintf("arn:aws:ecs:us-east-1:000000000000:task-definition/%s:%d", family, revision)

	taskDef := TaskDefinition{
		TaskDefinitionArn:       arn,
		Family:                  family,
		Revision:                revision,
		Status:                  "ACTIVE",
		NetworkMode:             req.NetworkMode,
		CPU:                     req.CPU,
		Memory:                  req.Memory,
		RequiresCompatibilities: []string{"FARGATE"},
		RegisteredAt:            time.Now(),
		Container:               req.Container,
	}

	fam.Revisions = append(fam.Revisions, taskDef)
	fam.LatestRevision = revision
	fam.LatestRegisteredAt = taskDef.RegisteredAt

	activeCount := 0
	for _, r := range fam.Revisions {
		if r.Status == "ACTIVE" {
			activeCount++
		}
	}
	fam.ActiveRevisionCount = activeCount

	return &taskDef, nil
}

func (s *Store) DeregisterTaskDefinition(family string, revision int) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	fam, exists := s.taskDefinitions[family]
	if !exists {
		return fmt.Errorf("task definition family %s not found", family)
	}

	found := false
	for i, r := range fam.Revisions {
		if r.Revision == revision {
			if r.Status == "INACTIVE" {
				return fmt.Errorf("task definition %s:%d is already INACTIVE", family, revision)
			}
			fam.Revisions[i].Status = "INACTIVE"
			found = true
			break
		}
	}

	if !found {
		return fmt.Errorf("task definition %s:%d not found", family, revision)
	}

	activeCount := 0
	for _, r := range fam.Revisions {
		if r.Status == "ACTIVE" {
			activeCount++
		}
	}
	fam.ActiveRevisionCount = activeCount

	return nil
}

// -------------------------------------------------------------------------
// Service Operations
// -------------------------------------------------------------------------

func (s *Store) ListServices(clusterName string) ([]ECSService, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	if _, exists := s.clusters[clusterName]; !exists {
		return nil, fmt.Errorf("cluster %s not found", clusterName)
	}

	clusterServices := s.services[clusterName]
	result := make([]ECSService, 0, len(clusterServices))
	for _, svc := range clusterServices {
		running := 0
		pending := 0
		for taskArn, t := range s.tasks[clusterName] {
			if s.taskToService[taskArn] == svc.ServiceArn {
				if t.LastStatus == "RUNNING" {
					running++
				} else if t.LastStatus == "PENDING" || t.LastStatus == "PROVISIONING" {
					pending++
				}
			}
		}

		svc.RunningCount = running
		svc.PendingCount = pending

		for i, dpl := range svc.Deployments {
			if dpl.Status == "PRIMARY" {
				svc.Deployments[i].RunningCount = running
			}
		}

		result = append(result, *svc)
	}
	return result, nil
}

func (s *Store) CreateService(clusterName string, req CreateServiceRequest) (*ECSService, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	if _, exists := s.clusters[clusterName]; !exists {
		return nil, fmt.Errorf("cluster %s not found", clusterName)
	}

	name := strings.TrimSpace(req.Name)
	if name == "" {
		return nil, errors.New("service name cannot be empty")
	}

	if _, exists := s.services[clusterName][name]; exists {
		return nil, fmt.Errorf("service %s already exists in cluster %s", name, clusterName)
	}

	taskDef, err := s.resolveTaskDefinition(req.TaskDefinition)
	if err != nil {
		// If task def is not registered, create a default in-memory task def for convenience
		taskDef = &TaskDefinition{
			TaskDefinitionArn: fmt.Sprintf("arn:aws:ecs:us-east-1:000000000000:task-definition/%s", req.TaskDefinition),
			Family:            req.TaskDefinition,
			Revision:          1,
			Status:            "ACTIVE",
			CPU:               "256",
			Memory:            "512",
			Container: ContainerDefinition{
				Name:  name,
				Image: "nginx:alpine",
			},
		}
	}

	serviceArn := fmt.Sprintf("arn:aws:ecs:us-east-1:000000000000:service/%s/%s", clusterName, name)
	dplID := fmt.Sprintf("ecs-dpl-%s", generateRandomHex(8))

	deployment := ECSDeployment{
		ID:             dplID,
		Status:         "PRIMARY",
		TaskDefinition: req.TaskDefinition,
		DesiredCount:   req.DesiredCount,
		RunningCount:   req.DesiredCount,
		CreatedAt:      time.Now(),
	}

	service := &ECSService{
		ServiceArn:     serviceArn,
		ServiceName:    name,
		ClusterArn:     fmt.Sprintf("arn:aws:ecs:us-east-1:000000000000:cluster/%s", clusterName),
		TaskDefinition: req.TaskDefinition,
		DesiredCount:   req.DesiredCount,
		RunningCount:   req.DesiredCount,
		PendingCount:   0,
		Status:         "ACTIVE",
		LaunchType:     "FARGATE",
		Deployments:    []ECSDeployment{deployment},
		CreatedAt:      time.Now(),
	}

	s.services[clusterName][name] = service

	ctx := context.Background()
	// Spawn desired number of running tasks with real/simulated containers
	for i := 0; i < req.DesiredCount; i++ {
		task, err := s.launchTaskContainer(ctx, clusterName, taskDef, nil, name)
		if err != nil {
			// In case of error launching, fallback to simulated task object
			now := time.Now()
			task = &ECSTask{
				TaskArn:           fmt.Sprintf("arn:aws:ecs:us-east-1:000000000000:task/%s/%s", clusterName, generateRandomHex(16)),
				TaskDefinitionArn: taskDef.TaskDefinitionArn,
				ClusterArn:        service.ClusterArn,
				LastStatus:        "RUNNING",
				DesiredStatus:     "RUNNING",
				LaunchType:        "FARGATE",
				CPU:               taskDef.CPU,
				Memory:            taskDef.Memory,
				StartedAt:         &now,
				DockerStatus:      "SIMULATED",
				Containers: []ECSTaskContainer{
					{
						Name:  taskDef.Container.Name,
						Image: taskDef.Container.Image,
					},
				},
			}
		}

		s.tasks[clusterName][task.TaskArn] = task
		s.taskToService[task.TaskArn] = serviceArn
	}

	return service, nil
}

func (s *Store) UpdateService(clusterName string, serviceName string, req UpdateServiceRequest) (*ECSService, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	if _, exists := s.clusters[clusterName]; !exists {
		return nil, fmt.Errorf("cluster %s not found", clusterName)
	}

	service, exists := s.services[clusterName][serviceName]
	if !exists {
		return nil, fmt.Errorf("service %s not found in cluster %s", serviceName, clusterName)
	}

	oldDesired := service.DesiredCount
	newDesired := req.DesiredCount

	service.DesiredCount = newDesired
	ctx := context.Background()

	if newDesired > oldDesired {
		diff := newDesired - oldDesired
		taskDef, _ := s.resolveTaskDefinition(service.TaskDefinition)
		if taskDef == nil {
			taskDef = &TaskDefinition{
				TaskDefinitionArn: fmt.Sprintf("arn:aws:ecs:us-east-1:000000000000:task-definition/%s", service.TaskDefinition),
				Family:            service.TaskDefinition,
				Revision:          1,
				CPU:               "256",
				Memory:            "512",
				Container: ContainerDefinition{
					Name:  serviceName,
					Image: "nginx:alpine",
				},
			}
		}

		for i := 0; i < diff; i++ {
			task, err := s.launchTaskContainer(ctx, clusterName, taskDef, nil, serviceName)
			if err != nil {
				now := time.Now()
				task = &ECSTask{
					TaskArn:           fmt.Sprintf("arn:aws:ecs:us-east-1:000000000000:task/%s/%s", clusterName, generateRandomHex(16)),
					TaskDefinitionArn: service.TaskDefinition,
					ClusterArn:        service.ClusterArn,
					LastStatus:        "RUNNING",
					DesiredStatus:     "RUNNING",
					LaunchType:        "FARGATE",
					CPU:               taskDef.CPU,
					Memory:            taskDef.Memory,
					StartedAt:         &now,
					DockerStatus:      "SIMULATED",
					Containers: []ECSTaskContainer{
						{
							Name:  taskDef.Container.Name,
							Image: taskDef.Container.Image,
						},
					},
				}
			}

			s.tasks[clusterName][task.TaskArn] = task
			s.taskToService[task.TaskArn] = service.ServiceArn
		}
	} else if newDesired < oldDesired {
		diff := oldDesired - newDesired
		removed := 0

		for taskArn, t := range s.tasks[clusterName] {
			if s.taskToService[taskArn] == service.ServiceArn && t.LastStatus == "RUNNING" {
				s.stopAndRemoveTaskContainer(ctx, t)
				delete(s.tasks[clusterName], taskArn)
				delete(s.taskToService, taskArn)
				removed++
				if removed >= diff {
					break
				}
			}
		}
	}

	for i, dpl := range service.Deployments {
		if dpl.Status == "PRIMARY" {
			service.Deployments[i].DesiredCount = newDesired
			service.Deployments[i].RunningCount = newDesired
		}
	}

	service.RunningCount = newDesired
	return service, nil
}

func (s *Store) DeleteService(clusterName string, serviceName string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if _, exists := s.clusters[clusterName]; !exists {
		return fmt.Errorf("cluster %s not found", clusterName)
	}

	service, exists := s.services[clusterName][serviceName]
	if !exists {
		return fmt.Errorf("service %s not found in cluster %s", serviceName, clusterName)
	}

	ctx := context.Background()
	// Stop and delete all tasks belonging to this service
	for taskArn, task := range s.tasks[clusterName] {
		if s.taskToService[taskArn] == service.ServiceArn {
			s.stopAndRemoveTaskContainer(ctx, task)
			delete(s.tasks[clusterName], taskArn)
			delete(s.taskToService, taskArn)
		}
	}

	delete(s.services[clusterName], serviceName)
	return nil
}

func (s *Store) ForceNewDeployment(clusterName string, serviceName string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if _, exists := s.clusters[clusterName]; !exists {
		return fmt.Errorf("cluster %s not found", clusterName)
	}

	service, exists := s.services[clusterName][serviceName]
	if !exists {
		return fmt.Errorf("service %s not found in cluster %s", serviceName, clusterName)
	}

	ctx := context.Background()

	// Stop old service tasks and spawn new ones
	for taskArn, task := range s.tasks[clusterName] {
		if s.taskToService[taskArn] == service.ServiceArn {
			s.stopAndRemoveTaskContainer(ctx, task)
			delete(s.tasks[clusterName], taskArn)
			delete(s.taskToService, taskArn)
		}
	}

	// Retire old primary deployments
	for i, dpl := range service.Deployments {
		if dpl.Status == "PRIMARY" {
			service.Deployments[i].Status = "ACTIVE"
		}
	}

	// Create new primary deployment
	dplID := fmt.Sprintf("ecs-dpl-%s", generateRandomHex(8))
	newDpl := ECSDeployment{
		ID:             dplID,
		Status:         "PRIMARY",
		TaskDefinition: service.TaskDefinition,
		DesiredCount:   service.DesiredCount,
		RunningCount:   service.DesiredCount,
		CreatedAt:      time.Now(),
	}
	service.Deployments = append([]ECSDeployment{newDpl}, service.Deployments...)

	// Launch new tasks
	taskDef, _ := s.resolveTaskDefinition(service.TaskDefinition)
	if taskDef == nil {
		taskDef = &TaskDefinition{
			TaskDefinitionArn: fmt.Sprintf("arn:aws:ecs:us-east-1:000000000000:task-definition/%s", service.TaskDefinition),
			Family:            service.TaskDefinition,
			Revision:          1,
			CPU:               "256",
			Memory:            "512",
			Container: ContainerDefinition{
				Name:  serviceName,
				Image: "nginx:alpine",
			},
		}
	}

	for i := 0; i < service.DesiredCount; i++ {
		task, err := s.launchTaskContainer(ctx, clusterName, taskDef, nil, serviceName)
		if err != nil {
			now := time.Now()
			task = &ECSTask{
				TaskArn:           fmt.Sprintf("arn:aws:ecs:us-east-1:000000000000:task/%s/%s", clusterName, generateRandomHex(16)),
				TaskDefinitionArn: service.TaskDefinition,
				ClusterArn:        service.ClusterArn,
				LastStatus:        "RUNNING",
				DesiredStatus:     "RUNNING",
				LaunchType:        "FARGATE",
				CPU:               taskDef.CPU,
				Memory:            taskDef.Memory,
				StartedAt:         &now,
				DockerStatus:      "SIMULATED",
				Containers: []ECSTaskContainer{
					{
						Name:  taskDef.Container.Name,
						Image: taskDef.Container.Image,
					},
				},
			}
		}

		s.tasks[clusterName][task.TaskArn] = task
		s.taskToService[task.TaskArn] = service.ServiceArn
	}

	return nil
}

// -------------------------------------------------------------------------
// Task Operations (List, RunTask, StopTask, Logs, Inspect)
// -------------------------------------------------------------------------

func (s *Store) ListTasks(clusterName string) ([]ECSTask, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	if _, exists := s.clusters[clusterName]; !exists {
		return nil, fmt.Errorf("cluster %s not found", clusterName)
	}

	clusterTasks := s.tasks[clusterName]
	result := make([]ECSTask, 0, len(clusterTasks))
	for _, t := range clusterTasks {
		result = append(result, *t)
	}
	return result, nil
}

func (s *Store) RunTask(clusterName string, req RunTaskRequest) ([]ECSTask, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	if _, exists := s.clusters[clusterName]; !exists {
		return nil, fmt.Errorf("cluster %s not found", clusterName)
	}

	taskDef, err := s.resolveTaskDefinition(req.TaskDefinition)
	if err != nil {
		return nil, err
	}

	count := req.Count
	if count <= 0 {
		count = 1
	}

	ctx := context.Background()
	launchedTasks := make([]ECSTask, 0, count)

	for i := 0; i < count; i++ {
		task, err := s.launchTaskContainer(ctx, clusterName, taskDef, req.Overrides, "")
		if err != nil {
			return nil, fmt.Errorf("failed to launch task %d of %d: %w", i+1, count, err)
		}

		s.tasks[clusterName][task.TaskArn] = task
		launchedTasks = append(launchedTasks, *task)
	}

	return launchedTasks, nil
}

func (s *Store) StopTask(taskArn string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	ctx := context.Background()
	var foundTask *ECSTask
	var targetCluster string

	for clusterName, clusterTasks := range s.tasks {
		if t, ok := clusterTasks[taskArn]; ok {
			foundTask = t
			targetCluster = clusterName
			break
		}
	}

	if foundTask == nil {
		return fmt.Errorf("task %s not found", taskArn)
	}

	s.stopAndRemoveTaskContainer(ctx, foundTask)

	// Decrement running counts in deployments/services if applicable
	serviceArn := s.taskToService[taskArn]
	if serviceArn != "" && targetCluster != "" {
		for _, svc := range s.services[targetCluster] {
			if svc.ServiceArn == serviceArn {
				if svc.RunningCount > 0 {
					svc.RunningCount--
				}
				for i, dpl := range svc.Deployments {
					if dpl.Status == "PRIMARY" && dpl.RunningCount > 0 {
						svc.Deployments[i].RunningCount--
					}
				}
			}
		}
	}

	return nil
}

func (s *Store) GetTaskLogs(taskArn string, tail string) (*TaskLogsResponse, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	var targetTask *ECSTask
	for _, clusterTasks := range s.tasks {
		if t, ok := clusterTasks[taskArn]; ok {
			targetTask = t
			break
		}
	}

	if targetTask == nil {
		return nil, fmt.Errorf("task %s not found", taskArn)
	}

	if targetTask.ContainerID == "" {
		return &TaskLogsResponse{
			TaskArn:     taskArn,
			ContainerID: "",
			Logs:        fmt.Sprintf("Task status: %s. No container ID associated.\n", targetTask.LastStatus),
		}, nil
	}

	ctx := context.Background()
	logs, err := s.docker.GetContainerLogs(ctx, targetTask.ContainerID, tail)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch container logs: %w", err)
	}

	return &TaskLogsResponse{
		TaskArn:     taskArn,
		ContainerID: targetTask.ContainerID,
		Logs:        logs,
	}, nil
}

func (s *Store) InspectTask(taskArn string) (*TaskInspectResponse, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	var targetTask *ECSTask
	for _, clusterTasks := range s.tasks {
		if t, ok := clusterTasks[taskArn]; ok {
			targetTask = t
			break
		}
	}

	if targetTask == nil {
		return nil, fmt.Errorf("task %s not found", taskArn)
	}

	var inspect *DockerContainerInspect
	if targetTask.ContainerID != "" {
		ctx := context.Background()
		inspect, _ = s.docker.InspectContainer(ctx, targetTask.ContainerID)
	}

	return &TaskInspectResponse{
		Task:    targetTask,
		Inspect: inspect,
	}, nil
}

// ListDockerImages returns images from Docker daemon.
func (s *Store) ListDockerImages(ctx context.Context) ([]DockerImageSummary, error) {
	if s.docker == nil {
		return []DockerImageSummary{}, nil
	}
	return s.docker.ListImages(ctx)
}
