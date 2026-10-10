export interface ECSCluster {
  clusterArn: string;
  clusterName: string;
  status: string;
  runningTasksCount: number;
  pendingTasksCount: number;
  activeServicesCount: number;
  capacityProviders: string[];
  createdAt: string;
}

export interface ECSDeployment {
  id: string;
  status: string;
  taskDefinition: string;
  desiredCount: number;
  runningCount: number;
  createdAt: string;
}

export interface ECSService {
  serviceArn: string;
  serviceName: string;
  clusterArn: string;
  taskDefinition: string;
  desiredCount: number;
  runningCount: number;
  pendingCount: number;
  status: string;
  launchType: string;
  deployments: ECSDeployment[];
  createdAt: string;
}

export interface HostPortMapping {
  containerPort: number;
  hostPort: number;
  protocol: string;
  hostIp?: string;
}

export interface ContainerOverride {
  name?: string;
  environment?: EnvironmentVariable[];
  cpu?: number;
  memory?: number;
}

export interface TaskOverrides {
  containerOverrides?: ContainerOverride[];
}

export interface ECSTask {
  taskArn: string;
  taskDefinitionArn: string;
  clusterArn?: string;
  lastStatus: string;
  desiredStatus: string;
  launchType: string;
  cpu: string;
  memory: string;
  startedAt?: string;
  stoppedAt?: string;
  containerId?: string;
  dockerStatus?: 'RUNNING' | 'EXITED' | 'SIMULATED' | 'CREATED' | string;
  hostPortMappings?: HostPortMapping[];
  overrides?: TaskOverrides;
  containers: Array<{
    name: string;
    image: string;
  }>;
}

export interface PortMapping {
  containerPort: number;
  protocol: 'tcp' | 'udp';
}

export interface EnvironmentVariable {
  name: string;
  value: string;
}

export interface ContainerDefinition {
  name: string;
  image: string;
  cpu: number;
  memory: number;
  portMappings: PortMapping[];
  environment: EnvironmentVariable[];
  essential: boolean;
}

export interface TaskDefinition {
  taskDefinitionArn: string;
  family: string;
  revision: number;
  status: string;
  networkMode: string;
  cpu: string;
  memory: string;
  requiresCompatibilities: string[];
  registeredAt: string;
  container: ContainerDefinition;
}

export interface TaskDefinitionFamily {
  family: string;
  activeRevisionCount: number;
  latestRevision: number;
  latestRegisteredAt: string;
  revisions: TaskDefinition[];
}

export type ECSView =
  | { type: 'clusters' }
  | {
      type: 'cluster-detail';
      clusterName: string;
      tab: 'services' | 'tasks';
    }
  | { type: 'service-detail'; clusterName: string; serviceName: string }
  | { type: 'task-definitions' };

export interface CreateClusterRequest {
  name: string;
  capacityProviders?: string[];
}

export interface CreateServiceRequest {
  name: string;
  taskDefinition: string;
  desiredCount: number;
}

export interface UpdateServiceRequest {
  desiredCount: number;
}

export interface RegisterTaskDefinitionRequest {
  family: string;
  cpu: string;
  memory: string;
  networkMode: string;
  container: {
    name: string;
    image: string;
    cpu: number;
    memory: number;
    portMappings: PortMapping[];
    environment: EnvironmentVariable[];
  };
}

export interface RunTaskRequest {
  taskDefinition: string;
  count?: number;
  overrides?: TaskOverrides;
}

export interface TaskLogsResponse {
  taskArn: string;
  containerId: string;
  logs: string;
}

export interface TaskInspectResponse {
  task: ECSTask;
  inspect?: {
    Id?: string;
    Created?: string;
    State?: {
      Status?: string;
      Running?: boolean;
      ExitCode?: number;
      StartedAt?: string;
      FinishedAt?: string;
      Error?: string;
    };
    NetworkSettings?: {
      IPAddress?: string;
      Ports?: Record<string, Array<{ HostIp: string; HostPort: string }>>;
    };
    Config?: {
      Image?: string;
      Env?: string[];
      Labels?: Record<string, string>;
    };
  };
}

export interface DockerImageSummary {
  id: string;
  repoTags: string[];
  size: number;
  created: number;
}
