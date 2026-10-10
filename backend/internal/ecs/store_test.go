package ecs

import (
	"testing"
)

func TestClusterOperations(t *testing.T) {
	store := NewStore()

	// 1. Create Cluster
	req := CreateClusterRequest{
		Name:              "test-cluster",
		CapacityProviders: []string{"FARGATE"},
	}
	cluster, err := store.CreateCluster(req)
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}

	if cluster.ClusterName != "test-cluster" {
		t.Errorf("expected cluster name 'test-cluster', got '%s'", cluster.ClusterName)
	}

	// 2. Duplicate Cluster Name
	_, err = store.CreateCluster(req)
	if err == nil {
		t.Error("expected error when creating duplicate cluster, got nil")
	}

	// 3. List Clusters
	clusters := store.ListClusters()
	if len(clusters) != 1 {
		t.Errorf("expected 1 cluster in list, got %d", len(clusters))
	}

	// 4. Delete Cluster
	err = store.DeleteCluster("test-cluster")
	if err != nil {
		t.Fatalf("expected no error on delete, got %v", err)
	}

	clusters = store.ListClusters()
	if len(clusters) != 0 {
		t.Errorf("expected 0 clusters in list after delete, got %d", len(clusters))
	}
}

func TestTaskDefinitionOperations(t *testing.T) {
	store := NewStore()

	req := RegisterTaskDefinitionRequest{
		Family:      "my-family",
		CPU:         "256",
		Memory:      "512",
		NetworkMode: "awsvpc",
		Container: ContainerDefinition{
			Name:  "web",
			Image: "nginx:latest",
		},
	}

	// 1. Register first revision
	td1, err := store.RegisterTaskDefinition(req)
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}

	if td1.Revision != 1 {
		t.Errorf("expected revision 1, got %d", td1.Revision)
	}

	// 2. Register second revision
	td2, err := store.RegisterTaskDefinition(req)
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}

	if td2.Revision != 2 {
		t.Errorf("expected revision 2, got %d", td2.Revision)
	}

	families := store.ListTaskDefinitions()
	if len(families) != 1 {
		t.Errorf("expected 1 family in list, got %d", len(families))
	}
	if families[0].LatestRevision != 2 {
		t.Errorf("expected latest revision to be 2, got %d", families[0].LatestRevision)
	}
	if families[0].ActiveRevisionCount != 2 {
		t.Errorf("expected 2 active revisions, got %d", families[0].ActiveRevisionCount)
	}

	// 3. Deregister revision 1
	err = store.DeregisterTaskDefinition("my-family", 1)
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}

	families = store.ListTaskDefinitions()
	if families[0].ActiveRevisionCount != 1 {
		t.Errorf("expected 1 active revision after deregistration, got %d", families[0].ActiveRevisionCount)
	}
}

