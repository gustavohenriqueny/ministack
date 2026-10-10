import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Skeleton } from '../../../components/ui/skeleton';
import { ecrService } from '../services/ecrService';
import type { ECRRepository, ECRImage, ECRView } from '../types';
import {
  Package,
  Trash2,
  Plus,
  ChevronRight,
  Copy,
  Check,
  AlertCircle,
  RefreshCw,
  Terminal,
  Tag,
  X,
  Layers,
  DownloadCloud,
  HardDrive,
} from 'lucide-react';

function formatImageSize(bytes: number): string {
  if (bytes < 1_048_576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1_048_576).toFixed(1)} MB`;
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

const POPULAR_PULL_TEMPLATES = [
  {
    id: 'hello-k8s',
    name: 'Hello Kubernetes',
    image: 'paulbouwer/hello-kubernetes:1.10',
    repo: 'hello-kubernetes',
    tag: '1.10',
    desc: 'Sample app with Web UI (Port 8080)',
  },
  {
    id: 'nginx',
    name: 'Nginx Web Server',
    image: 'nginx:alpine',
    repo: 'nginx',
    tag: 'alpine',
    desc: 'Lightweight HTTP server (Port 80)',
  },
  {
    id: 'redis',
    name: 'Redis',
    image: 'redis:alpine',
    repo: 'redis',
    tag: 'alpine',
    desc: 'In-memory key-value store (Port 6379)',
  },
  {
    id: 'postgres',
    name: 'PostgreSQL',
    image: 'postgres:16-alpine',
    repo: 'postgres',
    tag: '16-alpine',
    desc: 'Relational database (Port 5432)',
  },
  {
    id: 'node',
    name: 'Node.js',
    image: 'node:20-alpine',
    repo: 'node',
    tag: '20-alpine',
    desc: 'JavaScript runtime (Port 3000)',
  },
];

export const ECRDashboard: React.FC = () => {
  const [currentView, setCurrentView] = useState<ECRView>({ type: 'repositories' });

  // Repositories state
  const [repositories, setRepositories] = useState<ECRRepository[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Create modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createMutability, setCreateMutability] = useState<'MUTABLE' | 'IMMUTABLE'>('MUTABLE');
  const [nameError, setNameError] = useState<string | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  // Delete repo dialog state
  const [deleteConfirm, setDeleteConfirm] = useState<ECRRepository | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Images state (detail view)
  const [images, setImages] = useState<ECRImage[]>([]);
  const [imagesLoading, setImagesLoading] = useState(false);
  const [imagesError, setImagesError] = useState<string | null>(null);

  // Delete image dialog state
  const [deleteImageConfirm, setDeleteImageConfirm] = useState<ECRImage | null>(null);
  const [deleteImageError, setDeleteImageError] = useState<string | null>(null);
  const [deletingImage, setDeletingImage] = useState(false);

  // Push commands modal state
  const [pushCommandsRepo, setPushCommandsRepo] = useState<ECRRepository | null>(null);
  const [pushCommandsTab, setPushCommandsTab] = useState<'unix' | 'windows'>('unix');
  const [copiedStep, setCopiedStep] = useState<number | 'all' | null>(null);

  // Pull / Import image modal state
  const [showPullModal, setShowPullModal] = useState(false);
  const [pullSourceImage, setPullSourceImage] = useState('');
  const [pullTargetRepo, setPullTargetRepo] = useState('');
  const [pullTag, setPullTag] = useState('');
  const [pulling, setPulling] = useState(false);
  const [pullError, setPullError] = useState<string | null>(null);
  const [localDockerImages, setLocalDockerImages] = useState<string[]>([]);

  // Copy feedback
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const fetchLocalImages = async () => {
      try {
        const res = await fetch('/api/v1/docker/images');
        if (res.ok) {
          const data: Array<{ repoTags: string[] }> = await res.json();
          const tagsSet = new Set<string>();
          for (const img of data) {
            for (const tag of img.repoTags || []) {
              if (tag && tag !== '<none>:<none>' && !tag.startsWith('ministackorg/ministack')) {
                tagsSet.add(tag);
              }
            }
          }
          setLocalDockerImages(Array.from(tagsSet));
        }
      } catch {
        // Ignore error
      }
    };
    fetchLocalImages();
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      if (currentView.type === 'repositories') {
        setLoading(true);
        setError(null);
        try {
          const data = await ecrService.getRepositories();
          setRepositories(data);
        } catch (e) {
          setError((e as Error).message);
        } finally {
          setLoading(false);
        }
      } else if (currentView.type === 'repository-detail') {
        setImages([]);
        setImagesLoading(true);
        setImagesError(null);
        try {
          const data = await ecrService.getImages(currentView.repositoryName);
          setImages(data);
        } catch (e) {
          setImagesError((e as Error).message);
        } finally {
          setImagesLoading(false);
        }
      }
    };
    fetchData();
  }, [currentView]);

  const openCreateModal = () => {
    setCreateName('');
    setCreateMutability('MUTABLE');
    setNameError(null);
    setCreateError(null);
    setShowCreateModal(true);
  };

  const openPullModal = (preselectedRepo?: string) => {
    setPullSourceImage('');
    setPullTag('');
    setPullError(null);
    setPullTargetRepo(preselectedRepo || (currentView.type === 'repository-detail' ? currentView.repositoryName : ''));
    setShowPullModal(true);
  };

  const handleCreateRepository = async () => {
    if (!createName.trim()) {
      setNameError('Repository name is required');
      return;
    }
    if (/\s/.test(createName)) {
      setNameError('Repository name cannot contain spaces');
      return;
    }
    setNameError(null);
    setCreateError(null);
    setCreating(true);
    try {
      const repo = await ecrService.createRepository({ name: createName.trim(), imageTagMutability: createMutability });
      setRepositories(prev => [...prev, repo]);
      setShowCreateModal(false);
    } catch (e) {
      setCreateError((e as Error).message);
    } finally {
      setCreating(false);
    }
  };

  const handlePullImage = async () => {
    const src = pullSourceImage.trim();
    if (!src) {
      setPullError('Source image is required');
      return;
    }

    let target = currentView.type === 'repository-detail' ? currentView.repositoryName : pullTargetRepo.trim();
    if (!target) {
      let clean = src;
      if (clean.includes(':')) clean = clean.split(':')[0];
      if (clean.includes('/')) clean = clean.split('/').pop() || clean;
      target = clean;
    }

    setPulling(true);
    setPullError(null);
    try {
      await ecrService.pullImage(target, {
        sourceImage: src,
        tag: pullTag.trim() || undefined,
      });

      const updatedRepos = await ecrService.getRepositories();
      setRepositories(updatedRepos);

      if (currentView.type === 'repository-detail') {
        const updatedImages = await ecrService.getImages(currentView.repositoryName);
        setImages(updatedImages);
      } else {
        setCurrentView({ type: 'repository-detail', repositoryName: target });
      }

      setShowPullModal(false);
    } catch (e) {
      setPullError((e as Error).message);
    } finally {
      setPulling(false);
    }
  };

  const handleDeleteRepository = async () => {
    if (!deleteConfirm) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await ecrService.deleteRepository(deleteConfirm.repositoryName);
      setRepositories(prev => prev.filter(r => r.repositoryName !== deleteConfirm.repositoryName));
      setDeleteConfirm(null);
    } catch (e) {
      setDeleteError((e as Error).message);
    } finally {
      setDeleting(false);
    }
  };

  const handleDeleteImage = async () => {
    if (!deleteImageConfirm || currentView.type !== 'repository-detail') return;
    setDeletingImage(true);
    setDeleteImageError(null);
    try {
      await ecrService.deleteImage(currentView.repositoryName, deleteImageConfirm.imageDigest);
      setImages(prev => prev.filter(i => i.imageDigest !== deleteImageConfirm.imageDigest));
      setDeleteImageConfirm(null);
    } catch (e) {
      setDeleteImageError((e as Error).message);
    } finally {
      setDeletingImage(false);
    }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyStep = (text: string, stepId: number | 'all') => {
    navigator.clipboard.writeText(text);
    setCopiedStep(stepId);
    setTimeout(() => setCopiedStep(null), 2000);
  };

  // ─── Breadcrumb ─────────────────────────────────────────────────────────────

  const renderBreadcrumb = () => (
    <div className="flex items-center gap-1.5 text-[0.6rem] font-bold text-content-muted uppercase tracking-widest mb-1">
      <span>Console</span>
      <span>/</span>
      {currentView.type === 'repositories' ? (
        <span className="text-content-secondary">ECR / Repositories</span>
      ) : (
        <>
          <button
            onClick={() => setCurrentView({ type: 'repositories' })}
            className="text-brand-primary hover:underline"
          >
            ECR / Repositories
          </button>
          <ChevronRight size={10} />
          <span className="text-content-secondary">{currentView.repositoryName}</span>
        </>
      )}
    </div>
  );

  // ─── Repositories view ───────────────────────────────────────────────────────

  const renderRepositories = () => (
    <div className="animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl font-bold text-content-primary">Elastic Container Registry</h1>
          <p className="text-xs text-content-muted mt-1">
            {loading ? 'Loading...' : `${repositories.length} ${repositories.length === 1 ? 'repository' : 'repositories'}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => openPullModal()}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-surface-secondary border border-border-strong text-content-primary text-xs font-semibold rounded-lg hover:bg-surface-tertiary transition-colors shadow-xs"
          >
            <DownloadCloud size={13} className="text-brand-primary" />
            Pull / Import Image
          </button>
          <button
            onClick={openCreateModal}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-primary text-white text-xs font-semibold rounded-lg hover:opacity-90 transition-opacity shadow-xs"
          >
            <Plus size={13} />
            Create Repository
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col gap-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="glass-card-base p-4 flex flex-col gap-2">
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-3 w-72 mt-1" />
              <div className="flex gap-4 mt-1">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-3 w-24" />
              </div>
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="glass-card-base p-8 flex flex-col items-center gap-3 text-center">
          <AlertCircle size={28} className="text-status-error" />
          <p className="text-sm text-content-secondary">{error}</p>
          <button
            onClick={() => setCurrentView({ type: 'repositories' })}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold border border-border-strong rounded hover:bg-surface-tertiary transition-colors text-content-primary"
          >
            <RefreshCw size={12} /> Retry
          </button>
        </div>
      ) : repositories.length === 0 ? (
        <div className="glass-card-base p-12 flex flex-col items-center gap-3 text-center">
          <Package size={36} className="text-content-muted" />
          <p className="text-sm font-semibold text-content-primary">No repositories found</p>
          <p className="text-xs text-content-muted">Create a repository or pull a public Docker image to start</p>
          <div className="flex items-center gap-2 mt-2">
            <button
              onClick={() => openPullModal()}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-surface-secondary border border-border-strong text-content-primary text-xs font-semibold rounded-lg hover:bg-surface-tertiary transition-colors"
            >
              <DownloadCloud size={13} className="text-brand-primary" /> Pull / Import Image
            </button>
            <button
              onClick={openCreateModal}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-primary text-white text-xs font-semibold rounded-lg hover:opacity-90 transition-opacity"
            >
              <Plus size={13} /> Create Repository
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-2 animate-slide-up">
          {repositories.map(repo => (
            <div
              key={repo.repositoryArn}
              className="glass-card-base glow-hover p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 cursor-pointer"
              onClick={() => setCurrentView({ type: 'repository-detail', repositoryName: repo.repositoryName })}
            >
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className="w-9 h-9 rounded-lg bg-surface-tertiary border border-border-strong flex items-center justify-center shrink-0">
                  <Package size={16} className="text-brand-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-sm font-semibold text-content-primary hover:text-brand-primary transition-colors">
                      {repo.repositoryName}
                    </span>
                    <span className={`text-[0.6rem] font-bold px-1.5 py-0.5 rounded uppercase tracking-wide ${
                      repo.imageTagMutability === 'MUTABLE'
                        ? 'bg-status-warning/10 text-status-warning'
                        : 'bg-status-info/10 text-status-info'
                    }`}>
                      {repo.imageTagMutability}
                    </span>
                  </div>
                  <p className="text-[0.7rem] text-content-muted font-mono truncate">{repo.repositoryUri}</p>
                </div>
              </div>

              <div className="flex items-center gap-4 shrink-0 sm:ml-4">
                <div className="text-right">
                  <p className="text-sm font-bold text-content-primary">{repo.imageCount}</p>
                  <p className="text-[0.6rem] text-content-muted">images</p>
                </div>
                <div className="text-right hidden md:block">
                  <p className="text-xs text-content-muted">{formatDate(repo.createdAt)}</p>
                </div>

                {/* View push commands button on card */}
                <button
                  onClick={e => {
                    e.stopPropagation();
                    setPushCommandsRepo(repo);
                  }}
                  className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold border border-border-strong/70 hover:border-brand-primary/40 rounded-lg hover:bg-surface-tertiary text-content-secondary hover:text-content-primary transition-all"
                  title="View push commands for this repository"
                >
                  <Terminal size={13} className="text-brand-primary" />
                  <span className="hidden lg:inline">Push commands</span>
                </button>

                <button
                  onClick={e => {
                    e.stopPropagation();
                    setDeleteError(null);
                    setDeleteConfirm(repo);
                  }}
                  className="p-1.5 text-content-muted hover:text-status-error hover:bg-status-error/10 rounded-lg transition-colors"
                  title="Delete repository"
                >
                  <Trash2 size={14} />
                </button>
                <ChevronRight size={14} className="text-content-muted" />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  // ─── Repository detail (images) ──────────────────────────────────────────────

  const renderRepositoryDetail = () => {
    if (currentView.type !== 'repository-detail') return null;
    const repo = repositories.find(r => r.repositoryName === currentView.repositoryName);
    const repoUri = repo?.repositoryUri ?? `localhost:9091/${currentView.repositoryName}`;
    const pushCommand = `docker push ${repoUri}:<tag>`;

    return (
      <div className="animate-fade-in">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-xl font-bold text-content-primary">{currentView.repositoryName}</h1>
            <p className="text-[0.7rem] text-content-muted font-mono mt-0.5">{repoUri}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                const targetRepo = repo || {
                  repositoryArn: `arn:aws:ecr:us-east-1:000000000000:repository/${currentView.repositoryName}`,
                  repositoryName: currentView.repositoryName,
                  repositoryUri: repoUri,
                  createdAt: new Date().toISOString(),
                  imageTagMutability: 'MUTABLE',
                  imageCount: images.length,
                };
                setPushCommandsRepo(targetRepo);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-surface-secondary border border-border-strong text-content-primary text-xs font-semibold rounded-lg hover:bg-surface-tertiary transition-colors shadow-xs"
            >
              <Terminal size={13} className="text-brand-primary" />
              View Push Commands
            </button>
            <button
              onClick={() => openPullModal(currentView.repositoryName)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-primary text-white text-xs font-semibold rounded-lg hover:opacity-90 transition-opacity shadow-xs"
            >
              <DownloadCloud size={13} />
              Pull / Import Image
            </button>
          </div>
        </div>

        {/* Push command box */}
        <div className="glass-card-base p-3 mb-5 flex items-center gap-3">
          <Terminal size={14} className="text-brand-primary shrink-0" />
          <span className="text-[0.65rem] font-bold text-content-muted uppercase tracking-wider shrink-0">Push:</span>
          <code className="text-[0.7rem] font-mono text-content-secondary truncate flex-1">{pushCommand}</code>
          <button
            onClick={() => handleCopy(pushCommand)}
            className="flex items-center gap-1 px-2.5 py-1 text-[0.65rem] font-semibold border border-border-strong rounded-md hover:bg-surface-tertiary transition-colors shrink-0 text-content-primary"
          >
            {copied
              ? <><Check size={11} className="text-status-success" /> Copied!</>
              : <><Copy size={11} /> Copy</>
            }
          </button>
        </div>

        {/* Images section */}
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold text-content-primary">Images</h2>
          {!imagesLoading && !imagesError && (
            <span className="text-xs text-content-muted">{images.length} {images.length === 1 ? 'image' : 'images'}</span>
          )}
        </div>

        {imagesLoading ? (
          <div className="glass-card-base p-4 flex flex-col gap-3">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-9" />)}
          </div>
        ) : imagesError ? (
          <div className="glass-card-base p-8 flex flex-col items-center gap-3 text-center">
            <AlertCircle size={24} className="text-status-error" />
            <p className="text-sm text-content-secondary">{imagesError}</p>
            <button
              onClick={() => setCurrentView({ ...currentView })}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold border border-border-strong rounded hover:bg-surface-tertiary transition-colors text-content-primary"
            >
              <RefreshCw size={12} /> Retry
            </button>
          </div>
        ) : images.length === 0 ? (
          <div className="glass-card-base p-10 flex flex-col items-center gap-3 text-center">
            <Layers size={30} className="text-content-muted" />
            <p className="text-sm font-semibold text-content-primary">No images in this repository</p>
            <p className="text-xs text-content-muted mb-2">Import a public image or push your local build using Docker:</p>
            <div className="flex items-center gap-3">
              <button
                onClick={() => openPullModal(currentView.repositoryName)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-primary text-white text-xs font-semibold rounded-lg hover:opacity-90 transition-opacity"
              >
                <DownloadCloud size={13} /> Pull Public Image
              </button>
              <button
                onClick={() => {
                  const targetRepo = repo || {
                    repositoryArn: `arn:aws:ecr:us-east-1:000000000000:repository/${currentView.repositoryName}`,
                    repositoryName: currentView.repositoryName,
                    repositoryUri: repoUri,
                    createdAt: new Date().toISOString(),
                    imageTagMutability: 'MUTABLE',
                    imageCount: 0,
                  };
                  setPushCommandsRepo(targetRepo);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 border border-border-strong text-content-primary text-xs font-semibold rounded-lg hover:bg-surface-tertiary transition-colors"
              >
                <Terminal size={13} /> View Push Commands
              </button>
            </div>
          </div>
        ) : (
          <div className="glass-card-base overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border-subtle bg-surface-tertiary/60">
                  <th className="px-4 py-2.5 text-left text-[0.6rem] font-bold text-content-muted uppercase tracking-wider">Digest</th>
                  <th className="px-4 py-2.5 text-left text-[0.6rem] font-bold text-content-muted uppercase tracking-wider">Tags</th>
                  <th className="px-4 py-2.5 text-left text-[0.6rem] font-bold text-content-muted uppercase tracking-wider">Size</th>
                  <th className="px-4 py-2.5 text-left text-[0.6rem] font-bold text-content-muted uppercase tracking-wider">Pushed</th>
                  <th className="px-4 py-2.5 w-10" />
                </tr>
              </thead>
              <tbody>
                {images.map((img, idx) => (
                  <tr
                    key={img.imageDigest}
                    className={`border-b border-border-subtle last:border-0 animate-fade-in ${idx % 2 === 1 ? 'bg-surface-tertiary/20' : ''}`}
                  >
                    <td className="px-4 py-2.5 font-mono text-[0.65rem] text-content-muted">
                      <span title={img.imageDigest}>
                        {img.imageDigest.substring(0, 20)}…
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex flex-wrap gap-1">
                        {img.imageTags && img.imageTags.length > 0
                          ? img.imageTags.map(tag => (
                              <span
                                key={tag}
                                className="flex items-center gap-0.5 px-1.5 py-0.5 bg-brand-primary/10 text-brand-primary text-[0.6rem] font-semibold rounded"
                              >
                                <Tag size={9} />{tag}
                              </span>
                            ))
                          : <span className="px-1.5 py-0.5 bg-content-muted/10 text-content-muted text-[0.6rem] font-semibold rounded">untagged</span>
                        }
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-content-secondary">{formatImageSize(img.imageSizeInBytes)}</td>
                    <td className="px-4 py-2.5 text-content-muted">{formatDate(img.imagePushedAt)}</td>
                    <td className="px-4 py-2.5">
                      <button
                        onClick={() => { setDeleteImageError(null); setDeleteImageConfirm(img); }}
                        className="p-1 text-content-muted hover:text-status-error hover:bg-status-error/10 rounded transition-colors"
                        title="Delete image"
                      >
                        <Trash2 size={13} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  };

  // ─── Push commands modal (AWS Console style) ──────────────────────────────────

  const renderPushCommandsModal = () => {
    if (!pushCommandsRepo) return null;
    const repoUri = pushCommandsRepo.repositoryUri || `localhost:9091/${pushCommandsRepo.repositoryName}`;
    const host = repoUri.split('/')[0] || 'localhost:9091';
    const repoName = pushCommandsRepo.repositoryName;

    const step1Cmd = `docker login ${host}`;
    const step2Cmd = `docker build -t ${repoName} .`;
    const step3Cmd = `docker tag ${repoName}:latest ${repoUri}:latest`;
    const step4Cmd = `docker push ${repoUri}:latest`;

    const allCommands = [
      `# 1. Docker Login (Optional)`,
      step1Cmd,
      `# 2. Build image`,
      step2Cmd,
      `# 3. Tag image`,
      step3Cmd,
      `# 4. Push image`,
      step4Cmd,
    ].join('\n');

    return createPortal(
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fade-in">
        <div className="bg-surface-secondary border border-border-strong rounded-xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-slide-up">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-border-subtle bg-surface-tertiary/40">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-brand-primary/10 text-brand-primary">
                <Terminal size={18} />
              </div>
              <div>
                <h2 className="text-sm font-bold text-content-primary">
                  Push commands for {repoName}
                </h2>
                <p className="text-[0.7rem] text-content-muted mt-0.5">
                  Follow these steps to build, tag, and push your Docker image to this repository.
                </p>
              </div>
            </div>
            <button
              onClick={() => setPushCommandsRepo(null)}
              className="text-content-muted hover:text-content-primary p-1 rounded-md transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          {/* OS Tabs */}
          <div className="px-6 pt-4 pb-2 border-b border-border-subtle/50 flex items-center justify-between bg-surface-secondary">
            <div className="flex items-center gap-1 p-1 bg-surface-tertiary rounded-lg border border-border-subtle">
              <button
                onClick={() => setPushCommandsTab('unix')}
                className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
                  pushCommandsTab === 'unix'
                    ? 'bg-surface-primary text-content-primary shadow-xs'
                    : 'text-content-muted hover:text-content-secondary'
                }`}
              >
                macOS / Linux
              </button>
              <button
                onClick={() => setPushCommandsTab('windows')}
                className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
                  pushCommandsTab === 'windows'
                    ? 'bg-surface-primary text-content-primary shadow-xs'
                    : 'text-content-muted hover:text-content-secondary'
                }`}
              >
                Windows
              </button>
            </div>

            <button
              onClick={() => handleCopyStep(allCommands, 'all')}
              className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold border border-border-strong rounded-lg hover:bg-surface-tertiary text-content-secondary hover:text-content-primary transition-colors"
            >
              {copiedStep === 'all' ? (
                <>
                  <Check size={13} className="text-status-success" />
                  <span className="text-status-success">All Copied!</span>
                </>
              ) : (
                <>
                  <Copy size={13} />
                  <span>Copy All Commands</span>
                </>
              )}
            </button>
          </div>

          {/* Steps List */}
          <div className="px-6 py-4 overflow-y-auto space-y-4 flex-1">
            {/* Step 1 */}
            <div className="border border-border-subtle rounded-lg p-3.5 bg-surface-primary/60">
              <div className="flex items-center gap-2 mb-1.5">
                <span className="w-5 h-5 rounded-full bg-brand-primary/10 text-brand-primary text-[0.65rem] font-bold flex items-center justify-center shrink-0">
                  1
                </span>
                <span className="text-xs font-bold text-content-primary">
                  Retrieve an authentication token and authenticate your Docker client (Optional)
                </span>
              </div>
              <p className="text-[0.7rem] text-content-muted mb-2 ml-7">
                Ministack ECR supports direct local pushes without authentication, but you can authenticate with:
              </p>
              <div className="flex items-center gap-2 ml-7 bg-surface-tertiary border border-border-subtle rounded-md px-3 py-2">
                <code className="text-[0.75rem] font-mono text-content-secondary flex-1 truncate">{step1Cmd}</code>
                <button
                  onClick={() => handleCopyStep(step1Cmd, 1)}
                  className="p-1 text-content-muted hover:text-content-primary transition-colors shrink-0"
                  title="Copy command"
                >
                  {copiedStep === 1 ? <Check size={14} className="text-status-success" /> : <Copy size={14} />}
                </button>
              </div>
            </div>

            {/* Step 2 */}
            <div className="border border-border-subtle rounded-lg p-3.5 bg-surface-primary/60">
              <div className="flex items-center gap-2 mb-1.5">
                <span className="w-5 h-5 rounded-full bg-brand-primary/10 text-brand-primary text-[0.65rem] font-bold flex items-center justify-center shrink-0">
                  2
                </span>
                <span className="text-xs font-bold text-content-primary">
                  Build your Docker image
                </span>
              </div>
              <p className="text-[0.7rem] text-content-muted mb-2 ml-7">
                Run the following command to build your Docker image using the Dockerfile in your current directory:
              </p>
              <div className="flex items-center gap-2 ml-7 bg-surface-tertiary border border-border-subtle rounded-md px-3 py-2">
                <code className="text-[0.75rem] font-mono text-content-secondary flex-1 truncate">{step2Cmd}</code>
                <button
                  onClick={() => handleCopyStep(step2Cmd, 2)}
                  className="p-1 text-content-muted hover:text-content-primary transition-colors shrink-0"
                  title="Copy command"
                >
                  {copiedStep === 2 ? <Check size={14} className="text-status-success" /> : <Copy size={14} />}
                </button>
              </div>
            </div>

            {/* Step 3 */}
            <div className="border border-border-subtle rounded-lg p-3.5 bg-surface-primary/60">
              <div className="flex items-center gap-2 mb-1.5">
                <span className="w-5 h-5 rounded-full bg-brand-primary/10 text-brand-primary text-[0.65rem] font-bold flex items-center justify-center shrink-0">
                  3
                </span>
                <span className="text-xs font-bold text-content-primary">
                  Tag your image for the Ministack ECR repository
                </span>
              </div>
              <p className="text-[0.7rem] text-content-muted mb-2 ml-7">
                Tag your image so you can push it to this specific repository:
              </p>
              <div className="flex items-center gap-2 ml-7 bg-surface-tertiary border border-border-subtle rounded-md px-3 py-2">
                <code className="text-[0.75rem] font-mono text-content-secondary flex-1 truncate">{step3Cmd}</code>
                <button
                  onClick={() => handleCopyStep(step3Cmd, 3)}
                  className="p-1 text-content-muted hover:text-content-primary transition-colors shrink-0"
                  title="Copy command"
                >
                  {copiedStep === 3 ? <Check size={14} className="text-status-success" /> : <Copy size={14} />}
                </button>
              </div>
            </div>

            {/* Step 4 */}
            <div className="border border-border-subtle rounded-lg p-3.5 bg-surface-primary/60">
              <div className="flex items-center gap-2 mb-1.5">
                <span className="w-5 h-5 rounded-full bg-brand-primary/10 text-brand-primary text-[0.65rem] font-bold flex items-center justify-center shrink-0">
                  4
                </span>
                <span className="text-xs font-bold text-content-primary">
                  Push this image to your Ministack ECR repository
                </span>
              </div>
              <p className="text-[0.7rem] text-content-muted mb-2 ml-7">
                Run the following command to push the image to Ministack:
              </p>
              <div className="flex items-center gap-2 ml-7 bg-surface-tertiary border border-border-subtle rounded-md px-3 py-2">
                <code className="text-[0.75rem] font-mono text-content-secondary flex-1 truncate">{step4Cmd}</code>
                <button
                  onClick={() => handleCopyStep(step4Cmd, 4)}
                  className="p-1 text-content-muted hover:text-content-primary transition-colors shrink-0"
                  title="Copy command"
                >
                  {copiedStep === 4 ? <Check size={14} className="text-status-success" /> : <Copy size={14} />}
                </button>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex justify-end px-6 py-3.5 border-t border-border-subtle bg-surface-tertiary/20">
            <button
              onClick={() => setPushCommandsRepo(null)}
              className="px-4 py-1.5 text-xs font-semibold bg-surface-primary border border-border-strong text-content-primary rounded-lg hover:bg-surface-tertiary transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>,
      document.body
    );
  };

  // ─── Pull / Import Image modal ───────────────────────────────────────────────

  const renderPullModal = () => showPullModal && createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fade-in">
      <div className="bg-surface-secondary border border-border-strong rounded-xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-slide-up">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border-subtle bg-surface-tertiary/40">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-brand-primary/10 text-brand-primary">
              <DownloadCloud size={18} />
            </div>
            <div>
              <h2 className="text-sm font-bold text-content-primary">Pull / Import Image</h2>
              <p className="text-[0.7rem] text-content-muted mt-0.5">
                Download public images from Docker Hub into Ministack ECR
              </p>
            </div>
          </div>
          <button
            onClick={() => !pulling && setShowPullModal(false)}
            disabled={pulling}
            className="text-content-muted hover:text-content-primary p-1 rounded-md transition-colors disabled:opacity-40"
          >
            <X size={18} />
          </button>
        </div>

        {/* Form Body */}
        <div className="px-6 py-4 flex flex-col gap-4 overflow-y-auto">
          {/* Quick templates */}
          <div>
            <label className="block text-[0.65rem] font-bold text-content-muted uppercase tracking-wider mb-2">
              Popular Test Images
            </label>
            <div className="grid grid-cols-2 gap-2">
              {POPULAR_PULL_TEMPLATES.map(item => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setPullSourceImage(item.image);
                    setPullTag(item.tag);
                    if (currentView.type === 'repositories') {
                      setPullTargetRepo(item.repo);
                    }
                  }}
                  className={`p-2.5 text-left rounded-lg border text-xs transition-all cursor-pointer ${
                    pullSourceImage === item.image
                      ? 'bg-brand-primary/10 border-brand-primary text-content-primary shadow-xs'
                      : 'bg-surface-primary border-border-subtle text-content-secondary hover:border-brand-primary/40 hover:bg-surface-tertiary'
                  }`}
                >
                  <div className="font-semibold text-content-primary text-[0.75rem]">{item.name}</div>
                  <div className="text-[0.65rem] font-mono text-content-muted truncate mt-0.5">{item.image}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Local Images from Machine */}
          {localDockerImages.length > 0 && (
            <div className="border-t border-border-subtle/50 pt-3">
              <label className="flex items-center gap-1 text-[0.65rem] font-bold text-content-muted uppercase tracking-wider mb-2">
                <HardDrive size={12} className="text-blue-500" />
                <span>Images on your machine ({localDockerImages.length}):</span>
              </label>
              <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto pr-1">
                {localDockerImages.map(img => (
                  <button
                    key={img}
                    type="button"
                    onClick={() => {
                      setPullSourceImage(img);
                      let tag = 'latest';
                      let base = img;
                      if (img.includes(':')) {
                        tag = img.split(':').pop() || 'latest';
                        base = img.split(':')[0];
                      }
                      if (base.includes('/')) {
                        base = base.split('/').pop() || base;
                      }
                      setPullTag(tag);
                      if (currentView.type === 'repositories') {
                        setPullTargetRepo(base);
                      }
                    }}
                    className={`text-[10px] font-mono px-2 py-1 rounded border transition-colors cursor-pointer flex items-center gap-1 ${
                      pullSourceImage === img
                        ? 'bg-blue-500/15 border-blue-500 text-blue-600 dark:text-blue-400 font-bold'
                        : 'border-border-subtle bg-surface-primary hover:border-blue-500/50 text-content-secondary hover:text-content-primary'
                    }`}
                  >
                    <HardDrive size={10} className="text-blue-500" />
                    <span>{img}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Target Repository */}
          <div>
            <label className="block text-[0.65rem] font-bold text-content-secondary uppercase tracking-wider mb-1.5">
              Target ECR Repository <span className="text-status-error">*</span>
            </label>
            {currentView.type === 'repository-detail' ? (
              <input
                type="text"
                disabled
                value={currentView.repositoryName}
                className="w-full bg-surface-tertiary border border-border-strong rounded px-3 py-2 text-xs text-content-muted font-mono"
              />
            ) : (
              <div className="space-y-1.5">
                <input
                  type="text"
                  value={pullTargetRepo}
                  onChange={e => setPullTargetRepo(e.target.value)}
                  placeholder="e.g., hello-kubernetes"
                  className="w-full bg-surface-primary border border-border-strong rounded px-3 py-2 text-xs text-content-primary focus:outline-none focus:border-brand-primary placeholder:text-content-muted"
                />
                {repositories.length > 0 && (
                  <div className="flex flex-wrap gap-1 items-center mt-1">
                    <span className="text-[0.65rem] text-content-muted">Existing repos:</span>
                    {repositories.map(r => (
                      <button
                        key={r.repositoryName}
                        type="button"
                        onClick={() => setPullTargetRepo(r.repositoryName)}
                        className={`text-[0.65rem] px-1.5 py-0.5 rounded border transition-colors ${
                          pullTargetRepo === r.repositoryName
                            ? 'bg-brand-primary/20 border-brand-primary text-brand-primary'
                            : 'bg-surface-tertiary border-border-subtle text-content-muted hover:text-content-primary'
                        }`}
                      >
                        {r.repositoryName}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Source Image */}
          <div>
            <label className="block text-[0.65rem] font-bold text-content-secondary uppercase tracking-wider mb-1.5">
              Source Image <span className="text-status-error">*</span>
            </label>
            <input
              type="text"
              value={pullSourceImage}
              onChange={e => {
                setPullSourceImage(e.target.value);
                if (currentView.type === 'repositories' && !pullTargetRepo) {
                  let clean = e.target.value.trim();
                  if (clean.includes(':')) clean = clean.split(':')[0];
                  if (clean.includes('/')) clean = clean.split('/').pop() || clean;
                  setPullTargetRepo(clean);
                }
              }}
              placeholder="e.g. paulbouwer/hello-kubernetes:1.10, redis:alpine, nginx"
              className="w-full bg-surface-primary border border-border-strong rounded px-3 py-2 text-xs text-content-primary focus:outline-none focus:border-brand-primary placeholder:text-content-muted font-mono"
            />
          </div>

          {/* Tag */}
          <div>
            <label className="block text-[0.65rem] font-bold text-content-secondary uppercase tracking-wider mb-1.5">
              Tag <span className="text-content-muted font-normal">(Optional, defaults to image tag or 'latest')</span>
            </label>
            <input
              type="text"
              value={pullTag}
              onChange={e => setPullTag(e.target.value)}
              placeholder="latest"
              className="w-full bg-surface-primary border border-border-strong rounded px-3 py-2 text-xs text-content-primary focus:outline-none focus:border-brand-primary placeholder:text-content-muted font-mono"
            />
          </div>

          {/* Pulling status feedback */}
          {pulling && (
            <div className="flex items-center gap-3 p-3 bg-brand-primary/10 border border-brand-primary/20 rounded-lg text-content-primary text-xs animate-pulse">
              <RefreshCw size={16} className="animate-spin text-brand-primary shrink-0" />
              <div>
                <p className="font-semibold text-brand-primary">Pulling image from registry...</p>
                <p className="text-[0.65rem] text-content-muted mt-0.5">
                  Downloading layers and registering in Ministack ECR. This may take a moment.
                </p>
              </div>
            </div>
          )}

          {/* Error display */}
          {pullError && (
            <div className="flex items-center gap-2 p-3 bg-status-error/10 border border-status-error/20 rounded-lg text-status-error text-xs">
              <AlertCircle size={15} className="shrink-0" />
              <span>{pullError}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-6 py-4 border-t border-border-subtle bg-surface-tertiary/20">
          <button
            onClick={() => setShowPullModal(false)}
            disabled={pulling}
            className="px-3 py-1.5 text-xs text-content-secondary border border-border-strong rounded-lg hover:bg-surface-tertiary transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handlePullImage}
            disabled={pulling || !pullSourceImage.trim()}
            className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold bg-brand-primary text-white rounded-lg hover:opacity-90 disabled:opacity-50 transition-all shadow-sm cursor-pointer"
          >
            {pulling ? (
              <>
                <RefreshCw size={13} className="animate-spin" />
                Pulling Image…
              </>
            ) : (
              <>
                <DownloadCloud size={13} />
                Pull & Import
              </>
            )}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );

  // ─── Create modal ────────────────────────────────────────────────────────────

  const renderCreateModal = () => showCreateModal && createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in">
      <div className="bg-surface-secondary border border-border-strong rounded-lg w-full max-w-md shadow-2xl animate-slide-up">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border-subtle">
          <h2 className="text-sm font-bold text-content-primary">Create Repository</h2>
          <button onClick={() => setShowCreateModal(false)} className="text-content-muted hover:text-content-primary transition-colors p-0.5">
            <X size={16} />
          </button>
        </div>

        <div className="px-5 py-4 flex flex-col gap-4">
          <div>
            <label className="block text-[0.65rem] font-bold text-content-secondary uppercase tracking-wider mb-1.5">
              Repository Name <span className="text-status-error">*</span>
            </label>
            <input
              type="text"
              value={createName}
              onChange={e => { setCreateName(e.target.value); setNameError(null); }}
              onKeyDown={e => e.key === 'Enter' && handleCreateRepository()}
              className="w-full bg-surface-primary border border-border-strong rounded px-3 py-2 text-xs text-content-primary focus:outline-none focus:border-brand-primary placeholder:text-content-muted"
              placeholder="my-repository"
              autoFocus
            />
            {nameError && <p className="text-[0.65rem] text-status-error mt-1.5">{nameError}</p>}
          </div>

          <div>
            <label className="block text-[0.65rem] font-bold text-content-secondary uppercase tracking-wider mb-1.5">
              Tag Mutability
            </label>
            <select
              value={createMutability}
              onChange={e => setCreateMutability(e.target.value as 'MUTABLE' | 'IMMUTABLE')}
              className="w-full bg-surface-primary border border-border-strong rounded px-3 py-2 text-xs text-content-primary focus:outline-none focus:border-brand-primary"
            >
              <option value="MUTABLE">MUTABLE</option>
              <option value="IMMUTABLE">IMMUTABLE</option>
            </select>
          </div>

          {createError && (
            <div className="flex items-center gap-2 p-2.5 bg-status-error/10 border border-status-error/20 rounded text-status-error text-xs">
              <AlertCircle size={13} className="shrink-0" /> {createError}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 px-5 py-4 border-t border-border-subtle">
          <button
            onClick={() => setShowCreateModal(false)}
            className="px-3 py-1.5 text-xs text-content-secondary border border-border-strong rounded hover:bg-surface-tertiary transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleCreateRepository}
            disabled={creating}
            className="px-3 py-1.5 text-xs font-semibold bg-brand-primary text-white rounded hover:opacity-90 disabled:opacity-50 transition-opacity cursor-pointer"
          >
            {creating ? 'Creating…' : 'Create'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );

  // ─── Delete repo dialog ──────────────────────────────────────────────────────

  const renderDeleteDialog = () => deleteConfirm && createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in">
      <div className="bg-surface-secondary border border-border-strong rounded-lg w-full max-w-sm shadow-2xl animate-slide-up">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border-subtle">
          <h2 className="text-sm font-bold text-content-primary">Delete Repository</h2>
          <button onClick={() => setDeleteConfirm(null)} className="text-content-muted hover:text-content-primary transition-colors p-0.5">
            <X size={16} />
          </button>
        </div>

        <div className="px-5 py-4">
          <p className="text-xs text-content-secondary">
            Are you sure you want to delete{' '}
            <span className="font-bold text-content-primary">{deleteConfirm.repositoryName}</span>?
            This action cannot be undone.
          </p>
          {deleteError && (
            <div className="flex items-center gap-2 p-2.5 mt-3 bg-status-error/10 border border-status-error/20 rounded text-status-error text-xs">
              <AlertCircle size={13} className="shrink-0" /> {deleteError}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 px-5 py-4 border-t border-border-subtle">
          <button
            onClick={() => setDeleteConfirm(null)}
            className="px-3 py-1.5 text-xs text-content-secondary border border-border-strong rounded hover:bg-surface-tertiary transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleDeleteRepository}
            disabled={deleting}
            className="px-3 py-1.5 text-xs font-semibold bg-status-error text-white rounded hover:opacity-90 disabled:opacity-50 transition-opacity cursor-pointer"
          >
            {deleting ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );

  // ─── Delete image dialog ─────────────────────────────────────────────────────

  const renderDeleteImageDialog = () => deleteImageConfirm && createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in">
      <div className="bg-surface-secondary border border-border-strong rounded-lg w-full max-w-sm shadow-2xl animate-slide-up">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border-subtle">
          <h2 className="text-sm font-bold text-content-primary">Delete Image</h2>
          <button onClick={() => setDeleteImageConfirm(null)} className="text-content-muted hover:text-content-primary transition-colors p-0.5">
            <X size={16} />
          </button>
        </div>

        <div className="px-5 py-4">
          <p className="text-xs text-content-secondary mb-3">Are you sure you want to delete this image? This action cannot be undone.</p>
          <div className="bg-surface-tertiary border border-border-subtle rounded p-2.5 font-mono text-[0.65rem] text-content-muted break-all">
            {deleteImageConfirm.imageDigest.substring(0, 36)}…
          </div>
          {deleteImageConfirm.imageTags && deleteImageConfirm.imageTags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {deleteImageConfirm.imageTags.map(tag => (
                <span key={tag} className="px-1.5 py-0.5 bg-brand-primary/10 text-brand-primary text-[0.6rem] font-semibold rounded">{tag}</span>
              ))}
            </div>
          )}
          {deleteImageError && (
            <div className="flex items-center gap-2 p-2.5 mt-3 bg-status-error/10 border border-status-error/20 rounded text-status-error text-xs">
              <AlertCircle size={13} className="shrink-0" /> {deleteImageError}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 px-5 py-4 border-t border-border-subtle">
          <button
            onClick={() => setDeleteImageConfirm(null)}
            className="px-3 py-1.5 text-xs text-content-secondary border border-border-strong rounded hover:bg-surface-tertiary transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleDeleteImage}
            disabled={deletingImage}
            className="px-3 py-1.5 text-xs font-semibold bg-status-error text-white rounded hover:opacity-90 disabled:opacity-50 transition-opacity cursor-pointer"
          >
            {deletingImage ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col w-full">
      {renderBreadcrumb()}
      <div className="mt-4">
        {currentView.type === 'repositories' ? renderRepositories() : renderRepositoryDetail()}
      </div>
      {renderCreateModal()}
      {renderPullModal()}
      {renderPushCommandsModal()}
      {renderDeleteDialog()}
      {renderDeleteImageDialog()}
    </div>
  );
};
