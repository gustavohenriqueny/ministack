export interface ECRRepository {
  repositoryArn: string;
  repositoryName: string;
  repositoryUri: string;
  createdAt: string;
  imageTagMutability: 'MUTABLE' | 'IMMUTABLE';
  imageCount: number;
}

export interface ECRImage {
  imageDigest: string;
  imageTags: string[];
  imagePushedAt: string;
  imageSizeInBytes: number;
}

export interface CreateRepositoryRequest {
  name: string;
  imageTagMutability: 'MUTABLE' | 'IMMUTABLE';
}

export interface PullImageRequest {
  sourceImage: string;
  tag?: string;
  targetRepository?: string;
}

export type ECRView =
  | { type: 'repositories' }
  | { type: 'repository-detail'; repositoryName: string };