func TestServiceAndTaskOperations(t *testing.T) {
	store := NewStore()

	// Setup cluster & task def
	_, err := store.CreateCluster(CreateClusterRequest{Name: "dev"})
	if err != nil {
		t.Fatal(err)
	}

	_, err = store.RegisterTaskDefinition(RegisterTaskDefinitionRequest{
		Family: "api",
		CPU:    "256",
		Memory: "512",
		Container: ContainerDefinition{
			Name:  "api-service",
			Image: "node:18",
			PortMappings: []PortMapping{
				{ContainerPort: 3000, Protocol: "tcp"},
			},
			Environment: []EnvironmentVariable{
				{Name: "NODE_ENV", Value: "development"},
			},
		},
	})
	if err != nil {
		t.Fatal(err)
	}

	// 1. Create Service
	svcReq := CreateServiceRequest{
		Name:           "api-service",
		TaskDefinition: "api:1",
		DesiredCount:   3,
	}

	svc, err := store.CreateService("dev", svcReq)
	if err != nil {
		t.Fatalf("expected no error on service creation, got %v", err)
	}

	if svc.ServiceName != "api-service" {
		t.Errorf("expected service name 'api-service', got '%s'", svc.ServiceName)
	}

	// Verify tasks spawned
	tasks, err := store.ListTasks("dev")
	if err != nil {
		t.Fatal(err)
	}

	if len(tasks) != 3 {
		t.Errorf("expected 3 tasks spawned, got %d", len(tasks))
	}

	if tasks[0].Containers[0].Image != "node:18" {
		t.Errorf("expected task image 'node:18', got '%s'", tasks[0].Containers[0].Image)
	}

	if tasks[0].ContainerID == "" {
		t.Errorf("expected task to have a ContainerID")
	}

	// 2. Scale service down to 1
	svc, err = store.UpdateService("dev", "api-service", UpdateServiceRequest{DesiredCount: 1})
	if err != nil {
		t.Fatalf("expected no error on update, got %v", err)
	}

	tasks, err = store.ListTasks("dev")
	if err != nil {
		t.Fatal(err)
	}

	if len(tasks) != 1 {
		t.Errorf("expected 1 task after scaling down, got %d", len(tasks))
	}

	// 3. Stop task
	taskArn := tasks[0].TaskArn
	err = store.StopTask(taskArn)
	if err != nil {
		t.Fatalf("expected no error on stop task, got %v", err)
	}

	// Fetch service details again (ListServices) to verify running count is 0
	svcs, err := store.ListServices("dev")
	if err != nil {
		t.Fatal(err)
	}
	if svcs[0].RunningCount != 0 {
		t.Errorf("expected running count 0 after task stop, got %d", svcs[0].RunningCount)
	}

	// 4. Force new deployment
	err = store.ForceNewDeployment("dev", "api-service")
	if err != nil {
		t.Fatalf("expected no error on force deploy, got %v", err)
	}

	svcs, err = store.ListServices("dev")
	if err != nil {
		t.Fatal(err)
	}
	if len(svcs[0].Deployments) != 2 {
		t.Errorf("expected 2 deployments after force deployment, got %d", len(svcs[0].Deployments))
	}
	if svcs[0].Deployments[0].Status != "PRIMARY" {
		t.Errorf("expected new deployment status 'PRIMARY', got '%s'", svcs[0].Deployments[0].Status)
	}
	if svcs[0].Deployments[1].Status != "ACTIVE" {
		t.Errorf("expected old deployment status changed to 'ACTIVE', got '%s'", svcs[0].Deployments[1].Status)
	}

	// 5. RunTask with Overrides
	runReq := RunTaskRequest{
		TaskDefinition: "api:1",
		Count:          2,
		Overrides: &TaskOverrides{
			ContainerOverrides: []ContainerOverride{
				{
					Name: "api-service",
					Environment: []EnvironmentVariable{
						{Name: "NODE_ENV", Value: "production"},
					},
					CPU:    512,
					Memory: 1024,
				},
			},
		},
	}

	launched, err := store.RunTask("dev", runReq)
	if err != nil {
		t.Fatalf("failed to run task: %v", err)
	}
	if len(launched) != 2 {
		t.Errorf("expected 2 launched tasks, got %d", len(launched))
	}
	if launched[0].CPU != "512" || launched[0].Memory != "1024" {
		t.Errorf("expected overridden CPU 512, Memory 1024, got %s / %s", launched[0].CPU, launched[0].Memory)
	}

	// 6. Task Logs and Inspect
	logs, err := store.GetTaskLogs(launched[0].TaskArn, "10")
	if err != nil {
		t.Fatalf("failed to get task logs: %v", err)
	}
	if logs.Logs == "" {
		t.Errorf("expected non-empty logs")
	}

	inspect, err := store.InspectTask(launched[0].TaskArn)
	if err != nil {
		t.Fatalf("failed to inspect task: %v", err)
	}
	if inspect.Task == nil || inspect.Task.TaskArn != launched[0].TaskArn {
		t.Errorf("unexpected inspect result: %v", inspect)
	}

	// 7. Delete Service
	err = store.DeleteService("dev", "api-service")
	if err != nil {
		t.Fatalf("expected no error on delete, got %v", err)
	}

	svcs, err = store.ListServices("dev")
	if err != nil {
		t.Fatal(err)
	}
	if len(svcs) != 0 {
		t.Errorf("expected 0 services after delete, got %d", len(svcs))
	}

	// 8. Cascading Delete on Cluster
	err = store.DeleteCluster("dev")
	if err != nil {
		t.Fatalf("failed to delete cluster: %v", err)
	}
	if len(store.ListClusters()) != 0 {
		t.Errorf("expected 0 clusters after delete")
	}
}
