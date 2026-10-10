import React, { useEffect, useState } from 'react';
import { Card } from '../../../components/ui/card';
import { messagingService } from '../../messaging/services/messagingService';
import { ecrService } from '../../ecr/services/ecrService';
import { ecsService } from '../../ecs/services/ecsService';
import { 
  Layers,
  Radio,
  Box,
  Package,
  Activity,
  ArrowRight,
  Terminal,
  Play,
  Plus
} from 'lucide-react';

interface HomeDashboardProps {
  onNavigate: (tabId: string) => void;
}

export const HomeDashboard: React.FC<HomeDashboardProps> = ({ onNavigate }) => {
  const [metrics, setMetrics] = useState({
    queuesCount: 0,
    messagesCount: 0,
    topicsCount: 0,
    reposCount: 0,
    imagesCount: 0,
    clustersCount: 0,
    tasksCount: 0,
  });
  const [loading, setLoading] = useState(true);

  const fetchRealMetrics = async () => {
    try {
      const [queues, topics, repos, clusters] = await Promise.all([
        messagingService.getQueues(),
        messagingService.getTopics(),
        ecrService.getRepositories(),
        ecsService.getClusters()
      ]);

      // Calculate SQS messages count
      const messagesCount = queues.reduce(
        (acc, q) => acc + (q.attributes?.ApproximateNumberOfMessages || 0), 0
      );

      // Calculate ECR images count
      const imagesCount = repos.reduce((acc, repo) => acc + (repo.imageCount || 0), 0);

      // Calculate ECS running tasks count
      const tasksCount = clusters.reduce((acc, cls) => acc + (cls.runningTasksCount || 0), 0);

      setMetrics({
        queuesCount: queues.length,
        messagesCount,
        topicsCount: topics.length,
        reposCount: repos.length,
        imagesCount,
        clustersCount: clusters.length,
        tasksCount
      });
    } catch (err) {
      console.error('Failed to load dashboard metrics:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRealMetrics();
  }, []);

  const metricCards = [
    {
      title: 'SQS Queues',
      value: loading ? '...' : `${metrics.queuesCount} Queues`,
      subtext: loading ? '...' : `${metrics.messagesCount} pending messages`,
      icon: Layers,
      color: 'text-brand-primary',
      bg: 'bg-brand-primary/5',
      tab: 'messaging'
    },
    {
      title: 'SNS Topics',
      value: loading ? '...' : `${metrics.topicsCount} Topics`,
      subtext: 'Active pub/sub channels',
      icon: Radio,
      color: 'text-amber-500',
      bg: 'bg-amber-500/5',
      tab: 'messaging'
    },
    {
      title: 'ECS Clusters',
      value: loading ? '...' : `${metrics.clustersCount} Clusters`,
      subtext: loading ? '...' : `${metrics.tasksCount} running tasks`,
      icon: Box,
      color: 'text-emerald-500',
      bg: 'bg-emerald-500/5',
      tab: 'ecs'
    },
    {
      title: 'ECR Repositories',
      value: loading ? '...' : `${metrics.reposCount} Repositories`,
      subtext: loading ? '...' : `${metrics.imagesCount} docker images`,
      icon: Package,
      color: 'text-violet-500',
      bg: 'bg-violet-500/5',
      tab: 'ecr'
    }
  ];

  return (
    <div className="flex flex-col gap-8 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-content-primary mb-1">Local AWS Console</h1>
        <p className="text-content-secondary text-xs font-medium">
          Monitor resources, manage queues and inspect local emulated infrastructure.
        </p>
      </div>

      {/* Real-time Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {metricCards.map((card, i) => (
          <Card 
            key={i} 
            onClick={() => onNavigate(card.tab)}
            className="p-5 bg-surface-secondary border-border-subtle hover:border-brand-primary transition-all cursor-pointer group flex flex-col justify-between min-h-[120px]"
          >
            <div className="flex justify-between items-start">
              <span className="text-[10px] font-bold text-content-muted uppercase tracking-wider">{card.title}</span>
              <div className={`p-1.5 rounded-lg ${card.bg}`}>
                <card.icon size={15} className={card.color} />
              </div>
            </div>
            <div className="flex flex-col gap-0.5 mt-3">
              <span className="text-xl font-bold text-content-primary leading-none">{card.value}</span>
              <span className="text-[10px] text-content-muted font-medium mt-1">{card.subtext}</span>
            </div>
          </Card>
        ))}
      </div>

      {/* Main Sections Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        
        {/* Emulator Services Health */}
        <div className="xl:col-span-1 rounded-xl border border-border-subtle bg-surface-secondary p-5 flex flex-col gap-4">
          <div className="flex items-center gap-2 pb-3 border-b border-border-subtle/60">
            <Activity size={16} className="text-emerald-500" />
            <h3 className="font-semibold text-sm text-content-primary">Infrastructure Health</h3>
          </div>
          <div className="flex flex-col gap-3">
            {[
              { name: 'Simple Queue Service (SQS)', status: 'Online', port: '4566' },
              { name: 'Simple Notification Service (SNS)', status: 'Online', port: '4566' },
              { name: 'Elastic Container Service (ECS)', status: 'Online', port: '4566' },
              { name: 'Elastic Container Registry (ECR)', status: 'Online', port: '4566' },
            ].map((srv, i) => (
              <div key={i} className="flex justify-between items-center text-xs">
                <div className="flex flex-col">
                  <span className="font-medium text-content-primary">{srv.name}</span>
                  <span className="text-[9px] text-content-muted font-mono">localhost:{srv.port}</span>
                </div>
                <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-status-success/10 text-status-success uppercase">
                  {srv.status}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Quick Actions Hub */}
        <div className="xl:col-span-1 rounded-xl border border-border-subtle bg-surface-secondary p-5 flex flex-col gap-4">
          <div className="flex items-center gap-2 pb-3 border-b border-border-subtle/60">
            <Terminal size={16} className="text-brand-primary" />
            <h3 className="font-semibold text-sm text-content-primary">Quick Shortcuts</h3>
          </div>
          <div className="flex flex-col gap-2.5">
            {[
              { label: 'Create new SQS Queue', tab: 'messaging', action: 'create-queue', icon: Plus },
              { label: 'Publish message to Topic', tab: 'messaging', action: 'publish-topic', icon: Play },
              { label: 'Inspect ECR Docker Images', tab: 'ecr', action: 'view-images', icon: ArrowRight },
            ].map((act, i) => (
              <button
                key={i}
                onClick={() => onNavigate(act.tab)}
                className="w-full text-left bg-surface-tertiary/40 border border-border-strong/50 hover:border-brand-primary/40 rounded-lg p-3 text-xs font-semibold text-content-secondary flex items-center justify-between transition-colors group cursor-pointer"
              >
                <span>{act.label}</span>
                <act.icon size={13} className="text-content-muted group-hover:text-brand-primary transition-colors" />
              </button>
            ))}
          </div>
        </div>

        {/* Local Environment Info */}
        <div className="xl:col-span-1 rounded-xl border border-border-subtle bg-surface-secondary p-5 flex flex-col gap-4">
          <div className="flex items-center gap-2 pb-3 border-b border-border-subtle/60">
            <Terminal size={16} className="text-content-primary" />
            <h3 className="font-semibold text-sm text-content-primary">Environment Config</h3>
          </div>
          <div className="flex flex-col gap-2.5 text-xs text-content-secondary">
            <div className="flex justify-between">
              <span className="font-medium">Docker Daemon</span>
              <span className="font-mono text-content-primary font-bold">Connected</span>
            </div>
            <div className="flex justify-between">
              <span className="font-medium">Persistence State</span>
              <span className="text-amber-500 font-bold">Enabled</span>
            </div>
            <div className="flex justify-between">
              <span className="font-medium">State Directory</span>
              <span className="font-mono text-[10px] text-content-muted">/data/ministack-state</span>
            </div>
            <div className="flex justify-between">
              <span className="font-medium">Local host url</span>
              <span className="font-mono text-[10px] text-brand-primary font-semibold">http://localhost:4566</span>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};
