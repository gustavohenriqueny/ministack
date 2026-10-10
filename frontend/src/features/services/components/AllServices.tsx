import React, { useState, useEffect } from 'react';
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuSeparator
} from "@/components/ui/dropdown-menu";
import {
  Database,
  MessageSquare,
  DatabaseZap,
  Zap,
  ShieldCheck,
  Key,
  BarChart3,
  Settings,
  Network,
  Waves,
  Activity,
  Mail,
  RefreshCw,
  Globe,
  Search,
  Box,
  FlaskConical,
  SearchCode,
  Truck,
  Lock,
  Monitor,
  HardDrive,
  Folder,
  Scale,
  FileCheck,
  Cloud,
  Package,
  Hammer,
  Map,
  FolderOpen,
  Building,
  UserSquare,
  Settings2,
  Radio,
  Clock,
  Save,
  MousePointer2,
  TableProperties,
  LayoutGrid,
  List,
  ArrowRight,
  Star,
  Filter,
  Plus
} from 'lucide-react';


interface AWSService {
  id: string;
  name: string;
  icon: string;
  description: string;
  implemented: boolean;
  category: string;
}

interface AllServicesProps {
  onNavigate: (tabId: string) => void;
  recent: string[];
}

export const AllServices: React.FC<AllServicesProps> = ({ onNavigate, recent }) => {
  const [search, setSearch] = useState('');
  const [activeSubTab, setActiveSubTab] = useState<'all' | 'recent' | 'favorites'>('all');
  const [selectedGroups, setSelectedGroups] = useState<string[]>([]);

  const [viewMode, setViewMode] = useState<'grid' | 'list'>(() => {
    const saved = localStorage.getItem('ministack_view_mode');
    return (saved as 'grid' | 'list') || 'grid';
  });

  const [favorites, setFavorites] = useState<string[]>(() => {
    const saved = localStorage.getItem('ministack_favorites');
    return saved ? JSON.parse(saved) : [];
  });

  useEffect(() => {
    localStorage.setItem('ministack_view_mode', viewMode);
  }, [viewMode]);

  useEffect(() => {
    localStorage.setItem('ministack_favorites', JSON.stringify(favorites));
  }, [favorites]);

  const services: AWSService[] = [
    { id: 's3', name: 'S3', icon: 'DatabaseZap', description: 'Buckets, objects, versioning, encryption, lifecycle, Object Lock', implemented: false, category: 'Storage' },
    { id: 'messaging', name: 'SQS', icon: 'MessageSquare', description: 'Queues, FIFO, DLQ, batch, visibility', implemented: true, category: 'Messaging' },
    { id: 'sns', name: 'SNS', icon: 'Radio', description: 'Topics, subscriptions, fanout to SQS, batch publish', implemented: true, category: 'Messaging' },
    { id: 'dynamodb', name: 'DynamoDB', icon: 'TableProperties', description: 'Tables, CRUD, query, scan, transactions, TTL, GSI', implemented: false, category: 'Database' },
    { id: 'lambda', name: 'Lambda', icon: 'Zap', description: 'Real Python execution, warm workers, SQS ESM, Layers', implemented: false, category: 'Compute' },
    { id: 'iam', name: 'IAM', icon: 'ShieldCheck', description: 'Users, roles, policies, groups, instance profiles, OIDC', implemented: false, category: 'Security' },
    { id: 'sts', name: 'STS', icon: 'FileCheck', description: 'CallerIdentity, AssumeRole, GetSessionToken', implemented: false, category: 'Security' },
    { id: 'secrets', name: 'Secrets Manager', icon: 'Key', description: 'CRUD, versioning, rotation, resource policies', implemented: false, category: 'Security' },
    { id: 'cwlogs', name: 'CW Logs', icon: 'BarChart3', description: 'Groups, streams, retention, Insights', implemented: false, category: 'Monitoring' },
    { id: 'ssm', name: 'SSM Params', icon: 'Settings2', description: 'String, SecureString, paths, labels, tags', implemented: false, category: 'Management' },
    { id: 'eventbridge', name: 'EventBridge', icon: 'Network', description: 'Buses, rules, targets, Lambda dispatch', implemented: false, category: 'Integration' },
    { id: 'kinesis', name: 'Kinesis', icon: 'Waves', description: 'Streams, split/merge shards, consumers', implemented: false, category: 'Analytics' },
    { id: 'cwmetrics', name: 'CW Metrics', icon: 'Activity', description: 'Metrics, alarms, dashboards', implemented: false, category: 'Monitoring' },
    { id: 'ses', name: 'SES', icon: 'Mail', description: 'Send email/raw/templated, identities', implemented: false, category: 'Integration' },
    { id: 'stepfunctions', name: 'Step Functions', icon: 'RefreshCw', description: 'Full ASL engine, sync execution', implemented: false, category: 'Integration' },
    { id: 'apigwv2', name: 'API Gateway v2', icon: 'Globe', description: 'HTTP APIs, Lambda proxy, path params', implemented: false, category: 'Networking' },
    { id: 'apigwv1', name: 'API Gateway v1', icon: 'Globe', description: 'REST APIs, resources, methods, MOCK', implemented: false, category: 'Networking' },
    { id: 'rds', name: 'RDS', icon: 'Database', description: 'Real Postgres/MySQL containers', implemented: false, category: 'Database' },
    { id: 'elasticache', name: 'ElastiCache', icon: 'DatabaseZap', description: 'Real Redis/Memcached containers', implemented: false, category: 'Database' },
    { id: 'ecs', name: 'ECS', icon: 'Box', description: 'RunTask starts real containers', implemented: false, category: 'Compute' },
    { id: 'glue', name: 'Glue', icon: 'FlaskConical', description: 'Catalog, crawlers, jobs, triggers', implemented: false, category: 'Analytics' },
    { id: 'athena', name: 'Athena', icon: 'SearchCode', description: 'Real SQL via DuckDB, data catalogs', implemented: false, category: 'Analytics' },
    { id: 'firehose', name: 'Firehose', icon: 'Truck', description: 'Delivery streams, PutRecordBatch, S3 delivery', implemented: false, category: 'Analytics' },
    { id: 'route53', name: 'Route53', icon: 'Globe', description: 'Hosted zones, record sets, health checks', implemented: false, category: 'Networking' },
    { id: 'cognito', name: 'Cognito', icon: 'Lock', description: 'User pools, auth flows, TOTP MFA', implemented: false, category: 'Security' },
    { id: 'ec2', name: 'EC2', icon: 'Monitor', description: 'Instances, VPCs, Security Groups, ENIs', implemented: false, category: 'Compute' },
    { id: 'emr', name: 'EMR', icon: 'Zap', description: 'Clusters, steps, instance groups', implemented: false, category: 'Analytics' },
    { id: 'ebs', name: 'EBS', icon: 'HardDrive', description: 'Volumes, snapshots, attach/detach', implemented: false, category: 'Storage' },
    { id: 'efs', name: 'EFS', icon: 'Folder', description: 'File systems, mount targets', implemented: false, category: 'Storage' },
    { id: 'alb', name: 'ALB / ELBv2', icon: 'Scale', description: 'Load balancers, target groups, listeners', implemented: false, category: 'Networking' },
    { id: 'acm', name: 'ACM', icon: 'ShieldCheck', description: 'Request, import, describe certificates', implemented: false, category: 'Security' },
    { id: 'sesv2', name: 'SES v2', icon: 'Mail', description: 'SendEmail, identities, config sets', implemented: false, category: 'Integration' },
    { id: 'wafv2', name: 'WAF v2', icon: 'ShieldCheck', description: 'WebACLs, IP sets, rule groups', implemented: false, category: 'Security' },
    { id: 'cloudformation', name: 'CloudFormation', icon: 'Cloud', description: 'Stack lifecycle, change sets, templates', implemented: false, category: 'Management' },
    { id: 'kms', name: 'KMS', icon: 'Key', description: 'RSA & symmetric envelope encryption', implemented: false, category: 'Security' },
    { id: 'ecr', name: 'ECR', icon: 'Package', description: 'Local Docker Registry HTTP API V2 (OCI Distribution Spec) with concurrent disk storage', implemented: true, category: 'Storage' },
    { id: 'appsync', name: 'AppSync', icon: 'Zap', description: 'Serverless GraphQL architecture', implemented: false, category: 'Networking' },
    { id: 'cloudfront', name: 'CloudFront', icon: 'Globe', description: 'Edge location edge server emulation', implemented: false, category: 'Networking' },
    { id: 'autoscaling', name: 'AutoScaling', icon: 'Activity', description: 'ASGs, launch configs, scaling policies', implemented: false, category: 'Compute' },
    { id: 'codebuild', name: 'CodeBuild', icon: 'Hammer', description: 'Projects, builds, batch operations', implemented: false, category: 'Management' },
    { id: 'cloudmap', name: 'Cloud Map', icon: 'Map', description: 'HTTP/DNS namespaces, discovery', implemented: false, category: 'Networking' },
    { id: 's3files', name: 'S3 Files', icon: 'FolderOpen', description: 'File systems, mount targets (April 2026)', implemented: false, category: 'Storage' },
    { id: 'rdsdata', name: 'RDS Data API', icon: 'Database', description: 'ExecuteStatement, transactions', implemented: false, category: 'Database' },
    { id: 'opensearch', name: 'OpenSearch', icon: 'Search', description: 'Domains, versions, optional real cluster', implemented: false, category: 'Analytics' },
    { id: 'organizations', name: 'Organizations', icon: 'Building', description: 'Organization/Account management', implemented: false, category: 'Management' },
    { id: 'account', name: 'Account', icon: 'UserSquare', description: 'Account info, Contact info, Regions', implemented: false, category: 'Management' },
    { id: 'batch', name: 'Batch', icon: 'Settings', description: 'Compute envs, job queues, job defs', implemented: false, category: 'Compute' },
    { id: 'wafclassic', name: 'WAF Classic', icon: 'ShieldCheck', description: 'v1 + Regional stub for legacy', implemented: false, category: 'Security' },
    { id: 'imds', name: 'IMDS', icon: 'Radio', description: 'EC2 Instance Metadata Service v1 + v2', implemented: false, category: 'Compute' },
    { id: 'ebscheduler', name: 'EB Scheduler', icon: 'Clock', description: 'Schedules, rate/cron expressions', implemented: false, category: 'Integration' },
    { id: 'backup', name: 'Backup', icon: 'Save', description: 'Vaults, plans, recovery points', implemented: false, category: 'Management' },
    { id: 'appconfig', name: 'AppConfig', icon: 'Settings', description: 'Apps, environments, deployments', implemented: false, category: 'Management' },
    { id: 'transfer', name: 'Transfer', icon: 'MousePointer2', description: 'SFTP servers, users, public-key auth', implemented: false, category: 'Integration' },
    { id: 'eks', name: 'EKS', icon: 'Box', description: 'Clusters, node groups, Fargate profiles', implemented: false, category: 'Compute' },
    { id: 'tagging', name: 'Resource Tagging', icon: 'Settings', description: 'TagResources across services', implemented: false, category: 'Management' },
  ];

  const getIcon = (iconName: string, size = 18) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const icons: Record<string, any> = {
      Database, MessageSquare, DatabaseZap, Zap, ShieldCheck, Key, BarChart3, Settings, Network, Waves, Activity, Mail, RefreshCw, Globe, Search, Box, FlaskConical, SearchCode, Truck, Lock, Monitor, HardDrive, Folder, Scale, FileCheck, Cloud, Package, Hammer, Map, FolderOpen, Building, UserSquare, Settings2, Radio, Clock, Save, MousePointer2, TableProperties
    };
    const IconComponent = icons[iconName];
    return IconComponent ? <IconComponent size={size} /> : null;
  };

  const toggleFavorite = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setFavorites(prev =>
      prev.includes(id) ? prev.filter(f => f !== id) : [...prev, id]
    );
  };

  const categories = Array.from(new Set(services.map(s => s.category))).sort();

  const filteredServices = services
    .filter(s => {
      // Group filter
      if (selectedGroups.length > 0 && !selectedGroups.includes(s.category)) return false;

      // Search filter
      const matchesSearch = s.name.toLowerCase().includes(search.toLowerCase()) ||
        s.description.toLowerCase().includes(search.toLowerCase()) ||
        s.category.toLowerCase().includes(search.toLowerCase());

      if (!matchesSearch) return false;

      // Tab filter
      if (activeSubTab === 'favorites') return favorites.includes(s.id);
      if (activeSubTab === 'recent') return recent.includes(s.id);

      return true;
    })
    .sort((a, b) => {
      // In Recent tab, preserve the order of the 'recent' array
      if (activeSubTab === 'recent') {
        return recent.indexOf(a.id) - recent.indexOf(b.id);
      }

      // Otherwise, implemented first
      if (a.implemented !== b.implemented) {
        return a.implemented ? -1 : 1;
      }
      return 0;
    });

  const getCategoryStyles = (category: string, implemented: boolean) => {
    if (!implemented) {
      return {
        bg: 'bg-muted/40 text-muted-foreground',
        badge: 'bg-muted/50 border-muted text-muted-foreground',
        accent: 'bg-muted/40 border-muted/20',
      };
    }
    switch (category.toLowerCase()) {
      case 'messaging':
        return {
          bg: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 dark:bg-purple-500/15',
          badge: 'bg-purple-500/5 border-purple-500/20 text-purple-600 dark:text-purple-400',
          accent: 'bg-purple-500',
        };
      case 'storage':
        return {
          bg: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 dark:bg-blue-500/15',
          badge: 'bg-blue-500/5 border-blue-500/20 text-blue-600 dark:text-blue-400',
          accent: 'bg-blue-500',
        };
      case 'database':
        return {
          bg: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 dark:bg-amber-500/15',
          badge: 'bg-amber-500/5 border-amber-500/20 text-amber-600 dark:text-amber-400',
          accent: 'bg-amber-500',
        };
      case 'compute':
        return {
          bg: 'bg-orange-500/10 text-orange-600 dark:text-orange-400 dark:bg-orange-500/15',
          badge: 'bg-orange-500/5 border-orange-500/20 text-orange-600 dark:text-orange-400',
          accent: 'bg-orange-500',
        };
      case 'security':
        return {
          bg: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 dark:bg-emerald-500/15',
          badge: 'bg-emerald-500/5 border-emerald-500/20 text-emerald-600 dark:text-emerald-400',
          accent: 'bg-emerald-500',
        };
      case 'monitoring':
        return {
          bg: 'bg-pink-500/10 text-pink-600 dark:text-pink-400 dark:bg-pink-500/15',
          badge: 'bg-pink-500/5 border-pink-500/20 text-pink-600 dark:text-pink-400',
          accent: 'bg-pink-500',
        };
      case 'networking':
        return {
          bg: 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 dark:bg-cyan-500/15',
          badge: 'bg-cyan-500/5 border-cyan-500/20 text-cyan-600 dark:text-cyan-400',
          accent: 'bg-cyan-500',
        };
      case 'analytics':
        return {
          bg: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 dark:bg-indigo-500/15',
          badge: 'bg-indigo-500/5 border-indigo-500/20 text-indigo-600 dark:text-indigo-400',
          accent: 'bg-indigo-500',
        };
      case 'integration':
        return {
          bg: 'bg-teal-500/10 text-teal-600 dark:text-teal-400 dark:bg-teal-500/15',
          badge: 'bg-teal-500/5 border-teal-500/20 text-teal-600 dark:text-teal-400',
          accent: 'bg-teal-500',
        };
      case 'management':
      default:
        return {
          bg: 'bg-slate-500/10 text-slate-600 dark:text-slate-400 dark:bg-slate-500/15',
          badge: 'bg-slate-500/5 border-slate-500/20 text-slate-600 dark:text-slate-400',
          accent: 'bg-slate-500',
        };
    }
  };

  return (
    <div className="flex flex-col gap-6 animate-fade-in pb-20">
      {/* Service Catalog Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-content-muted/80">
            <span>Console</span>
            <span className="text-[10px] text-content-muted/40">/</span>
            <span className="text-brand-primary">Service Catalog</span>
          </div>
          <h1 className="m-0 text-3xl font-extrabold tracking-tight bg-linear-to-r from-content-primary via-content-primary to-content-muted bg-clip-text text-transparent">
            Service Catalog
          </h1>
          <p className="text-content-secondary text-[0.8rem] max-w-2xl leading-relaxed m-0">
            Explore and filter through all available cloud resources in your active region. Provision, scale, and manage infrastructure with a few clicks.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2 font-semibold cursor-pointer">
                <Filter size={14} />
                {selectedGroups.length === 0 
                  ? "Filter by Group" 
                  : `Group: ${selectedGroups.length} selected`}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56 bg-popover border border-border text-popover-foreground shadow-md p-1 z-50" align="end">
              <DropdownMenuLabel className="px-2 py-1.5 text-xs font-semibold text-content-muted">Cloud Services Categories</DropdownMenuLabel>
              <DropdownMenuSeparator className="-mx-1 my-1 h-px bg-border-subtle" />
              {categories.map((category) => (
                <DropdownMenuCheckboxItem
                  key={category}
                  checked={selectedGroups.includes(category)}
                  onCheckedChange={(checked) => {
                    setSelectedGroups((prev) =>
                      checked
                        ? [...prev, category]
                        : prev.filter((g) => g !== category)
                    );
                  }}
                  className="relative flex cursor-pointer items-center rounded-md py-1.5 pr-8 pl-2.5 text-xs font-medium outline-hidden select-none hover:bg-accent hover:text-accent-foreground"
                >
                  {category}
                </DropdownMenuCheckboxItem>
              ))}
              {selectedGroups.length > 0 && (
                <>
                  <DropdownMenuSeparator className="-mx-1 my-1 h-px bg-border-subtle" />
                  <DropdownMenuCheckboxItem
                    checked={false}
                    onCheckedChange={() => setSelectedGroups([])}
                    className="relative flex cursor-pointer items-center rounded-md py-1.5 pr-8 pl-2.5 text-xs font-bold text-destructive hover:bg-destructive/10 hover:text-destructive"
                  >
                    Clear Filters
                  </DropdownMenuCheckboxItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          <Button size="sm" className="bg-brand-primary hover:bg-brand-primary/95 text-white shadow-md gap-2 font-semibold transition-all hover:shadow-lg active:scale-95 border-0">
            <Plus size={14} />
            Launch Instance
          </Button>
        </div>
      </div>

      {/* Tabs and Search Area */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-surface-secondary/50 backdrop-blur-xs border border-border-subtle p-3 rounded-xl shadow-xs">
        <Tabs value={activeSubTab} onValueChange={(val) => setActiveSubTab(val as 'all' | 'recent' | 'favorites')} className="w-auto">
          <TabsList className="bg-surface-tertiary border border-border-strong/20 p-0.5 rounded-lg h-9">
            <TabsTrigger value="all" className="text-xs font-semibold px-4 py-1.5 data-[state=active]:bg-background dark:data-[state=active]:bg-input/60">
              All Services
            </TabsTrigger>
            <TabsTrigger value="recent" className="text-xs font-semibold px-4 py-1.5 data-[state=active]:bg-background dark:data-[state=active]:bg-input/60">
              Recently Visited
            </TabsTrigger>
            <TabsTrigger value="favorites" className="text-xs font-semibold px-4 py-1.5 data-[state=active]:bg-background dark:data-[state=active]:bg-input/60">
              Favorites
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="flex items-center gap-3 flex-wrap sm:flex-nowrap w-full lg:w-auto">
          {/* Search Input */}
          <div className="relative flex-1 sm:w-64 lg:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-content-muted" />
            <Input
              type="text"
              placeholder={`Filter ${activeSubTab === 'all' ? services.length : filteredServices.length} services...`}
              className="pl-9 bg-surface-secondary border-border-strong/40 focus-visible:ring-brand-primary/20 h-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {/* Total Indicator */}
          <div className="flex items-center gap-1.5 bg-surface-tertiary border border-border-strong/30 px-3 py-1.5 rounded-lg text-xs font-medium text-content-secondary h-9">
            <span className="text-[10px] uppercase tracking-wider text-content-muted font-bold">Total:</span>
            <span className="font-semibold text-content-primary bg-background dark:bg-input/40 px-1.5 py-0.5 rounded-sm">{filteredServices.length}</span>
          </div>

          {/* Grid/List View Toggles */}
          <div className="flex items-center bg-surface-tertiary border border-border-strong/30 p-0.5 rounded-lg h-9">
            <Button
              variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
              size="icon-sm"
              onClick={() => setViewMode('grid')}
              className={cn("h-8 w-8 rounded-md border-0 transition-colors", viewMode === 'grid' ? 'bg-background dark:bg-input/60 text-brand-primary' : 'text-content-muted')}
            >
              <LayoutGrid size={14} />
            </Button>
            <Button
              variant={viewMode === 'list' ? 'secondary' : 'ghost'}
              size="icon-sm"
              onClick={() => setViewMode('list')}
              className={cn("h-8 w-8 rounded-md border-0 transition-colors", viewMode === 'list' ? 'bg-background dark:bg-input/60 text-brand-primary' : 'text-content-muted')}
            >
              <List size={14} />
            </Button>
          </div>
        </div>
      </div>

      {viewMode === 'grid' ? (
        <div
          key={search + activeSubTab}
          className="grid grid-cols-[repeat(auto-fill,minmax(230px,1fr))] gap-3 animate-fade-in"
        >
          {filteredServices.map(service => {
            const catStyles = getCategoryStyles(service.category, service.implemented);
            return (
              <Card
                key={service.id}
                className={cn(
                  "relative flex flex-col h-full border transition-all duration-300 rounded-xl overflow-hidden",
                  service.implemented
                    ? "bg-card hover:bg-accent/5 cursor-pointer hover:shadow-md hover:border-brand-primary/40 hover:-translate-y-0.5 group/card"
                    : "bg-muted/30 opacity-70 border-dashed cursor-not-allowed"
                )}
                onClick={() => service.implemented && onNavigate(service.id)}
              >
                {/* Left Accent Border for Implemented */}
                {service.implemented && (
                  <div className={cn("absolute left-0 top-0 bottom-0 w-[3px]", catStyles.accent)} />
                )}

                <div className="p-4 flex flex-col h-full gap-3">
                  <div className="flex justify-between items-start">
                    <div className={cn(
                      "w-8 h-8 rounded-md flex items-center justify-center border transition-colors",
                      service.implemented 
                        ? `${catStyles.bg} border-current/15` 
                        : "bg-muted text-muted-foreground border-border"
                    )}>
                      {getIcon(service.icon, 14)}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={(e) => toggleFavorite(e, service.id)}
                        className={cn(
                          "p-1 rounded hover:bg-muted transition-all active:scale-90 cursor-pointer",
                          favorites.includes(service.id) ? 'text-amber-500' : 'text-content-muted/60'
                        )}
                      >
                        <Star size={13} fill={favorites.includes(service.id) ? 'currentColor' : 'none'} />
                      </button>
                      <span className={cn(
                        "text-[8px] font-bold px-1.5 py-0.5 rounded-full border uppercase tracking-wider",
                        catStyles.badge
                      )}>
                        {service.category}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-col gap-1 flex-grow">
                    <h3 className="m-0 text-xs font-bold tracking-tight text-content-primary group-hover/card:text-brand-primary transition-colors flex items-center gap-1">
                      {service.name}
                      {service.implemented && (
                        <ArrowRight size={10} className="opacity-0 -translate-x-1 group-hover/card:opacity-100 group-hover/card:translate-x-0 transition-all text-brand-primary" />
                      )}
                    </h3>
                    <p className="text-[11px] text-content-secondary leading-relaxed line-clamp-2 font-normal m-0">
                      {service.description}
                    </p>
                  </div>

                  <div className="flex justify-between items-center pt-2 border-t border-border-subtle/50 mt-auto">
                    {service.implemented ? (
                      <Badge variant="outline" className="h-4.5 px-1.5 bg-emerald-500/5 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 rounded-full font-bold text-[8px] uppercase tracking-wider gap-1.5">
                        <span className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse" />
                        Available
                      </Badge>
                    ) : (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Badge variant="outline" className="h-4.5 px-1.5 bg-muted/40 text-content-muted/60 border-border/30 rounded-full font-bold text-[8px] uppercase tracking-wider gap-1.5 cursor-help">
                              <span className="w-1 h-1 rounded-full bg-content-muted/30" />
                              Configuring
                            </Badge>
                          </TooltipTrigger>
                          <TooltipContent className="bg-popover border border-border text-popover-foreground shadow-md text-[10px] p-2">
                            This cloud service is currently offline or planned for a future release.
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      ) : (
        <div className="border border-border-subtle rounded-xl overflow-hidden bg-card shadow-xs animate-fade-in">
          <Table>
            <TableHeader className="bg-muted/40 border-b border-border-subtle">
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-[48px]"></TableHead>
                <TableHead className="font-semibold text-xs text-content-secondary uppercase tracking-wider py-3">Name</TableHead>
                <TableHead className="font-semibold text-xs text-content-secondary uppercase tracking-wider py-3">Description</TableHead>
                <TableHead className="font-semibold text-xs text-content-secondary uppercase tracking-wider py-3 w-[150px]">Category</TableHead>
                <TableHead className="font-semibold text-xs text-content-secondary uppercase tracking-wider py-3 w-[120px]">Status</TableHead>
                <TableHead className="w-[40px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredServices.map(service => {
                const catStyles = getCategoryStyles(service.category, service.implemented);
                return (
                  <TableRow
                    key={service.id}
                    onClick={() => service.implemented && onNavigate(service.id)}
                    className={cn(
                      "group/row cursor-pointer transition-colors border-b border-border-subtle/50 last:border-0",
                      service.implemented ? "hover:bg-muted/30" : "opacity-60 grayscale cursor-not-allowed hover:bg-transparent"
                    )}
                  >
                    <TableCell className="p-3">
                      <div className={cn(
                        "w-7 h-7 rounded-md flex items-center justify-center border transition-colors",
                        service.implemented 
                          ? `${catStyles.bg} border-current/15` 
                          : "bg-muted text-muted-foreground border-border"
                      )}>
                        {getIcon(service.icon, 13)}
                      </div>
                    </TableCell>
                    <TableCell className="p-3 font-semibold text-sm text-content-primary">
                      <div className="flex items-center gap-2">
                        <span>{service.name}</span>
                        {service.implemented && (
                          <ArrowRight size={12} className="opacity-0 -translate-x-1 group-hover/row:opacity-100 group-hover/row:translate-x-0 transition-all text-brand-primary" />
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="p-3 text-xs text-content-secondary max-w-md truncate">
                      {service.description}
                    </TableCell>
                    <TableCell className="p-3">
                      <span className={cn(
                        "text-[9px] font-bold px-2 py-0.5 rounded-full border uppercase tracking-wider",
                        catStyles.badge
                      )}>
                        {service.category}
                      </span>
                    </TableCell>
                    <TableCell className="p-3">
                      {service.implemented ? (
                        <Badge variant="outline" className="h-5 px-2 bg-emerald-500/5 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 rounded-full font-bold text-[9px] uppercase tracking-wider gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                          Available
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="h-5 px-2 bg-muted/40 text-content-muted/60 border-border/30 rounded-full font-bold text-[9px] uppercase tracking-wider gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-content-muted/30" />
                          Configuring
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="p-3" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={(e) => toggleFavorite(e, service.id)}
                        className={cn(
                          "p-1 rounded hover:bg-muted transition-colors cursor-pointer",
                          favorites.includes(service.id) ? "text-amber-500" : "text-content-muted/40"
                        )}
                      >
                        <Star size={14} fill={favorites.includes(service.id) ? "currentColor" : "none"} />
                      </button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}


    </div>
  );
};
