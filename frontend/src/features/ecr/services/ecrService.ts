import type { ECRRepository, ECRImage, CreateRepositoryRequest } from '../types';

const API_BASE = '/api/v1';

export const ecrService = {
  getRepositories: async (): Promise<ECRRepository[]> => {
    const resp = await fetch(`${API_BASE}/ecr/repositories`);
    if (!resp.ok) throw new Error('Failed to fetch repositories');
    return resp.json();
  },

  createRepository: async (req: CreateRepositoryRequest): Promise<ECRRepository> => {
    const resp = await fetch(`${API_BASE}/ecr/repositories`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req),
    });
    if (!resp.ok) throw new Error('Failed to create repository');
    return resp.json();
  },

  deleteRepository: async (name: string): Promise<void> => {
    const resp = await fetch(`${API_BASE}/ecr/repositories/${encodeURIComponent(name)}`, {
      method: 'DELETE',
    });
    if (!resp.ok) throw new Error('Failed to delete repository');
  },

  getImages: async (repositoryName: string): Promise<ECRImage[]> => {
    const resp = await fetch(`${API_BASE}/ecr/repositories/${encodeURIComponent(repositoryName)}/images`);
    if (!resp.ok) throw new Error('Failed to fetch images');
    return resp.json();
  },

  deleteImage: async (repositoryName: string, digest: string): Promise<void> => {
    const resp = await fetch(
      `${API_BASE}/ecr/repositories/${encodeURIComponent(repositoryName)}/images/${encodeURIComponent(digest)}`,
      { method: 'DELETE' }
    );
    if (!resp.ok) throw new Error('Failed to delete image');
  },

  pullImage: async (repositoryName: string, req: { sourceImage: string; tag?: string }): Promise<ECRImage> => {
    const endpoint = repositoryName
      ? `${API_BASE}/ecr/repositories/${encodeURIComponent(repositoryName)}/pull`
      : `${API_BASE}/docker/pull`;
    const resp = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req),
    });
    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to pull image');
    }
    return resp.json();
  },
};
