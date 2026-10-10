import { useState, useEffect, useRef } from 'react';
import {
  Plus,
  Trash2,
  ChevronRight,
  AlertCircle,
  Square,
  ChevronDown,
  Play,
  RefreshCw,
  ArrowLeft,
  ArrowRight,
  Server,
  Clock,
  Terminal,
  ExternalLink,
  Copy,
  Check,
  Code,
  Sliders,
  Package,
  Sparkles,
  Lightbulb,
  Pencil,
  HardDrive,
} from 'lucide-react';
import { ecsService } from '../services/ecsService';
import { ecrService } from '../../ecr/services/ecrService';
import type { ECRRepository } from '../../ecr/types';
import type {
  ECSCluster,
  ECSService,
  ECSTask,
  TaskDefinitionFamily,
  ECSView,
  CreateClusterRequest,
  CreateServiceRequest,
  RegisterTaskDefinitionRequest,
  RunTaskRequest,
  TaskInspectResponse,
  PortMapping,
  EnvironmentVariable,
} from '../types';
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";

export function ECSDashboard() {
  const [currentView, setCurrentView] = useState<ECSView>({ type: 'clusters' });
  const [clusters, setClusters] = useState<ECSCluster[]>([]);
  const [services, setServices] = useState<ECSService[]>([]);
  const [tasks, setTasks] = useState<ECSTask[]>([]);
  const [taskDefinitions, setTaskDefinitions] = useState<TaskDefinitionFamily[]>([]);
  const [selectedCluster, setSelectedCluster] = useState<ECSCluster | null>(null);
  const [selectedService, setSelectedService] = useState<ECSService | null>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Modals state
  const [showCreateCluster, setShowCreateCluster] = useState(false);
  const [showCreateService, setShowCreateService] = useState(false);
  const [showRegisterTaskDef, setShowRegisterTaskDef] = useState(false);
  const [showRunTask, setShowRunTask] = useState(false);
  const [showDeleteCluster, setShowDeleteCluster] = useState<string | null>(null);
  const [showDeleteService, setShowDeleteService] = useState<string | null>(null);
  const [showStopTask, setShowStopTask] = useState<string | null>(null);
  const [showForceDeployment, setShowForceDeployment] = useState(false);
  const [showDeregisterTaskDef, setShowDeregisterTaskDef] = useState<{ family: string; revision: number } | null>(null);
  const [isEditingTaskDef, setIsEditingTaskDef] = useState(false);

  // Log Viewer Modal state
  const [activeLogTask, setActiveLogTask] = useState<ECSTask | null>(null);
  // Inspect Modal state
  const [activeInspectTask, setActiveInspectTask] = useState<ECSTask | null>(null);

  const [editingDesiredCount, setEditingDesiredCount] = useState<number | null>(null);
  const [expandedFamilies, setExpandedFamilies] = useState<Set<string>>(new Set());

  // Forms
  const [clusterForm, setClusterForm] = useState({ name: '' });
  const [serviceForm, setServiceForm] = useState({ name: '', taskDefinition: '', desiredCount: 1 });
  const [taskDefForm, setTaskDefForm] = useState({
    family: '',
    cpu: '256',
    memory: '512',
    networkMode: 'awsvpc' as 'awsvpc' | 'bridge',
    containerName: '',
    image: '',
    containerCpu: 256,
    containerMemory: 512,
    portMappings: [] as PortMapping[],
    environment: [] as EnvironmentVariable[],
  });
  const [runTaskForm, setRunTaskForm] = useState<{
    taskDefinition: string;
    count: number;
    environment: EnvironmentVariable[];
  }>({
    taskDefinition: '',
    count: 1,
    environment: [],
  });

  const loadDataForView = async () => {
    setIsLoading(true);
    setError(null);

    try {
      if (currentView.type === 'clusters') {
        const data = await ecsService.getClusters();
        setClusters(data);
      } else if (currentView.type === 'cluster-detail') {
        const clusterData = await ecsService.getClusters();
        const cluster = clusterData.find((c) => c.clusterName === currentView.clusterName);
        setSelectedCluster(cluster || null);

        // Preload task definitions for Run Task dropdown
        const taskDefs = await ecsService.getTaskDefinitions();
        setTaskDefinitions(taskDefs);

        if (currentView.tab === 'services') {
          const svc = await ecsService.getServices(currentView.clusterName);
          setServices(svc);
        } else if (currentView.tab === 'tasks') {
          const tsk = await ecsService.getTasks(currentView.clusterName);
          setTasks(tsk);
        }
      } else if (currentView.type === 'service-detail') {
        const svc = await ecsService.getServices(currentView.clusterName);
        const service = svc.find((s) => s.serviceName === currentView.serviceName);
        setSelectedService(service || null);
      } else if (currentView.type === 'task-definitions') {
        const taskDefs = await ecsService.getTaskDefinitions();
        setTaskDefinitions(taskDefs);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  };

  // Load data based on current view
  useEffect(() => {
    loadDataForView();
  }, [currentView]);

  // Breadcrumb navigation
  const renderBreadcrumb = () => {
    return (
      <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-content-muted/80 mb-2">
        <button
          onClick={() => setCurrentView({ type: 'clusters' })}
          className="hover:text-brand-primary transition-colors cursor-pointer bg-transparent border-0 p-0"
        >
          Console
        </button>
        <span className="text-[9px] text-content-muted/40 font-normal">/</span>
        <button
          onClick={() => setCurrentView({ type: 'clusters' })}
          className="hover:text-brand-primary transition-colors cursor-pointer bg-transparent border-0 p-0"
        >
          ECS
        </button>
        {currentView.type === 'cluster-detail' && (
          <>
            <span className="text-[9px] text-content-muted/40 font-normal">/</span>
            <button
              onClick={() => setCurrentView({ type: 'clusters' })}
              className="hover:text-brand-primary transition-colors cursor-pointer bg-transparent border-0 p-0"
            >
              Clusters
            </button>
            <span className="text-[9px] text-content-muted/40 font-normal">/</span>
            <span className="text-brand-primary">{currentView.clusterName}</span>
            <span className="text-[9px] text-content-muted/40 font-normal">/</span>
            <span className="text-content-muted/50 font-normal">{currentView.tab === 'services' ? 'Services' : 'Tasks'}</span>
          </>
        )}
        {currentView.type === 'service-detail' && (
          <>
            <span className="text-[9px] text-content-muted/40 font-normal">/</span>
            <button
              onClick={() => setCurrentView({ type: 'clusters' })}
              className="hover:text-brand-primary transition-colors cursor-pointer bg-transparent border-0 p-0"
            >
              Clusters
            </button>
            <span className="text-[9px] text-content-muted/40 font-normal">/</span>
            <button
              onClick={() =>
                setCurrentView({
                  type: 'cluster-detail',
                  clusterName: currentView.clusterName,
                  tab: 'services',
                })
              }
              className="hover:text-brand-primary transition-colors cursor-pointer bg-transparent border-0 p-0"
            >
              {currentView.clusterName}
            </button>
            <span className="text-[9px] text-content-muted/40 font-normal">/</span>
            <span className="text-brand-primary">{currentView.serviceName}</span>
          </>
        )}
        {currentView.type === 'task-definitions' && (
          <>
            <span className="text-[9px] text-content-muted/40 font-normal">/</span>
            <span className="text-brand-primary">Task Definitions</span>
          </>
        )}
        {currentView.type === 'clusters' && (
          <>
            <span className="text-[9px] text-content-muted/40 font-normal">/</span>
            <span className="text-brand-primary">Clusters</span>
          </>
        )}
      </div>
    );
  };

  // Cluster operations
  const handleCreateCluster = async () => {
    if (!clusterForm.name.trim()) {
      setError('Cluster name is required');
      return;
    }
    if (/\s/.test(clusterForm.name)) {
      setError('Cluster name cannot contain spaces');
      return;
    }

    try {
      const req: CreateClusterRequest = { name: clusterForm.name };
      await ecsService.createCluster(req);
      setClusterForm({ name: '' });
      setShowCreateCluster(false);
      await loadDataForView();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create cluster');
    }
  };

  const handleDeleteCluster = async (name: string) => {
    try {
      await ecsService.deleteCluster(name);
      setShowDeleteCluster(null);
      await loadDataForView();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete cluster');
    }
  };

  // Service operations
  const handleCreateService = async () => {
    if (!serviceForm.name.trim() || !serviceForm.taskDefinition.trim()) {
      setError('Service name and task definition are required');
      return;
    }
    if (serviceForm.desiredCount < 1) {
      setError('Desired count must be at least 1');
      return;
    }

    if (currentView.type !== 'cluster-detail') return;

    try {
      const req: CreateServiceRequest = {
        name: serviceForm.name,
        taskDefinition: serviceForm.taskDefinition,
        desiredCount: serviceForm.desiredCount,
      };
      await ecsService.createService(currentView.clusterName, req);
      setServiceForm({ name: '', taskDefinition: '', desiredCount: 1 });
      setShowCreateService(false);
      await loadDataForView();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create service');
    }
  };

  const handleUpdateServiceDesiredCount = async (desiredCount: number) => {
    if (currentView.type !== 'service-detail' || !selectedService) return;

    try {
      await ecsService.updateService(currentView.clusterName, currentView.serviceName, {
        desiredCount,
      });
      setEditingDesiredCount(null);
      await loadDataForView();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update service');
    }
  };

  const handleForceNewDeployment = async () => {
    if (currentView.type !== 'service-detail') return;

    try {
      await ecsService.forceNewDeployment(currentView.clusterName, currentView.serviceName);
      setShowForceDeployment(false);
      await loadDataForView();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to force deployment');
    }
  };

  const handleDeleteService = async (serviceName: string) => {
    if (currentView.type !== 'cluster-detail') return;

    try {
      await ecsService.deleteService(currentView.clusterName, serviceName);
      setShowDeleteService(null);
      await loadDataForView();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete service');
    }
  };

  // Task operations
  const handleRunTask = async () => {
    if (currentView.type !== 'cluster-detail') return;
    if (!runTaskForm.taskDefinition.trim()) {
      setError('Task Definition is required');
      return;
    }

    try {
      const validEnvs = runTaskForm.environment.filter((e) => e.name.trim() !== '');
      const req: RunTaskRequest = {
        taskDefinition: runTaskForm.taskDefinition,
        count: runTaskForm.count || 1,
        overrides: validEnvs.length > 0 ? {
          containerOverrides: [
            {
              environment: validEnvs,
            },
          ],
        } : undefined,
      };

      await ecsService.runTask(currentView.clusterName, req);
      setShowRunTask(false);
      setRunTaskForm({ taskDefinition: '', count: 1, environment: [] });
      await loadDataForView();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to run task');
    }
  };

  const handleStopTask = async (taskArn: string) => {
    try {
      await ecsService.stopTask(taskArn);
      setShowStopTask(null);
      await loadDataForView();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to stop task');
    }
  };

  // Task Definition operations
  const handleOpenNewTaskDefModal = () => {
    setIsEditingTaskDef(false);
    setTaskDefForm({
      family: '',
      cpu: '256',
      memory: '512',
      networkMode: 'awsvpc',
      containerName: '',
      image: '',
      containerCpu: 256,
      containerMemory: 512,
      portMappings: [],
      environment: [],
    });
    setShowRegisterTaskDef(true);
  };

  const handleEditTaskDefRevision = (family: string, revision: any) => {
    setIsEditingTaskDef(true);
    setTaskDefForm({
      family: family,
      cpu: revision.cpu || '256',
      memory: revision.memory || '512',
      networkMode: revision.networkMode || 'awsvpc',
      containerName: revision.container?.name || family,
      image: revision.container?.image || '',
      containerCpu: revision.container?.cpu || 256,
      containerMemory: revision.container?.memory || 512,
      portMappings: revision.container?.portMappings ? [...revision.container.portMappings] : [],
      environment: revision.container?.environment ? [...revision.container.environment] : [],
    });
    setShowRegisterTaskDef(true);
  };

  const handleRegisterTaskDefinition = async () => {
    if (!taskDefForm.family.trim() || !taskDefForm.image.trim()) {
      setError('Family and image are required');
      return;
    }

    try {
      const req: RegisterTaskDefinitionRequest = {
        family: taskDefForm.family,
        cpu: taskDefForm.cpu,
        memory: taskDefForm.memory,
        networkMode: taskDefForm.networkMode,
        container: {
          name: taskDefForm.containerName || taskDefForm.family,
          image: taskDefForm.image,
          cpu: taskDefForm.containerCpu,
          memory: taskDefForm.containerMemory,
          portMappings: taskDefForm.portMappings,
          environment: taskDefForm.environment,
        },
      };
      await ecsService.registerTaskDefinition(req);
      setTaskDefForm({
        family: '',
        cpu: '256',
        memory: '512',
        networkMode: 'awsvpc',
        containerName: '',
        image: '',
        containerCpu: 256,
        containerMemory: 512,
        portMappings: [],
        environment: [],
      });
      setShowRegisterTaskDef(false);
      await loadDataForView();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to register task definition');
    }
  };

  const handleDeregisterTaskDef = async (family: string, revision: number) => {
    try {
      await ecsService.deregisterTaskDefinition(family, revision);
      setShowDeregisterTaskDef(null);
      await loadDataForView();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to deregister task definition');
    }
  };

  // Views rendering
  const renderClustersView = () => {
    if (isLoading) {
      return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 animate-pulse">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-48 rounded-xl" />
          ))}
        </div>
      );
    }

    if (error && clusters.length === 0) {
      return (
        <div className="rounded-xl border border-border bg-card p-6 text-center">
          <AlertCircle className="mx-auto mb-4 h-8 w-8 text-status-error" />
          <p className="text-content-primary font-semibold mb-2">Failed to load clusters</p>
          <p className="text-content-muted text-xs mb-4">{error}</p>
          <Button
            onClick={() => loadDataForView()}
            className="bg-brand-primary hover:bg-brand-primary/95 text-white font-semibold text-xs border-0 cursor-pointer"
            size="sm"
          >
            Retry
          </Button>
        </div>
      );
    }

    if (clusters.length === 0) {
      return (
        <Card className="flex flex-col items-center justify-center p-12 text-center border border-dashed border-border-strong/60 bg-card/40 backdrop-blur-xs min-h-[320px] rounded-2xl">
          <div className="w-12 h-12 rounded-xl bg-brand-primary/10 border border-brand-primary/20 text-brand-primary flex items-center justify-center mb-4">
            <Server size={22} />
          </div>
          <h3 className="m-0 text-base font-bold text-content-primary">No clusters found</h3>
          <p className="mt-2 text-xs text-content-secondary max-w-sm leading-relaxed m-0">
            Amazon ECS is a fully managed container orchestration service. Create an ECS cluster to run containerized applications and services.
          </p>
          <Button
            onClick={() => setShowCreateCluster(true)}
            className="mt-6 bg-brand-primary hover:bg-brand-primary/95 text-white gap-2 font-semibold shadow-md border-0 px-5 active:scale-95 transition-all cursor-pointer"
          >
            <Plus size={15} />
            Create Cluster
          </Button>
        </Card>
      );
    }

    return (
      <div className="space-y-4 animate-fade-in">
        <div className="flex justify-between items-center">
          <h2 className="text-base font-bold text-content-primary tracking-tight">Clusters</h2>
          <Button
            onClick={() => setShowCreateCluster(true)}
            className="bg-brand-primary hover:bg-brand-primary/95 text-white gap-2 font-semibold shadow-sm border-0 cursor-pointer"
            size="sm"
          >
            <Plus size={14} />
            Create Cluster
          </Button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {clusters.map((cluster) => (
            <Card
              key={cluster.clusterArn}
              className="relative flex flex-col h-full border border-border-subtle bg-card hover:bg-accent/5 hover:shadow-md hover:border-brand-primary/30 transition-all duration-300 rounded-xl overflow-hidden group/card"
            >
              <div className="p-5 flex flex-col h-full gap-4">
                <div className="flex justify-between items-start">
                  <div
                    className="flex-1 cursor-pointer"
                    onClick={() =>
                      setCurrentView({
                        type: 'cluster-detail',
                        clusterName: cluster.clusterName,
                        tab: 'services',
                      })
                    }
                  >
                    <h3 className="m-0 text-sm font-bold text-content-primary group-hover/card:text-brand-primary transition-colors flex items-center gap-1.5">
                      {cluster.clusterName}
                      <ArrowRight size={12} className="opacity-0 -translate-x-1 group-hover/card:opacity-100 group-hover/card:translate-x-0 transition-all text-brand-primary" />
                    </h3>
                    <div className="flex items-center gap-1.5 mt-1">
                      <Badge
                        variant="outline"
                        className={cn(
                          "h-5 px-2 rounded-full font-bold text-[8px] uppercase tracking-wider gap-1",
                          cluster.status === 'ACTIVE'
                            ? "bg-emerald-500/5 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                            : "bg-muted text-content-muted border-border/40"
                        )}
                      >
                        <span className={cn("w-1 h-1 rounded-full", cluster.status === 'ACTIVE' ? "bg-emerald-500 animate-pulse" : "bg-content-muted")} />
                        {cluster.status}
                      </Badge>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => setShowDeleteCluster(cluster.clusterName)}
                    className="h-8 w-8 text-content-muted hover:text-destructive hover:bg-destructive/10 rounded-md cursor-pointer border-0"
                  >
                    <Trash2 size={14} />
                  </Button>
                </div>

                <div className="grid grid-cols-3 gap-2 py-3 border-y border-border-subtle/50 text-center">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[10px] font-semibold text-content-muted uppercase tracking-wider">Services</span>
                    <span className="text-sm font-bold text-content-primary">
                      {cluster.activeServicesCount}
                    </span>
                  </div>
                  <div className="flex flex-col gap-0.5 border-x border-border-subtle/50">
                    <span className="text-[10px] font-semibold text-content-muted uppercase tracking-wider">Running</span>
                    <span className="text-sm font-bold text-content-primary">
                      {cluster.runningTasksCount}
                    </span>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[10px] font-semibold text-content-muted uppercase tracking-wider">Pending</span>
                    <span className="text-sm font-bold text-status-warning">
                      {cluster.pendingTasksCount}
                    </span>
                  </div>
                </div>

                <Button
                  onClick={() =>
                    setCurrentView({
                      type: 'cluster-detail',
                      clusterName: cluster.clusterName,
                      tab: 'services',
                    })
                  }
                  variant="secondary"
                  size="sm"
                  className="w-full gap-1.5 font-semibold text-xs cursor-pointer border-0 mt-auto"
                >
                  View Cluster Detail
                  <ChevronRight size={14} />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      </div>
    );
  };

  const renderClusterDetailView = () => {
    if (currentView.type !== 'cluster-detail') return null;

    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex flex-col gap-1">
            <h2 className="text-2xl font-extrabold text-content-primary tracking-tight m-0 animate-fade-in">
              {currentView.clusterName}
            </h2>
            {selectedCluster && (
              <p className="text-xs text-content-secondary m-0">
                Status:{' '}
                <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                  {selectedCluster.status}
                </span>
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={() => {
                setRunTaskForm({
                  taskDefinition: taskDefinitions.length > 0 ? `${taskDefinitions[0].family}:${taskDefinitions[0].latestRevision}` : '',
                  count: 1,
                  environment: [],
                });
                setShowRunTask(true);
              }}
              variant="outline"
              size="sm"
              className="cursor-pointer font-semibold gap-1.5 border-brand-primary/40 text-brand-primary hover:bg-brand-primary/10"
            >
              <Play size={13} fill="currentColor" />
              Run Task
            </Button>
            <Button
              onClick={() => setShowDeleteCluster(currentView.clusterName)}
              variant="destructive"
              size="sm"
              className="cursor-pointer font-semibold"
            >
              <Trash2 size={14} className="mr-1" />
              Delete Cluster
            </Button>
          </div>
        </div>

        <Tabs value={currentView.tab} onValueChange={(val) => setCurrentView({ ...currentView, tab: val as 'services' | 'tasks' })} className="w-full">
          <TabsList className="bg-surface-tertiary border border-border-strong/20 p-0.5 rounded-lg h-9">
            <TabsTrigger value="services" className="text-xs font-semibold px-4 py-1.5 data-[state=active]:bg-background dark:data-[state=active]:bg-input/60">
              Services
            </TabsTrigger>
            <TabsTrigger value="tasks" className="text-xs font-semibold px-4 py-1.5 data-[state=active]:bg-background dark:data-[state=active]:bg-input/60">
              Tasks
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {currentView.tab === 'services' && renderServicesTab()}
        {currentView.tab === 'tasks' && renderTasksTab()}
      </div>
    );
  };

  const renderServicesTab = () => {
    if (isLoading) {
      return <Skeleton className="h-64 rounded-xl" />;
    }

    if (services.length === 0) {
      return (
        <Card className="flex flex-col items-center justify-center p-10 text-center border border-dashed border-border-strong/60 bg-card/40 backdrop-blur-xs min-h-[240px] rounded-2xl">
          <p className="text-xs text-content-secondary mb-4 m-0 font-medium">No services found in this cluster.</p>
          <Button
            onClick={() => setShowCreateService(true)}
            className="bg-brand-primary hover:bg-brand-primary/95 text-white gap-2 font-semibold shadow-sm border-0 cursor-pointer"
            size="sm"
          >
            <Plus size={14} />
            Create Service
          </Button>
        </Card>
      );
    }

    return (
      <div className="space-y-4 animate-fade-in">
        <div className="flex justify-end">
          <Button
            onClick={() => setShowCreateService(true)}
            className="bg-brand-primary hover:bg-brand-primary/95 text-white gap-2 font-semibold shadow-sm border-0 cursor-pointer"
            size="sm"
          >
            <Plus size={14} />
            Create Service
          </Button>
        </div>
        <div className="border border-border-subtle rounded-xl overflow-hidden bg-card shadow-xs">
          <Table>
            <TableHeader className="bg-muted/40 border-b border-border-subtle">
              <TableRow className="hover:bg-transparent">
                <TableHead className="font-semibold text-xs text-content-secondary uppercase tracking-wider py-3 px-4">Name</TableHead>
                <TableHead className="font-semibold text-xs text-content-secondary uppercase tracking-wider py-3 px-4">Status</TableHead>
                <TableHead className="font-semibold text-xs text-content-secondary uppercase tracking-wider py-3 px-4">Task Definition</TableHead>
                <TableHead className="font-semibold text-xs text-content-secondary uppercase tracking-wider py-3 px-4 text-center">Desired</TableHead>
                <TableHead className="font-semibold text-xs text-content-secondary uppercase tracking-wider py-3 px-4 text-center">Running</TableHead>
                <TableHead className="font-semibold text-xs text-content-secondary uppercase tracking-wider py-3 px-4 text-center">Pending</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {services.map((service) => (
                <TableRow
                  key={service.serviceArn}
                  className="group/row cursor-pointer transition-colors border-b border-border-subtle/50 last:border-0 hover:bg-muted/30"
                >
                  <TableCell className="py-3 px-4">
                    <button
                      onClick={() =>
                        setCurrentView({
                          type: 'service-detail',
                          clusterName: currentView.type === 'cluster-detail' ? currentView.clusterName : '',
                          serviceName: service.serviceName,
                        })
                      }
                      className="text-brand-primary hover:underline font-bold text-sm bg-transparent border-0 p-0 cursor-pointer flex items-center gap-1.5"
                    >
                      {service.serviceName}
                      <ArrowRight size={12} className="opacity-0 -translate-x-1 group-hover/row:opacity-100 group-hover/row:translate-x-0 transition-all text-brand-primary" />
                    </button>
                  </TableCell>
                  <TableCell className="py-3 px-4">
                    <Badge
                      variant="outline"
                      className={cn(
                        "h-5 px-2 rounded-full font-bold text-[8px] uppercase tracking-wider gap-1",
                        service.status === 'ACTIVE'
                          ? "bg-emerald-500/5 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                          : "bg-amber-500/5 text-amber-600 dark:text-amber-400 border-amber-500/20"
                      )}
                    >
                      <span className={cn("w-1 h-1 rounded-full", service.status === 'ACTIVE' ? "bg-emerald-500 animate-pulse" : "bg-amber-500")} />
                      {service.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="py-3 px-4 text-xs font-mono text-content-secondary">{service.taskDefinition}</TableCell>
                  <TableCell className="py-3 px-4 text-center font-bold text-content-primary">{service.desiredCount}</TableCell>
                  <TableCell className="py-3 px-4 text-center font-bold text-emerald-600 dark:text-emerald-400">{service.runningCount}</TableCell>
                  <TableCell className="py-3 px-4 text-center font-bold text-status-warning">{service.pendingCount}</TableCell>
                  <TableCell className="py-3 px-4 text-right">
                    <Button
                      onClick={() =>
                        setCurrentView({
                          type: 'service-detail',
                          clusterName: currentView.type === 'cluster-detail' ? currentView.clusterName : '',
                          serviceName: service.serviceName,
                        })
                      }
                      variant="ghost"
                      size="icon-xs"
                      className="text-content-muted hover:text-brand-primary hover:bg-muted rounded-md cursor-pointer border-0"
                    >
                      <ChevronRight size={14} />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    );
  };

  const getDockerBadge = (dockerStatus?: string, lastStatus?: string) => {
    const status = (dockerStatus || lastStatus || 'UNKNOWN').toUpperCase();
    if (status === 'RUNNING') {
      return (
        <Badge variant="outline" className="h-5 px-2 rounded-full font-bold text-[8px] uppercase tracking-wider gap-1 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/25">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          RUNNING
        </Badge>
      );
    }
    if (status === 'SIMULATED') {
      return (
        <Badge variant="outline" className="h-5 px-2 rounded-full font-bold text-[8px] uppercase tracking-wider gap-1 bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/25">
          <span className="w-1.5 h-1.5 rounded-full bg-purple-500" />
          SIMULATED
        </Badge>
      );
    }
    if (status === 'EXITED' || status === 'STOPPED') {
      return (
        <Badge variant="outline" className="h-5 px-2 rounded-full font-bold text-[8px] uppercase tracking-wider gap-1 bg-zinc-500/10 text-zinc-500 dark:text-zinc-400 border-zinc-500/25">
          <span className="w-1.5 h-1.5 rounded-full bg-zinc-400" />
          {status}
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="h-5 px-2 rounded-full font-bold text-[8px] uppercase tracking-wider gap-1 bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/25">
        <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
        {status}
      </Badge>
    );
  };

  const renderTasksTab = () => {
    if (isLoading) {
      return <Skeleton className="h-64 rounded-xl" />;
    }

    if (tasks.length === 0) {
      return (
        <Card className="flex flex-col items-center justify-center p-10 text-center border border-dashed border-border-strong/60 bg-card/40 backdrop-blur-xs min-h-[220px] rounded-2xl">
          <p className="text-xs text-content-secondary m-0 mb-4 font-medium animate-fade-in">No tasks found in this cluster.</p>
          <Button
            onClick={() => {
              setRunTaskForm({
                taskDefinition: taskDefinitions.length > 0 ? `${taskDefinitions[0].family}:${taskDefinitions[0].latestRevision}` : '',
                count: 1,
                environment: [],
              });
              setShowRunTask(true);
            }}
            className="bg-brand-primary hover:bg-brand-primary/95 text-white gap-2 font-semibold shadow-sm border-0 cursor-pointer"
            size="sm"
          >
            <Play size={13} fill="currentColor" />
            Run Task
          </Button>
        </Card>
      );
    }

    return (
      <div className="space-y-4 animate-fade-in">
        <div className="flex justify-end gap-2">
          <Button
            onClick={() => {
              setRunTaskForm({
                taskDefinition: taskDefinitions.length > 0 ? `${taskDefinitions[0].family}:${taskDefinitions[0].latestRevision}` : '',
                count: 1,
                environment: [],
              });
              setShowRunTask(true);
            }}
            className="bg-brand-primary hover:bg-brand-primary/95 text-white gap-2 font-semibold shadow-sm border-0 cursor-pointer"
            size="sm"
          >
            <Play size={13} fill="currentColor" />
            Run Task
          </Button>
        </div>

        <div className="border border-border-subtle rounded-xl overflow-hidden bg-card shadow-xs">
          <Table>
            <TableHeader className="bg-muted/40 border-b border-border-subtle">
              <TableRow className="hover:bg-transparent">
                <TableHead className="font-semibold text-xs text-content-secondary uppercase tracking-wider py-3 px-4">Task / Container</TableHead>
                <TableHead className="font-semibold text-xs text-content-secondary uppercase tracking-wider py-3 px-4">Task Definition</TableHead>
                <TableHead className="font-semibold text-xs text-content-secondary uppercase tracking-wider py-3 px-4">Status</TableHead>
                <TableHead className="font-semibold text-xs text-content-secondary uppercase tracking-wider py-3 px-4">Port Mappings</TableHead>
                <TableHead className="font-semibold text-xs text-content-secondary uppercase tracking-wider py-3 px-4 text-center">Resources</TableHead>
                <TableHead className="font-semibold text-xs text-content-secondary uppercase tracking-wider py-3 px-4">Started</TableHead>
                <TableHead className="w-[140px] text-right py-3 px-4">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tasks.map((task) => {
                const shortTaskId = task.taskArn.split('/').pop() || task.taskArn;
                const shortContainerId = task.containerId ? task.containerId.substring(0, 12) : null;

                return (
                  <TableRow
                    key={task.taskArn}
                    className="transition-colors border-b border-border-subtle/50 last:border-0 hover:bg-muted/30"
                  >
                    <TableCell className="py-3 px-4">
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-1.5">
                          <code className="text-[11px] text-content-primary font-mono bg-surface-secondary px-1.5 py-0.5 rounded border border-border/35">
                            {shortTaskId.substring(0, 8)}...
                          </code>
                        </div>
                        {shortContainerId && (
                          <div className="flex items-center gap-1 text-[10px] text-content-muted font-mono">
                            <span className="text-[9px] uppercase tracking-wider text-content-muted/60">ID:</span>
                            <span>{shortContainerId}</span>
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="py-3 px-4">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-xs font-mono font-semibold text-content-primary">
                          {task.taskDefinitionArn.split('/').pop()}
                        </span>
                        {task.containers.length > 0 && (
                          <span className="text-[10px] text-content-muted truncate max-w-[140px]">
                            {task.containers[0].image}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="py-3 px-4">
                      {getDockerBadge(task.dockerStatus, task.lastStatus)}
                    </TableCell>
                    <TableCell className="py-3 px-4">
                      {task.hostPortMappings && task.hostPortMappings.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5">
                          {task.hostPortMappings.map((pm, idx) => {
                            const host = pm.hostIp && pm.hostIp !== '0.0.0.0' && pm.hostIp !== 'localhost' ? pm.hostIp : 'localhost';
                            const link = `http://${host}:${pm.hostPort}`;
                            return (
                              <a
                                key={idx}
                                href={link}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-brand-primary/10 hover:bg-brand-primary/20 text-brand-primary border border-brand-primary/20 text-[11px] font-mono transition-colors"
                                title={`Open ${link}`}
                              >
                                <span>{pm.hostPort}:{pm.containerPort}</span>
                                <ExternalLink size={10} />
                              </a>
                            );
                          })}
                        </div>
                      ) : (
                        <span className="text-xs text-content-muted">—</span>
                      )}
                    </TableCell>
                    <TableCell className="py-3 px-4 text-center text-xs text-content-secondary">
                      <span>{task.cpu} vCPU / {task.memory} MB</span>
                    </TableCell>
                    <TableCell className="py-3 px-4 text-xs text-content-muted">
                      {task.startedAt ? new Date(task.startedAt).toLocaleTimeString() : '—'}
                    </TableCell>
                    <TableCell className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          onClick={() => setActiveLogTask(task)}
                          variant="ghost"
                          size="icon-xs"
                          title="View Logs"
                          className="text-content-muted hover:text-brand-primary hover:bg-brand-primary/10 rounded-md cursor-pointer border-0 h-7 w-7"
                        >
                          <Terminal size={13} />
                        </Button>
                        <Button
                          onClick={() => setActiveInspectTask(task)}
                          variant="ghost"
                          size="icon-xs"
                          title="Inspect Container"
                          className="text-content-muted hover:text-brand-primary hover:bg-brand-primary/10 rounded-md cursor-pointer border-0 h-7 w-7"
                        >
                          <Code size={13} />
                        </Button>
                        {task.lastStatus === 'RUNNING' && (
                          <Button
                            onClick={() => setShowStopTask(task.taskArn)}
                            variant="ghost"
                            size="icon-xs"
                            title="Stop Task"
                            className="text-content-muted hover:text-destructive hover:bg-destructive/10 rounded-md cursor-pointer border-0 h-7 w-7"
                          >
                            <Square size={12} fill="currentColor" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>
    );
  };

  const renderServiceDetailView = () => {
    if (currentView.type !== 'service-detail' || !selectedService) return null;

    return (
      <div className="space-y-6 animate-fade-in">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex flex-col gap-1">
            <h2 className="text-2xl font-extrabold text-content-primary tracking-tight m-0">
              {selectedService.serviceName}
            </h2>
            <div className="flex items-center gap-1.5 mt-1">
              <span className="text-xs text-content-muted">Status:</span>
              <Badge
                variant="outline"
                className={cn(
                  "h-5 px-2 rounded-full font-bold text-[8px] uppercase tracking-wider gap-1",
                  selectedService.status === 'ACTIVE'
                    ? "bg-emerald-500/5 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                    : "bg-amber-500/5 text-amber-600 dark:text-amber-400 border-amber-500/20"
                )}
              >
                <span className={cn("w-1 h-1 rounded-full", selectedService.status === 'ACTIVE' ? "bg-emerald-500 animate-pulse" : "bg-amber-500")} />
                {selectedService.status}
              </Badge>
            </div>
          </div>
          <Button
            onClick={() => setShowDeleteService(selectedService.serviceName)}
            variant="destructive"
            size="sm"
            className="cursor-pointer font-semibold"
          >
            <Trash2 size={14} className="mr-1" />
            Delete Service
          </Button>
        </div>

        <Card className="bg-card border border-border-subtle p-6 rounded-xl shadow-xs">
          <h3 className="text-sm font-bold text-content-primary mb-4 tracking-tight m-0">Configuration</h3>
          <div className="space-y-4 mt-4 text-xs">
            <div className="flex justify-between items-center py-2 border-b border-border-subtle/50">
              <span className="text-content-secondary font-medium">Launch Type</span>
              <span className="text-content-primary font-bold">{selectedService.launchType}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-border-subtle/50">
              <span className="text-content-secondary font-medium">Task Definition</span>
              <span className="text-content-primary font-mono text-xs">{selectedService.taskDefinition}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-border-subtle/50">
              <span className="text-content-secondary font-medium">Desired Count</span>
              {editingDesiredCount !== null ? (
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min="0"
                    value={editingDesiredCount}
                    onChange={(e) => setEditingDesiredCount(parseInt(e.target.value) || 0)}
                    className="w-16 h-8 text-xs px-2 py-0 border-border-strong/50"
                  />
                  <Button
                    onClick={() => handleUpdateServiceDesiredCount(editingDesiredCount)}
                    size="xs"
                    className="bg-brand-primary hover:bg-brand-primary/95 text-white border-0 cursor-pointer"
                  >
                    Update
                  </Button>
                  <Button
                    onClick={() => setEditingDesiredCount(null)}
                    size="xs"
                    variant="outline"
                    className="cursor-pointer"
                  >
                    Cancel
                  </Button>
                </div>
              ) : (
                <Button
                  onClick={() => setEditingDesiredCount(selectedService.desiredCount)}
                  variant="link"
                  size="xs"
                  className="font-bold text-brand-primary p-0 border-0 cursor-pointer hover:underline h-auto text-xs"
                >
                  {selectedService.desiredCount} (Click to Edit)
                </Button>
              )}
            </div>
            <div className="flex justify-between items-center py-2 border-b border-border-subtle/50">
              <span className="text-content-secondary font-medium">Running Count</span>
              <span className="text-emerald-600 dark:text-emerald-400 font-bold">{selectedService.runningCount}</span>
            </div>
            <div className="flex justify-between items-center py-2">
              <span className="text-content-secondary font-medium">Pending Count</span>
              <span className="text-status-warning font-bold">{selectedService.pendingCount}</span>
            </div>
          </div>
        </Card>

        <Button
          onClick={() => setShowForceDeployment(true)}
          className="bg-brand-primary hover:bg-brand-primary/95 text-white gap-2 font-semibold shadow-sm border-0 cursor-pointer"
          size="sm"
        >
          <Play size={14} />
          Force New Deployment
        </Button>

        {selectedService.deployments.length > 0 && (
          <Card className="bg-card border border-border-subtle p-6 rounded-xl shadow-xs">
            <h3 className="text-sm font-bold text-content-primary mb-4 tracking-tight m-0">Deployments</h3>
            <div className="space-y-3 mt-4">
              {selectedService.deployments.map((deployment) => (
                <div
                  key={deployment.id}
                  className="border border-border-subtle/70 rounded-lg p-4 bg-muted/20"
                >
                  <div className="flex justify-between items-start mb-3">
                    <code className="text-[10px] text-content-muted font-mono bg-surface-secondary px-2 py-0.5 rounded border border-border/30">
                      {deployment.id.substring(0, 12)}...
                    </code>
                    <Badge
                      variant="outline"
                      className={cn(
                        "h-5 px-2 rounded-full font-bold text-[8px] uppercase tracking-wider gap-1",
                        deployment.status === 'PRIMARY'
                          ? 'bg-emerald-500/5 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                          : 'bg-muted text-content-muted border-border/30'
                      )}
                    >
                      {deployment.status}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-xs">
                    <div>
                      <span className="text-content-muted font-medium">Task Def:</span>
                      <p className="text-content-primary font-bold m-0 mt-0.5">{deployment.taskDefinition}</p>
                    </div>
                    <div>
                      <span className="text-content-muted font-medium">Desired / Running:</span>
                      <p className="text-content-primary font-bold m-0 mt-0.5">
                        {deployment.desiredCount} / {deployment.runningCount}
                      </p>
                    </div>
                  </div>
                  <p className="text-[10px] text-content-muted mt-3 m-0 font-medium">
                    Created: {new Date(deployment.createdAt).toLocaleString()}
                  </p>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>
    );
  };

  const renderTaskDefinitionsView = () => {
    if (isLoading) {
      return (
        <div className="space-y-4 animate-pulse">
          <Skeleton className="h-10 rounded-lg" />
          <Skeleton className="h-32 rounded-xl" />
          <Skeleton className="h-32 rounded-xl" />
        </div>
      );
    }

    if (taskDefinitions.length === 0) {
      return (
        <Card className="flex flex-col items-center justify-center p-12 text-center border border-dashed border-border-strong/60 bg-card/40 backdrop-blur-xs min-h-[280px] rounded-2xl">
          <p className="text-xs text-content-secondary mb-4 m-0 font-medium animate-fade-in">No task definitions registered.</p>
          <Button
            onClick={handleOpenNewTaskDefModal}
            className="bg-brand-primary hover:bg-brand-primary/95 text-white gap-2 font-semibold shadow-sm border-0 cursor-pointer"
            size="sm"
          >
            <Plus size={14} />
            Register Task Definition
          </Button>
        </Card>
      );
    }

    return (
      <div className="space-y-4 animate-fade-in">
        <div className="flex justify-between items-center">
          <h2 className="text-base font-bold text-content-primary tracking-tight">Task Definitions</h2>
          <Button
            onClick={handleOpenNewTaskDefModal}
            className="bg-brand-primary hover:bg-brand-primary/95 text-white gap-2 font-semibold shadow-sm border-0 cursor-pointer"
            size="sm"
          >
            <Plus size={14} />
            Register
          </Button>
        </div>
        <div className="space-y-3">
          {taskDefinitions.map((family) => (
            <div key={family.family} className="border border-border-subtle rounded-xl overflow-hidden bg-card shadow-xs">
              <button
                onClick={() => {
                  const newExpanded = new Set(expandedFamilies);
                  if (newExpanded.has(family.family)) {
                    newExpanded.delete(family.family);
                  } else {
                    newExpanded.add(family.family);
                  }
                  setExpandedFamilies(newExpanded);
                }}
                className="w-full px-4 py-3 bg-muted/20 hover:bg-muted/40 flex justify-between items-center text-content-primary font-bold text-sm cursor-pointer border-0 transition-colors"
              >
                <span>{family.family}</span>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-content-muted font-semibold">
                    v{family.latestRevision} ({family.activeRevisionCount} active)
                  </span>
                  <ChevronDown
                    className={`h-4 w-4 text-content-muted transition-transform ${
                      expandedFamilies.has(family.family) ? 'rotate-180' : ''
                    }`}
                  />
                </div>
              </button>
              {expandedFamilies.has(family.family) && (
                <div className="border-t border-border-subtle/50 divide-y divide-border-subtle/50 bg-card">
                  {family.revisions.map((revision) => (
                    <div key={revision.revision} className="p-4 flex flex-col gap-3">
                      <div className="flex justify-between items-start">
                        <div>
                          <code className="text-[10px] text-content-muted font-mono bg-surface-secondary px-2 py-0.5 rounded border border-border/30">
                            {family.family}:{revision.revision}
                          </code>
                          <p className="text-xs text-content-primary font-semibold m-0 mt-1 truncate max-w-md">
                            ARN: {revision.taskDefinitionArn}
                          </p>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            onClick={() => handleEditTaskDefRevision(family.family, revision)}
                            variant="ghost"
                            size="icon-xs"
                            title="Edit / Create new revision"
                            className="text-content-muted hover:text-brand-primary hover:bg-brand-primary/10 rounded-md cursor-pointer border-0"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            onClick={() =>
                              setShowDeregisterTaskDef({
                                family: family.family,
                                revision: revision.revision,
                              })
                            }
                            variant="ghost"
                            size="icon-xs"
                            title="Deregister revision"
                            className="text-content-muted hover:text-destructive hover:bg-destructive/10 rounded-md cursor-pointer border-0"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs pt-1">
                        <div>
                          <span className="text-content-muted font-medium">Status</span>
                          <p className="text-content-primary font-bold m-0 mt-0.5">{revision.status}</p>
                        </div>
                        <div>
                          <span className="text-content-muted font-medium">Image</span>
                          <p className="text-content-primary font-mono text-xs font-bold m-0 mt-0.5 truncate max-w-[160px]">{revision.container.image}</p>
                        </div>
                        <div>
                          <span className="text-content-muted font-medium">CPU / Memory</span>
                          <p className="text-content-primary font-bold m-0 mt-0.5">{revision.cpu} / {revision.memory} MB</p>
                        </div>
                        <div>
                          <span className="text-content-muted font-medium">Network Mode</span>
                          <p className="text-content-primary font-bold m-0 mt-0.5">{revision.networkMode}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 text-[10px] text-content-muted font-medium border-t border-border-subtle/30 pt-2.5 mt-1">
                        <Clock size={12} />
                        <span>Registered: {new Date(revision.registeredAt).toLocaleString()}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  };

  // Main render
  return (
    <div className="flex flex-col gap-6 animate-fade-in pb-20 p-6">
      {renderBreadcrumb()}

      {error && (
        <div className="rounded-xl border border-status-error/30 bg-status-error/10 p-4 flex gap-3 animate-fade-in">
          <AlertCircle className="h-5 w-5 text-status-error flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-status-error font-semibold m-0 text-sm">Error</p>
            <p className="text-status-error/80 text-xs m-0 mt-0.5">{error}</p>
          </div>
          <Button onClick={() => setError(null)} variant="ghost" size="icon-xs" className="text-status-error hover:bg-status-error/10 rounded-md border-0">
            ×
          </Button>
        </div>
      )}

      {/* Main header with Task Definitions link */}
      {currentView.type === 'clusters' && (
        <div className="flex justify-between items-center">
          <h1 className="m-0 text-3xl font-extrabold tracking-tight bg-linear-to-r from-content-primary via-content-primary to-content-muted bg-clip-text text-transparent">
            ECS
          </h1>
          <Button
            onClick={() => setCurrentView({ type: 'task-definitions' })}
            variant="outline"
            size="sm"
            className="gap-2 font-semibold cursor-pointer"
          >
            <RefreshCw size={14} />
            Task Definitions
          </Button>
        </div>
      )}

      {/* View content */}
      {currentView.type === 'clusters' && renderClustersView()}
      {currentView.type === 'cluster-detail' && renderClusterDetailView()}
      {currentView.type === 'service-detail' && renderServiceDetailView()}
      {currentView.type === 'task-definitions' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <Button
              onClick={() => setCurrentView({ type: 'clusters' })}
              variant="link"
              className="inline-flex items-center gap-2 text-brand-primary p-0 h-auto font-bold text-xs hover:underline cursor-pointer border-0"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Clusters
            </Button>
          </div>
          {renderTaskDefinitionsView()}
        </div>
      )}

      {/* Modals */}
      {showCreateCluster && (
        <CreateClusterModal
          form={clusterForm}
          setForm={setClusterForm}
          onSubmit={handleCreateCluster}
          onClose={() => setShowCreateCluster(false)}
        />
      )}

      {showCreateService && currentView.type === 'cluster-detail' && (
        <CreateServiceModal
          form={serviceForm}
          setForm={setServiceForm}
          taskDefinitions={taskDefinitions}
          onSubmit={handleCreateService}
          onClose={() => setShowCreateService(false)}
        />
      )}

      {showRegisterTaskDef && (
        <RegisterTaskDefinitionModal
          form={taskDefForm}
          setForm={setTaskDefForm}
          isEditing={isEditingTaskDef}
          onSubmit={handleRegisterTaskDefinition}
          onClose={() => setShowRegisterTaskDef(false)}
        />
      )}

      {showRunTask && currentView.type === 'cluster-detail' && (
        <RunTaskModal
          form={runTaskForm}
          setForm={setRunTaskForm}
          taskDefinitions={taskDefinitions}
          clusterName={currentView.clusterName}
          onSubmit={handleRunTask}
          onClose={() => setShowRunTask(false)}
        />
      )}

      {/* Log Viewer Modal */}
      {activeLogTask && (
        <TaskLogsModal
          task={activeLogTask}
          onClose={() => setActiveLogTask(null)}
        />
      )}

      {/* Inspect Modal */}
      {activeInspectTask && (
        <TaskInspectModal
          task={activeInspectTask}
          onClose={() => setActiveInspectTask(null)}
        />
      )}

      {/* Confirmation Dialogs */}
      {showDeleteCluster && (
        <ConfirmDialog
          title="Delete Cluster"
          message={`Are you sure you want to delete cluster "${showDeleteCluster}"? This will stop and remove all associated Docker containers, services, and tasks.`}
          onConfirm={() => handleDeleteCluster(showDeleteCluster)}
          onCancel={() => setShowDeleteCluster(null)}
          isDestructive
        />
      )}

      {showDeleteService && (
        <ConfirmDialog
          title="Delete Service"
          message={`Are you sure you want to delete service "${showDeleteService}"? This will stop and remove all running tasks.`}
          onConfirm={() => handleDeleteService(showDeleteService)}
          onCancel={() => setShowDeleteService(null)}
          isDestructive
        />
      )}

      {showStopTask && (
        <ConfirmDialog
          title="Stop Task"
          message={`Are you sure you want to stop task "${showStopTask.split('/').pop()}"? The corresponding Docker container will be stopped and removed.`}
          onConfirm={() => handleStopTask(showStopTask)}
          onCancel={() => setShowStopTask(null)}
          isDestructive
        />
      )}

      {showForceDeployment && (
        <ConfirmDialog
          title="Force New Deployment"
          message={`Force a new deployment for service "${
            currentView.type === 'service-detail' ? currentView.serviceName : ''
          }"? This will recreate the tasks with fresh containers.`}
          onConfirm={handleForceNewDeployment}
          onCancel={() => setShowForceDeployment(false)}
        />
      )}

      {showDeregisterTaskDef && (
        <ConfirmDialog
          title="Deregister Task Definition"
          message={`Are you sure you want to deregister "${showDeregisterTaskDef.family}:${showDeregisterTaskDef.revision}"?`}
          onConfirm={() =>
            handleDeregisterTaskDef(showDeregisterTaskDef.family, showDeregisterTaskDef.revision)
          }
          onCancel={() => setShowDeregisterTaskDef(null)}
          isDestructive
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Run Task Modal
// ---------------------------------------------------------------------------
function RunTaskModal({
  form,
  setForm,
  taskDefinitions,
  clusterName,
  onSubmit,
  onClose,
}: {
  form: { taskDefinition: string; count: number; environment: EnvironmentVariable[] };
  setForm: (form: { taskDefinition: string; count: number; environment: EnvironmentVariable[] }) => void;
  taskDefinitions: TaskDefinitionFamily[];
  clusterName: string;
  onSubmit: () => void;
  onClose: () => void;
}) {
  const allRevisions = taskDefinitions.flatMap((f) =>
    f.revisions.map((r) => `${f.family}:${r.revision}`)
  );

  return (
    <div className="fixed inset-0 bg-slate-950/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
      <Card className="bg-card border border-border-strong/60 rounded-xl shadow-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto flex flex-col gap-4">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-brand-primary/10 text-brand-primary">
              <Play size={16} fill="currentColor" />
            </div>
            <h2 className="text-base font-bold text-content-primary m-0 tracking-tight">Run Task on {clusterName}</h2>
          </div>
          <Button onClick={onClose} variant="ghost" size="icon-xs" className="text-content-muted hover:text-content-primary rounded-md border-0">
            ×
          </Button>
        </div>

        <div className="space-y-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-content-muted">
              Task Definition (family:revision) *
            </label>
            {allRevisions.length > 0 ? (
              <select
                value={form.taskDefinition}
                onChange={(e) => setForm({ ...form, taskDefinition: e.target.value })}
                className="h-9 w-full rounded-lg border border-input bg-transparent px-3 text-xs font-mono transition-colors outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/20 focus-visible:border-brand-primary cursor-pointer dark:bg-input/30"
              >
                <option value="">Select a Task Definition...</option>
                {allRevisions.map((rev) => (
                  <option key={rev} value={rev}>
                    {rev}
                  </option>
                ))}
              </select>
            ) : (
              <Input
                type="text"
                value={form.taskDefinition}
                onChange={(e) => setForm({ ...form, taskDefinition: e.target.value })}
                placeholder="e.g. my-app:1"
                className="bg-surface-secondary border-border-strong/40 focus-visible:ring-brand-primary/20 h-9 text-xs"
              />
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-content-muted">
              Count (Number of tasks)
            </label>
            <Input
              type="number"
              min="1"
              max="10"
              value={form.count}
              onChange={(e) => setForm({ ...form, count: parseInt(e.target.value) || 1 })}
              className="bg-surface-secondary border-border-strong/40 focus-visible:ring-brand-primary/20 h-9 text-xs"
            />
          </div>

          {/* Overrides */}
          <div className="border-t border-border-subtle/50 pt-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-content-muted uppercase tracking-wider flex items-center gap-1.5">
                <Sliders size={12} />
                Environment Overrides
              </span>
              <Button
                onClick={() =>
                  setForm({
                    ...form,
                    environment: [...form.environment, { name: '', value: '' }],
                  })
                }
                variant="link"
                size="xs"
                className="text-xs text-brand-primary p-0 hover:underline border-0 cursor-pointer h-auto"
              >
                + Add Variable
              </Button>
            </div>

            {form.environment.length === 0 ? (
              <p className="text-[11px] text-content-muted/80 italic m-0">No overrides configured. Defaults from task definition will be used.</p>
            ) : (
              <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                {form.environment.map((env, idx) => (
                  <div key={idx} className="flex gap-2 items-center">
                    <Input
                      type="text"
                      value={env.name}
                      onChange={(e) => {
                        const newEnv = [...form.environment];
                        newEnv[idx].name = e.target.value;
                        setForm({ ...form, environment: newEnv });
                      }}
                      placeholder="KEY"
                      className="flex-1 bg-surface-secondary border-border-strong/40 focus-visible:ring-brand-primary/20 h-8 text-xs font-mono"
                    />
                    <Input
                      type="text"
                      value={env.value}
                      onChange={(e) => {
                        const newEnv = [...form.environment];
                        newEnv[idx].value = e.target.value;
                        setForm({ ...form, environment: newEnv });
                      }}
                      placeholder="VALUE"
                      className="flex-1 bg-surface-secondary border-border-strong/40 focus-visible:ring-brand-primary/20 h-8 text-xs font-mono"
                    />
                    <Button
                      onClick={() => {
                        const newEnv = form.environment.filter((_, i) => i !== idx);
                        setForm({ ...form, environment: newEnv });
                      }}
                      variant="ghost"
                      size="icon-xs"
                      className="text-status-error hover:bg-destructive/10 rounded-md border-0 shrink-0 cursor-pointer h-8 w-8"
                    >
                      ×
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex gap-3 pt-3 border-t border-border-subtle/50">
            <Button
              onClick={onSubmit}
              className="flex-1 bg-brand-primary hover:bg-brand-primary/95 text-white font-semibold text-xs border-0 h-9 active:scale-95 transition-all cursor-pointer"
            >
              Run Task
            </Button>
            <Button
              onClick={onClose}
              variant="outline"
              className="flex-1 text-content-primary hover:bg-muted text-xs h-9 cursor-pointer"
            >
              Cancel
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Terminal Style Logs Viewer Modal
// ---------------------------------------------------------------------------
function TaskLogsModal({
  task,
  onClose,
}: {
  task: ECSTask;
  onClose: () => void;
}) {
  const [logs, setLogs] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [autoScroll, setAutoScroll] = useState<boolean>(true);
  const [autoRefresh, setAutoRefresh] = useState<boolean>(true);
  const [copied, setCopied] = useState<boolean>(false);
  const logContainerRef = useRef<HTMLDivElement>(null);

  const fetchLogs = async () => {
    try {
      const resp = await ecsService.getTaskLogs(task.taskArn, 200);
      setLogs(resp.logs || 'No output recorded yet.\n');
    } catch (err) {
      setLogs(`Error retrieving container logs: ${err instanceof Error ? err.message : String(err)}\n`);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      fetchLogs();
    }, 2500);

    return () => clearInterval(interval);
  }, [task.taskArn, autoRefresh]);

  useEffect(() => {
    if (autoScroll && logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs, autoScroll]);

  const handleCopy = () => {
    navigator.clipboard.writeText(logs);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const shortTaskId = task.taskArn.split('/').pop() || task.taskArn;

  return (
    <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
      <Card className="bg-slate-950 border border-slate-800 rounded-xl shadow-2xl w-full max-w-4xl h-[80vh] flex flex-col overflow-hidden text-slate-100 font-mono">
        {/* Terminal Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-slate-900 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex gap-1.5">
              <span className="w-3 h-3 rounded-full bg-rose-500/80 inline-block cursor-pointer hover:opacity-80" onClick={onClose} />
              <span className="w-3 h-3 rounded-full bg-amber-500/80 inline-block" />
              <span className="w-3 h-3 rounded-full bg-emerald-500/80 inline-block" />
            </div>
            <div className="flex items-center gap-2 text-xs">
              <Terminal size={14} className="text-emerald-400" />
              <span className="font-bold text-slate-200">Task Logs:</span>
              <span className="text-slate-400 font-mono">{shortTaskId.substring(0, 16)}</span>
              {task.containerId && (
                <Badge variant="outline" className="h-4 text-[9px] px-1.5 bg-slate-800 text-slate-300 border-slate-700">
                  {task.containerId.substring(0, 12)}
                </Badge>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 font-sans text-xs">
            <label className="flex items-center gap-1.5 text-slate-400 cursor-pointer text-[11px] select-none">
              <input
                type="checkbox"
                checked={autoScroll}
                onChange={(e) => setAutoScroll(e.target.checked)}
                className="rounded border-slate-700 bg-slate-800 text-brand-primary text-xs"
              />
              Auto-scroll
            </label>
            <label className="flex items-center gap-1.5 text-slate-400 cursor-pointer text-[11px] select-none mr-2">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                className="rounded border-slate-700 bg-slate-800 text-brand-primary text-xs"
              />
              Live Refresh
            </label>
            <Button
              onClick={fetchLogs}
              variant="outline"
              size="icon-xs"
              title="Refresh Logs"
              className="h-7 w-7 text-slate-300 border-slate-700 hover:bg-slate-800 cursor-pointer"
            >
              <RefreshCw size={12} className={isLoading ? "animate-spin" : ""} />
            </Button>
            <Button
              onClick={handleCopy}
              variant="outline"
              size="icon-xs"
              title="Copy All Logs"
              className="h-7 w-7 text-slate-300 border-slate-700 hover:bg-slate-800 cursor-pointer"
            >
              {copied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
            </Button>
          </div>
        </div>

        {/* Terminal Body */}
        <div
          ref={logContainerRef}
          className="flex-1 p-4 overflow-y-auto bg-slate-950 text-slate-200 text-xs font-mono leading-relaxed whitespace-pre-wrap selection:bg-brand-primary/30 selection:text-white"
        >
          {logs ? (
            logs
          ) : (
            <div className="flex items-center justify-center h-full text-slate-500 italic">
              Loading container logs...
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Inspect Task Modal
// ---------------------------------------------------------------------------
function TaskInspectModal({
  task,
  onClose,
}: {
  task: ECSTask;
  onClose: () => void;
}) {
  const [inspectData, setInspectData] = useState<TaskInspectResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [copied, setCopied] = useState<boolean>(false);

  useEffect(() => {
    const fetchInspect = async () => {
      try {
        const res = await ecsService.inspectTask(task.taskArn);
        setInspectData(res);
      } catch (err) {
        console.error('Inspect error', err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchInspect();
  }, [task.taskArn]);

  const jsonStr = inspectData ? JSON.stringify(inspectData, null, 2) : '';

  const handleCopy = () => {
    navigator.clipboard.writeText(jsonStr);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
      <Card className="bg-card border border-border-strong/60 rounded-xl shadow-2xl w-full max-w-3xl h-[80vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border-subtle bg-muted/20 shrink-0">
          <div className="flex items-center gap-2">
            <Code size={16} className="text-brand-primary" />
            <h2 className="text-sm font-bold text-content-primary m-0">Task Inspection</h2>
            <code className="text-xs text-content-muted font-mono bg-surface-secondary px-2 py-0.5 rounded border border-border/30">
              {task.taskArn.split('/').pop()}
            </code>
          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={handleCopy}
              variant="outline"
              size="xs"
              className="gap-1.5 text-xs cursor-pointer"
            >
              {copied ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
              {copied ? 'Copied' : 'Copy JSON'}
            </Button>
            <Button onClick={onClose} variant="ghost" size="icon-xs" className="rounded-md border-0">
              ×
            </Button>
          </div>
        </div>

        <div className="flex-1 p-4 overflow-y-auto bg-surface-secondary/40">
          {isLoading ? (
            <div className="flex items-center justify-center h-full text-xs text-content-muted">
              Fetching inspect details...
            </div>
          ) : (
            <pre className="text-xs font-mono leading-relaxed text-content-primary m-0 whitespace-pre-wrap">
              {jsonStr}
            </pre>
          )}
        </div>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Other Modals (CreateCluster, CreateService, RegisterTaskDef, ConfirmDialog)
// ---------------------------------------------------------------------------
function CreateClusterModal({
  form,
  setForm,
  onSubmit,
  onClose,
}: {
  form: { name: string };
  setForm: (form: { name: string }) => void;
  onSubmit: () => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
      <Card className="bg-card border border-border-strong/60 rounded-xl shadow-lg p-6 w-full max-w-md">
        <h2 className="text-lg font-bold text-content-primary mb-4 tracking-tight m-0">Create Cluster</h2>
        <div className="space-y-4 mt-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-content-muted">
              Cluster Name
            </label>
            <Input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ name: e.target.value })}
              placeholder="e.g., my-cluster"
              className="bg-surface-secondary border-border-strong/40 focus-visible:ring-brand-primary/20 h-9 text-xs placeholder:text-content-muted/50"
            />
          </div>
          <div className="flex gap-3 pt-2">
            <Button
              onClick={onSubmit}
              className="flex-1 bg-brand-primary hover:bg-brand-primary/95 text-white font-semibold text-xs border-0 h-9 active:scale-95 transition-all cursor-pointer"
            >
              Create
            </Button>
            <Button
              onClick={onClose}
              variant="outline"
              className="flex-1 text-content-primary hover:bg-muted text-xs h-9 cursor-pointer"
            >
              Cancel
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}

function CreateServiceModal({
  form,
  setForm,
  taskDefinitions,
  onSubmit,
  onClose,
}: {
  form: { name: string; taskDefinition: string; desiredCount: number };
  setForm: (form: { name: string; taskDefinition: string; desiredCount: number }) => void;
  taskDefinitions: TaskDefinitionFamily[];
  onSubmit: () => void;
  onClose: () => void;
}) {
  const allRevisions = taskDefinitions.flatMap((f) =>
    f.revisions.map((r) => `${f.family}:${r.revision}`)
  );

  return (
    <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
      <Card className="bg-card border border-border-strong/60 rounded-xl shadow-lg p-6 w-full max-w-md">
        <h2 className="text-lg font-bold text-content-primary mb-4 tracking-tight m-0">Create Service</h2>
        <div className="space-y-4 mt-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-content-muted">
              Service Name
            </label>
            <Input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g., my-service"
              className="bg-surface-secondary border-border-strong/40 focus-visible:ring-brand-primary/20 h-9 text-xs placeholder:text-content-muted/50"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-content-muted">
              Task Definition (family:revision)
            </label>
            {allRevisions.length > 0 ? (
              <select
                value={form.taskDefinition}
                onChange={(e) => setForm({ ...form, taskDefinition: e.target.value })}
                className="h-9 w-full rounded-lg border border-input bg-transparent px-3 text-xs font-mono transition-colors outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/20 focus-visible:border-brand-primary cursor-pointer dark:bg-input/30"
              >
                <option value="">Select a Task Definition...</option>
                {allRevisions.map((rev) => (
                  <option key={rev} value={rev}>
                    {rev}
                  </option>
                ))}
              </select>
            ) : (
              <Input
                type="text"
                value={form.taskDefinition}
                onChange={(e) => setForm({ ...form, taskDefinition: e.target.value })}
                placeholder="e.g., my-app:1"
                className="bg-surface-secondary border-border-strong/40 focus-visible:ring-brand-primary/20 h-9 text-xs placeholder:text-content-muted/50"
              />
            )}
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-content-muted">
              Desired Count
            </label>
            <Input
              type="number"
              min="1"
              value={form.desiredCount}
              onChange={(e) => setForm({ ...form, desiredCount: parseInt(e.target.value) || 1 })}
              className="bg-surface-secondary border-border-strong/40 focus-visible:ring-brand-primary/20 h-9 text-xs"
            />
          </div>
          <div className="flex gap-3 pt-2">
            <Button
              onClick={onSubmit}
              className="flex-1 bg-brand-primary hover:bg-brand-primary/95 text-white font-semibold text-xs border-0 h-9 active:scale-95 transition-all cursor-pointer"
            >
              Create
            </Button>
            <Button
              onClick={onClose}
              variant="outline"
              className="flex-1 text-content-primary hover:bg-muted text-xs h-9 cursor-pointer"
            >
              Cancel
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}

const POPULAR_ECS_TEMPLATES = [
  {
    id: 'hello-kubernetes',
    name: 'Hello Kubernetes',
    image: 'paulbouwer/hello-kubernetes:1.10',
    family: 'hello-kubernetes',
    containerName: 'hello-kubernetes',
    port: 8080,
    protocol: 'tcp' as const,
    cpu: '256',
    memory: '512',
    desc: 'Sample web app (Port 8080)',
  },
  {
    id: 'nginx',
    name: 'Nginx Web Server',
    image: 'nginx:alpine',
    family: 'nginx-web',
    containerName: 'nginx',
    port: 80,
    protocol: 'tcp' as const,
    cpu: '256',
    memory: '512',
    desc: 'HTTP server (Port 80)',
  },
  {
    id: 'node',
    name: 'Node.js',
    image: 'node:20-alpine',
    family: 'node-app',
    containerName: 'node',
    port: 3000,
    protocol: 'tcp' as const,
    cpu: '256',
    memory: '512',
    desc: 'Web runtime (Port 3000)',
  },
  {
    id: 'redis',
    name: 'Redis',
    image: 'redis:alpine',
    family: 'redis-cache',
    containerName: 'redis',
    port: 6379,
    protocol: 'tcp' as const,
    cpu: '256',
    memory: '512',
    desc: 'In-memory store (Port 6379)',
  },
  {
    id: 'postgres',
    name: 'PostgreSQL',
    image: 'postgres:16-alpine',
    family: 'postgres-db',
    containerName: 'postgres',
    port: 5432,
    protocol: 'tcp' as const,
    cpu: '256',
    memory: '512',
    desc: 'SQL Database (Port 5432)',
  },
];

function getSuggestedPortForImage(image: string): number | null {
  const lower = image.toLowerCase();
  if (lower.includes('hello-kubernetes') || lower.includes('hello-world')) return 8080;
  if (lower.includes('nginx') || lower.includes('httpd') || lower.includes('apache')) return 80;
  if (lower.includes('redis')) return 6379;
  if (lower.includes('postgres') || lower.includes('pgsql')) return 5432;
  if (lower.includes('node') || lower.includes('express') || lower.includes('nest')) return 3000;
  if (lower.includes('mongo')) return 27017;
  if (lower.includes('mysql') || lower.includes('mariadb')) return 3306;
  return null;
}

function RegisterTaskDefinitionModal({
  form,
  setForm,
  onSubmit,
  onClose,
  isEditing,
}: {
  form: {
    family: string;
    cpu: string;
    memory: string;
    networkMode: 'awsvpc' | 'bridge';
    containerName: string;
    image: string;
    containerCpu: number;
    containerMemory: number;
    portMappings: PortMapping[];
    environment: EnvironmentVariable[];
  };
  setForm: (form: {
    family: string;
    cpu: string;
    memory: string;
    networkMode: 'awsvpc' | 'bridge';
    containerName: string;
    image: string;
    containerCpu: number;
    containerMemory: number;
    portMappings: PortMapping[];
    environment: EnvironmentVariable[];
  }) => void;
  onSubmit: () => void;
  onClose: () => void;
  isEditing?: boolean;
}) {
  const cpuOptions = ['256', '512', '1024', '2048', '4096'];
  const memoryOptions: Record<string, string[]> = {
    '256': ['512', '1024', '2048'],
    '512': ['1024', '2048', '3072', '4096'],
    '1024': ['2048', '3072', '4096', '5120', '6144', '7168', '8192'],
    '2048': ['4096', '5120', '6144', '7168', '8192', '9216', '10240', '11264', '12288', '13312', '14336', '15360', '16384'],
    '4096': ['8192', '9216', '10240', '11264', '12288', '13312', '14336', '15360', '16384', '17408', '18432', '19456', '20480', '21504', '22528', '23552', '24576', '25600', '26624', '27648', '28672', '29696', '30720'],
  };

  const currentMemoryOptions = memoryOptions[form.cpu] || [];

  const [ecrRepositories, setEcrRepositories] = useState<ECRRepository[]>([]);
  const [localDockerImages, setLocalDockerImages] = useState<string[]>([]);

  useEffect(() => {
    const fetchImages = async () => {
      try {
        const repos = await ecrService.getRepositories();
        setEcrRepositories(repos);
      } catch (e) {
        // Ignore error if ECR is empty
      }
      try {
        const dockerImages = await ecsService.getDockerImages();
        const tagsSet = new Set<string>();
        for (const img of dockerImages) {
          for (const tag of img.repoTags || []) {
            if (tag && tag !== '<none>:<none>' && !tag.startsWith('ministackorg/ministack')) {
              tagsSet.add(tag);
            }
          }
        }
        setLocalDockerImages(Array.from(tagsSet));
      } catch (e) {
        // Ignore if docker socket unavailable
      }
    };
    fetchImages();
  }, []);

  const handleApplyTemplate = (t: typeof POPULAR_ECS_TEMPLATES[0]) => {
    setForm({
      ...form,
      image: t.image,
      family: form.family ? form.family : t.family,
      containerName: form.containerName ? form.containerName : t.containerName,
      cpu: t.cpu,
      memory: t.memory,
      portMappings: [{ containerPort: t.port, protocol: t.protocol }],
    });
  };

  const handleApplyLocalDockerImage = (imgTag: string) => {
    let baseName = imgTag;
    if (baseName.includes('/')) {
      baseName = baseName.split('/').pop() || baseName;
    }
    if (baseName.includes(':')) {
      baseName = baseName.split(':')[0];
    }
    const suggestedPort = getSuggestedPortForImage(imgTag) || 80;
    setForm({
      ...form,
      image: imgTag,
      family: form.family ? form.family : baseName,
      containerName: form.containerName ? form.containerName : baseName,
      portMappings: form.portMappings.length > 0 ? form.portMappings : [{ containerPort: suggestedPort, protocol: 'tcp' }],
    });
  };

  const handleApplyEcrRepo = (repo: ECRRepository) => {
    const repoUri = repo.repositoryUri || `localhost:9091/${repo.repositoryName}`;
    const fullImage = `${repoUri}:latest`;
    const suggestedPort = getSuggestedPortForImage(repo.repositoryName) || 80;
    setForm({
      ...form,
      image: fullImage,
      family: form.family ? form.family : repo.repositoryName,
      containerName: form.containerName ? form.containerName : repo.repositoryName,
      portMappings: form.portMappings.length > 0 ? form.portMappings : [{ containerPort: suggestedPort, protocol: 'tcp' }],
    });
  };

  const detectedPort = getSuggestedPortForImage(form.image);
  const hasPortConfigured = detectedPort ? form.portMappings.some(p => p.containerPort === detectedPort) : false;

  return (
    <div className="fixed inset-0 bg-slate-950/50 backdrop-blur-xs flex items-center justify-center z-50 p-3 sm:p-4 animate-fade-in">
      <Card className="bg-card border border-border-strong/60 rounded-xl shadow-2xl p-4 sm:p-5 w-full max-w-lg max-h-[88vh] overflow-y-auto flex flex-col gap-3.5 animate-slide-up">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border-subtle/60 pb-2.5">
          <div className="flex items-center gap-2">
            <div className="p-1 rounded-md bg-brand-primary/10 text-brand-primary">
              {isEditing ? <Pencil size={14} /> : <Sparkles size={14} />}
            </div>
            <div>
              <h2 className="text-sm font-bold text-content-primary tracking-tight m-0">
                {isEditing ? `Edit Task Definition (${form.family})` : 'Register Task Definition'}
              </h2>
              {isEditing && (
                <p className="text-[10px] text-content-muted m-0">
                  Editing will register the next revision of this task definition
                </p>
              )}
            </div>
          </div>
          <Button onClick={onClose} variant="ghost" size="icon-xs" className="rounded-md border-0 text-content-muted hover:text-content-primary">
            ×
          </Button>
        </div>

        {/* Compact Image Assistant */}
        <div className="bg-surface-secondary/70 border border-border-subtle rounded-lg p-2.5 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-content-muted uppercase tracking-wider flex items-center gap-1">
              <Sparkles size={11} className="text-brand-primary" />
              Quick Presets & Images
            </span>
            <span className="text-[9px] text-content-muted">One-click auto-configures container & ports</span>
          </div>

          {/* Presets */}
          <div className="flex flex-wrap gap-1">
            {POPULAR_ECS_TEMPLATES.map(item => (
              <button
                key={item.id}
                type="button"
                onClick={() => handleApplyTemplate(item)}
                className={`px-2 py-0.5 text-[11px] rounded-md border transition-all cursor-pointer flex items-center gap-1 ${
                  form.image === item.image
                    ? 'bg-brand-primary/15 border-brand-primary text-brand-primary font-bold shadow-xs'
                    : 'bg-surface-primary border-border-subtle text-content-secondary hover:border-brand-primary/50 hover:bg-surface-tertiary'
                }`}
              >
                <span>{item.name}</span>
                <span className="text-[9px] text-content-muted font-mono bg-surface-tertiary px-1 py-0.2 rounded">{item.port}</span>
              </button>
            ))}
          </div>

          {/* Local Docker Host Images */}
          {localDockerImages.length > 0 && (
            <div className="pt-2 border-t border-border-subtle/40">
              <div className="flex items-center gap-1 text-[10px] font-semibold text-content-muted mb-1.5">
                <HardDrive size={11} className="text-blue-500" />
                <span>Images on your machine ({localDockerImages.length}):</span>
              </div>
              <div className="flex flex-wrap gap-1 max-h-20 overflow-y-auto pr-1">
                {localDockerImages.map(tag => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => handleApplyLocalDockerImage(tag)}
                    className={`text-[10px] font-mono px-1.5 py-0.5 rounded border transition-all cursor-pointer flex items-center gap-1 ${
                      form.image === tag
                        ? 'bg-blue-500/15 border-blue-500 text-blue-600 dark:text-blue-400 font-bold shadow-xs'
                        : 'border-border-subtle bg-surface-primary hover:border-blue-500/50 text-content-secondary hover:text-content-primary'
                    }`}
                    title={`Click to use local image: ${tag}`}
                  >
                    <HardDrive size={9} className="text-blue-500" />
                    <span>{tag}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Local ECR Images */}
          {ecrRepositories.length > 0 && (
            <div className="pt-2 border-t border-border-subtle/40">
              <div className="flex items-center gap-1 text-[10px] font-semibold text-content-muted mb-1.5">
                <Package size={11} className="text-brand-primary" />
                <span>Ministack ECR Images:</span>
              </div>
              <div className="flex flex-wrap gap-1">
                {ecrRepositories.map(repo => (
                  <button
                    key={repo.repositoryName}
                    type="button"
                    onClick={() => handleApplyEcrRepo(repo)}
                    className={`text-[10px] font-mono px-1.5 py-0.5 rounded border transition-colors cursor-pointer flex items-center gap-1 ${
                      form.image.includes(repo.repositoryName)
                        ? 'bg-brand-primary/15 border-brand-primary text-brand-primary font-bold shadow-xs'
                        : 'border-border-subtle bg-surface-primary hover:border-brand-primary text-content-secondary hover:text-content-primary'
                    }`}
                  >
                    <Package size={9} className="text-brand-primary" />
                    <span>{repo.repositoryName}:latest</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="space-y-3.5">
          {/* Task Config Section */}
          <div className="border-b border-border-subtle/50 pb-3">
            <h3 className="text-[10px] font-bold text-content-muted uppercase tracking-wider mb-2 m-0">Task Config</h3>
            <div className="grid grid-cols-2 gap-2.5">
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-semibold text-content-muted">Family *</label>
                <Input
                  type="text"
                  value={form.family}
                  onChange={(e) => setForm({ ...form, family: e.target.value })}
                  placeholder="e.g., my-app"
                  className="bg-surface-secondary border-border-strong/40 focus-visible:ring-brand-primary/20 h-8 text-xs placeholder:text-content-muted/50"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-semibold text-content-muted">Network Mode</label>
                <select
                  value={form.networkMode}
                  onChange={(e) => setForm({ ...form, networkMode: e.target.value as 'awsvpc' | 'bridge' })}
                  className="h-8 w-full rounded-md border border-input bg-transparent px-2 text-xs transition-colors outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/20 focus-visible:border-brand-primary cursor-pointer dark:bg-input/30"
                >
                  <option value="awsvpc">awsvpc</option>
                  <option value="bridge">bridge</option>
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-semibold text-content-muted">CPU</label>
                <select
                  value={form.cpu}
                  onChange={(e) => setForm({ ...form, cpu: e.target.value })}
                  className="h-8 w-full rounded-md border border-input bg-transparent px-2 text-xs transition-colors outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/20 focus-visible:border-brand-primary cursor-pointer dark:bg-input/30"
                >
                  {cpuOptions.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt} units
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-semibold text-content-muted">Memory</label>
                <select
                  value={form.memory}
                  onChange={(e) => setForm({ ...form, memory: e.target.value })}
                  className="h-8 w-full rounded-md border border-input bg-transparent px-2 text-xs transition-colors outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/20 focus-visible:border-brand-primary cursor-pointer dark:bg-input/30"
                >
                  {currentMemoryOptions.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt} MB
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Container Config Section */}
          <div className="border-b border-border-subtle/50 pb-3">
            <h3 className="text-[10px] font-bold text-content-muted uppercase tracking-wider mb-2 m-0">Container</h3>
            <div className="grid grid-cols-2 gap-2.5">
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-semibold text-content-muted">
                  Container Name
                </label>
                <Input
                  type="text"
                  value={form.containerName}
                  onChange={(e) => setForm({ ...form, containerName: e.target.value })}
                  placeholder={form.family || 'container'}
                  className="bg-surface-secondary border-border-strong/40 focus-visible:ring-brand-primary/20 h-8 text-xs placeholder:text-content-muted/50"
                />
              </div>
              <div className="flex flex-col gap-1">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-semibold text-content-muted">
                    Image *
                  </label>
                  {detectedPort && !hasPortConfigured && (
                    <button
                      type="button"
                      onClick={() => {
                        setForm({
                          ...form,
                          portMappings: [...form.portMappings, { containerPort: detectedPort, protocol: 'tcp' }],
                        });
                      }}
                      className="text-[9px] text-brand-primary font-semibold hover:underline flex items-center gap-0.5 cursor-pointer"
                    >
                      <Lightbulb size={9} />
                      Port {detectedPort}
                    </button>
                  )}
                </div>
                <Input
                  type="text"
                  value={form.image}
                  onChange={(e) => {
                    const newImg = e.target.value;
                    const autoPort = getSuggestedPortForImage(newImg);
                    if (autoPort && form.portMappings.length === 0) {
                      setForm({
                        ...form,
                        image: newImg,
                        portMappings: [{ containerPort: autoPort, protocol: 'tcp' }],
                      });
                    } else {
                      setForm({ ...form, image: newImg });
                    }
                  }}
                  placeholder="e.g., paulbouwer/hello-kubernetes:1.10"
                  className="bg-surface-secondary border-border-strong/40 focus-visible:ring-brand-primary/20 h-8 text-xs font-mono placeholder:text-content-muted/50"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-semibold text-content-muted">CPU (units, opt)</label>
                <Input
                  type="number"
                  value={form.containerCpu}
                  onChange={(e) => setForm({ ...form, containerCpu: parseInt(e.target.value) || 0 })}
                  className="bg-surface-secondary border-border-strong/40 focus-visible:ring-brand-primary/20 h-8 text-xs"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-semibold text-content-muted">Memory (MB, opt)</label>
                <Input
                  type="number"
                  value={form.containerMemory}
                  onChange={(e) => setForm({ ...form, containerMemory: parseInt(e.target.value) || 0 })}
                  className="bg-surface-secondary border-border-strong/40 focus-visible:ring-brand-primary/20 h-8 text-xs"
                />
              </div>
            </div>
          </div>

          {/* Port Mappings Section */}
          <div className="border-b border-border-subtle/50 pb-3">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-[10px] font-bold text-content-muted uppercase tracking-wider m-0">Port Mappings</h3>
              <Button
                onClick={() =>
                  setForm({
                    ...form,
                    portMappings: [...form.portMappings, { containerPort: detectedPort || 80, protocol: 'tcp' }],
                  })
                }
                variant="link"
                size="xs"
                className="text-[11px] text-brand-primary p-0 hover:underline border-0 cursor-pointer h-auto"
              >
                + Add Port
              </Button>
            </div>
            {form.portMappings.length === 0 ? (
              <p className="text-[11px] text-content-muted italic m-0">No port mappings configured.</p>
            ) : (
              <div className="space-y-1.5">
                {form.portMappings.map((pm, idx) => (
                  <div key={idx} className="flex gap-2 items-center">
                    <Input
                      type="number"
                      value={pm.containerPort}
                      onChange={(e) => {
                        const newPm = [...form.portMappings];
                        newPm[idx].containerPort = parseInt(e.target.value) || 0;
                        setForm({ ...form, portMappings: newPm });
                      }}
                      placeholder="Port (e.g., 8080)"
                      className="flex-1 bg-surface-secondary border-border-strong/40 focus-visible:ring-brand-primary/20 h-7.5 text-xs"
                    />
                    <select
                      value={pm.protocol}
                      onChange={(e) => {
                        const newPm = [...form.portMappings];
                        newPm[idx].protocol = e.target.value as 'tcp' | 'udp';
                        setForm({ ...form, portMappings: newPm });
                      }}
                      className="h-7.5 rounded-md border border-input bg-transparent px-2 text-xs transition-colors outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/20 focus-visible:border-brand-primary cursor-pointer dark:bg-input/30"
                    >
                      <option value="tcp">TCP</option>
                      <option value="udp">UDP</option>
                    </select>
                    <Button
                      onClick={() => {
                        const newPm = form.portMappings.filter((_, i) => i !== idx);
                        setForm({ ...form, portMappings: newPm });
                      }}
                      variant="ghost"
                      size="icon-xs"
                      className="text-status-error hover:bg-destructive/10 rounded-md border-0 shrink-0 cursor-pointer h-7.5 w-7.5"
                    >
                      ×
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Environment Variables Section */}
          <div className="pb-1">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-[10px] font-bold text-content-muted uppercase tracking-wider m-0">Environment Variables</h3>
              <Button
                onClick={() =>
                  setForm({
                    ...form,
                    environment: [...form.environment, { name: '', value: '' }],
                  })
                }
                variant="link"
                size="xs"
                className="text-[11px] text-brand-primary p-0 hover:underline border-0 cursor-pointer h-auto"
              >
                + Add Variable
              </Button>
            </div>
            {form.environment.length === 0 ? (
              <p className="text-[11px] text-content-muted italic m-0">No environment variables configured.</p>
            ) : (
              <div className="space-y-1.5">
                {form.environment.map((env, idx) => (
                  <div key={idx} className="flex gap-2 items-center">
                    <Input
                      type="text"
                      value={env.name}
                      onChange={(e) => {
                        const newEnv = [...form.environment];
                        newEnv[idx].name = e.target.value;
                        setForm({ ...form, environment: newEnv });
                      }}
                      placeholder="Name"
                      className="flex-1 bg-surface-secondary border-border-strong/40 focus-visible:ring-brand-primary/20 h-7.5 text-xs"
                    />
                    <Input
                      type="text"
                      value={env.value}
                      onChange={(e) => {
                        const newEnv = [...form.environment];
                        newEnv[idx].value = e.target.value;
                        setForm({ ...form, environment: newEnv });
                      }}
                      placeholder="Value"
                      className="flex-1 bg-surface-secondary border-border-strong/40 focus-visible:ring-brand-primary/20 h-7.5 text-xs"
                    />
                    <Button
                      onClick={() => {
                        const newEnv = form.environment.filter((_, i) => i !== idx);
                        setForm({ ...form, environment: newEnv });
                      }}
                      variant="ghost"
                      size="icon-xs"
                      className="text-status-error hover:bg-destructive/10 rounded-md border-0 shrink-0 cursor-pointer h-7.5 w-7.5"
                    >
                      ×
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex gap-2.5 pt-3 border-t border-border-subtle/50">
            <Button
              onClick={onSubmit}
              className="flex-grow bg-brand-primary hover:bg-brand-primary/95 text-white font-semibold text-xs border-0 h-8.5 active:scale-95 transition-all cursor-pointer"
            >
              {isEditing ? 'Register New Revision' : 'Register Task Definition'}
            </Button>
            <Button
              onClick={onClose}
              variant="outline"
              className="px-4 text-content-primary hover:bg-muted text-xs h-8.5 cursor-pointer"
            >
              Cancel
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}

function ConfirmDialog({
  title,
  message,
  onConfirm,
  onCancel,
  isDestructive = false,
}: {
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  isDestructive?: boolean;
}) {
  return (
    <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
      <Card className="bg-card border border-border-strong/60 rounded-xl shadow-lg p-6 w-full max-w-md">
        <h2 className="text-base font-bold text-content-primary mb-2 tracking-tight m-0">{title}</h2>
        <p className="text-xs text-content-secondary mb-6 leading-relaxed mt-2 m-0">{message}</p>
        <div className="flex gap-3">
          <Button
            onClick={onConfirm}
            variant={isDestructive ? 'destructive' : 'default'}
            className={cn("flex-1 text-xs h-9 font-semibold active:scale-95 transition-all cursor-pointer", !isDestructive && "bg-brand-primary hover:bg-brand-primary/95 text-white border-0")}
          >
            Confirm
          </Button>
          <Button
            onClick={onCancel}
            variant="outline"
            className="flex-1 text-content-primary hover:bg-muted text-xs h-9 cursor-pointer"
          >
            Cancel
          </Button>
        </div>
      </Card>
    </div>
  );
}
