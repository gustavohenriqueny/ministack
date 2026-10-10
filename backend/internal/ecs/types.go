package ecs

import "time"

type ECSCluster struct {
	ClusterArn          string    `json:"clusterArn"`
	ClusterName         string    `json:"clusterName"`
	Status              string    `json:"status"`
	RunningTasksCount   int       `json:"runningTasksCount"`
	PendingTasksCount   int       `json:"pendingTasksCount"`
	ActiveServicesCount int       `json:"activeServicesCount"`
	CapacityProviders   []string  `json:"capacityProviders"`
	CreatedAt           time.Time `json:"createdAt"`
}

type ECSDeployment struct {
	ID             string    `json:"id"`
	Status         string    `json:"status"`
	TaskDefinition string    `json:"taskDefinition"`
	DesiredCount   int       `json:"desiredCount"`
	RunningCount   int       `json:"runningCount"`
	CreatedAt      time.Time `json:"createdAt"`
}

type ECSService struct {
	ServiceArn     string          `json:"serviceArn"`
	ServiceName    string          `json:"serviceName"`
	ClusterArn     string          `json:"clusterArn"`
	TaskDefinition string          `json:"taskDefinition"`
	DesiredCount   int             `json:"desiredCount"`
	RunningCount   int             `json:"runningCount"`
	PendingCount   int             `json:"pendingCount"`
	Status         string          `json:"status"`
	LaunchType     string          `json:"launchType"`
	Deployments    []ECSDeployment `json:"deployments"`
	CreatedAt      time.Time       `json:"createdAt"`
}

type ECSTaskContainer struct {
	Name  string `json:"name"`
	Image string `json:"image"`
}

type HostPortMapping struct {
	ContainerPort int    `json:"containerPort"`
	HostPort      int    `json:"hostPort"`
	Protocol      string `json:"protocol"` // tcp, udp
	HostIP        string `json:"hostIp,omitempty"`
}

type ECSTask struct {
	TaskArn           string             `json:"taskArn"`
	TaskDefinitionArn string             `json:"taskDefinitionArn"`
	ClusterArn        string             `json:"clusterArn,omitempty"`
	LastStatus        string             `json:"lastStatus"`
	DesiredStatus     string             `json:"desiredStatus"`
	LaunchType        string             `json:"launchType"`
	CPU               string             `json:"cpu"`
	Memory            string             `json:"memory"`
	StartedAt         *time.Time         `json:"startedAt,omitempty"`
	StoppedAt         *time.Time         `json:"stoppedAt,omitempty"`
	Containers        []ECSTaskContainer `json:"containers"`
	ContainerID       string             `json:"containerId,omitempty"`
	DockerStatus      string             `json:"dockerStatus,omitempty"` // RUNNING, EXITED, SIMULATED, CREATED
	HostPortMappings  []HostPortMapping  `json:"hostPortMappings,omitempty"`
	Overrides         *TaskOverrides     `json:"overrides,omitempty"`
}

type PortMapping struct {
	ContainerPort int    `json:"containerPort"`
	Protocol      string `json:"protocol"` // tcp, udp
}

type EnvironmentVariable struct {
	Name  string `json:"name"`
	Value string `json:"value"`
}

type ContainerDefinition struct {
	Name         string                `json:"name"`
	Image        string                `json:"image"`
	CPU          int                   `json:"cpu"`
	Memory       int                   `json:"memory"`
	PortMappings []PortMapping         `json:"portMappings"`
	Environment  []EnvironmentVariable `json:"environment"`
	Essential    bool                  `json:"essential"`
}

type TaskDefinition struct {
	TaskDefinitionArn       string              `json:"taskDefinitionArn"`
	Family                  string              `json:"family"`
	Revision                int                 `json:"revision"`
	Status                  string              `json:"status"`
	NetworkMode             string              `json:"networkMode"`
	CPU                     string              `json:"cpu"`
	Memory                  string              `json:"memory"`
	RequiresCompatibilities []string            `json:"requiresCompatibilities"`
	RegisteredAt            time.Time           `json:"registeredAt"`
	Container               ContainerDefinition `json:"container"`
}

type TaskDefinitionFamily struct {
	Family              string           `json:"family"`
	ActiveRevisionCount int              `json:"activeRevisionCount"`
	LatestRevision      int              `json:"latestRevision"`
	LatestRegisteredAt  time.Time        `json:"latestRegisteredAt"`
	Revisions           []TaskDefinition `json:"revisions"`
}

// Request & Response payloads

type CreateClusterRequest struct {
	Name              string   `json:"name"`
	CapacityProviders []string `json:"capacityProviders"`
}

type CreateServiceRequest struct {
	Name           string `json:"name"`
	TaskDefinition string `json:"taskDefinition"`
	DesiredCount   int    `json:"desiredCount"`
}

type UpdateServiceRequest struct {
	DesiredCount int `json:"desiredCount"`
}

type RegisterTaskDefinitionRequest struct {
	Family      string              `json:"family"`
	CPU         string              `json:"cpu"`
	Memory      string              `json:"memory"`
	NetworkMode string              `json:"networkMode"`
	Container   ContainerDefinition `json:"container"`
}

type ContainerOverride struct {
	Name        string                `json:"name,omitempty"`
	Environment []EnvironmentVariable `json:"environment,omitempty"`
	CPU         int                   `json:"cpu,omitempty"`
	Memory      int                   `json:"memory,omitempty"`
}

type TaskOverrides struct {
	ContainerOverrides []ContainerOverride `json:"containerOverrides,omitempty"`
}

type RunTaskRequest struct {
	TaskDefinition string         `json:"taskDefinition"`
	Count          int            `json:"count,omitempty"`
	Overrides      *TaskOverrides `json:"overrides,omitempty"`
}

type TaskLogsResponse struct {
	TaskArn     string `json:"taskArn"`
	ContainerID string `json:"containerId"`
	Logs        string `json:"logs"`
}

type TaskInspectResponse struct {
	Task    *ECSTask                `json:"task"`
	Inspect *DockerContainerInspect `json:"inspect,omitempty"`
}
