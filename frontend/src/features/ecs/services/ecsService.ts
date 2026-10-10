import type {
  ECSCluster,
  ECSService,
  ECSTask,
  TaskDefinitionFamily,
  TaskDefinition,
  CreateClusterRequest,
  CreateServiceRequest,
  UpdateServiceRequest,
  RegisterTaskDefinitionRequest,
  RunTaskRequest,
  TaskLogsResponse,
  TaskInspectResponse,
  DockerImageSummary,
} from '../types';

const BASE_URL = '/api/v1';

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let errorMsg = `HTTP ${response.status}: ${response.statusText}`;
    try {
      const errorData = await response.json();
      if (errorData && errorData.error) {
        errorMsg = errorData.error;
      } else if (errorData && errorData.message) {
        errorMsg = errorData.message;
      }
    } catch {
      // not JSON
    }
    throw new Error(errorMsg);
  }
  return response.json();
}

export const ecsService = {
  // Cluster operations
  async getClusters(): Promise<ECSCluster[]> {
    const response = await fetch(`${BASE_URL}/ecs/clusters`);
    return handleResponse<ECSCluster[]>(response);
  },

  async createCluster(req: CreateClusterRequest): Promise<ECSCluster> {
    const response = await fetch(`${BASE_URL}/ecs/clusters`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req),
    });
    return handleResponse<ECSCluster>(response);
  },

  async deleteCluster(name: string): Promise<void> {
    const response = await fetch(`${BASE_URL}/ecs/clusters/${encodeURIComponent(name)}`, {
      method: 'DELETE',
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
  },

  // Service operations
  async getServices(clusterName: string): Promise<ECSService[]> {
    const response = await fetch(`${BASE_URL}/ecs/clusters/${encodeURIComponent(clusterName)}/services`);
    return handleResponse<ECSService[]>(response);
  },

  async createService(clusterName: string, req: CreateServiceRequest): Promise<ECSService> {
    const response = await fetch(
      `${BASE_URL}/ecs/clusters/${encodeURIComponent(clusterName)}/services`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(req),
      }
    );
    return handleResponse<ECSService>(response);
  },

  async updateService(
    clusterName: string,
    serviceName: string,
    req: UpdateServiceRequest
  ): Promise<ECSService> {
    const response = await fetch(
      `${BASE_URL}/ecs/clusters/${encodeURIComponent(clusterName)}/services/${encodeURIComponent(
        serviceName
      )}`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(req),
      }
    );
    return handleResponse<ECSService>(response);
  },

  async forceNewDeployment(clusterName: string, serviceName: string): Promise<void> {
    const response = await fetch(
      `${BASE_URL}/ecs/clusters/${encodeURIComponent(clusterName)}/services/${encodeURIComponent(
        serviceName
      )}/deployments`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      }
    );
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
  },

  async deleteService(clusterName: string, serviceName: string): Promise<void> {
    const response = await fetch(
      `${BASE_URL}/ecs/clusters/${encodeURIComponent(clusterName)}/services/${encodeURIComponent(
        serviceName
      )}`,
      {
        method: 'DELETE',
      }
    );
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
  },

  // Task operations
  async getTasks(clusterName: string): Promise<ECSTask[]> {
    const response = await fetch(`${BASE_URL}/ecs/clusters/${encodeURIComponent(clusterName)}/tasks`);
    return handleResponse<ECSTask[]>(response);
  },

  async runTask(clusterName: string, req: RunTaskRequest): Promise<ECSTask[]> {
    const response = await fetch(`${BASE_URL}/ecs/clusters/${encodeURIComponent(clusterName)}/tasks/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req),
    });
    return handleResponse<ECSTask[]>(response);
  },

  async stopTask(taskArn: string): Promise<void> {
    const response = await fetch(`${BASE_URL}/ecs/tasks/${encodeURIComponent(taskArn)}/stop`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
  },

  async getTaskLogs(taskArn: string, tail: number = 100): Promise<TaskLogsResponse> {
    const response = await fetch(`${BASE_URL}/ecs/tasks/${encodeURIComponent(taskArn)}/logs?tail=${tail}`);
    return handleResponse<TaskLogsResponse>(response);
  },

  async inspectTask(taskArn: string): Promise<TaskInspectResponse> {
    const response = await fetch(`${BASE_URL}/ecs/tasks/${encodeURIComponent(taskArn)}/inspect`);
    return handleResponse<TaskInspectResponse>(response);
  },

  // Task Definition operations
  async getTaskDefinitions(): Promise<TaskDefinitionFamily[]> {
    const response = await fetch(`${BASE_URL}/ecs/task-definitions`);
    return handleResponse<TaskDefinitionFamily[]>(response);
  },

  async registerTaskDefinition(req: RegisterTaskDefinitionRequest): Promise<TaskDefinition> {
    const response = await fetch(`${BASE_URL}/ecs/task-definitions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req),
    });
    return handleResponse<TaskDefinition>(response);
  },

  async deregisterTaskDefinition(family: string, revision: number): Promise<void> {
    const response = await fetch(
      `${BASE_URL}/ecs/task-definitions/${encodeURIComponent(family)}/${revision}`,
      {
        method: 'DELETE',
      }
    );
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
  },

  // Docker Host Images
  async getDockerImages(): Promise<DockerImageSummary[]> {
    const response = await fetch(`${BASE_URL}/docker/images`);
    return handleResponse<DockerImageSummary[]>(response);
  },
};
