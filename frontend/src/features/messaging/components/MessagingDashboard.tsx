import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { Card } from '../../../components/ui/card';
import { Skeleton } from '../../../components/ui/skeleton';
import { messagingService } from '../services/messagingService';
import type { SQSQueue, SNSTopic, Message } from '../types';
import {
  MessageSquare,
  Radio,
  Trash2,
  Send,
  Zap,
  Eye,
  ScrollText,
  Plus,
  X,
  History,
  CheckCircle2,
  AlertCircle,
  ChevronDown,
  Layers,
  Ban,
  RefreshCw,
} from 'lucide-react';

export const MessagingDashboard: React.FC = () => {
  const [queues, setQueues] = useState<SQSQueue[]>([]);
  const [topics, setTopics] = useState<SNSTopic[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState<'queue' | 'topic' | null>(null);
  const [showSubscribeModal, setShowSubscribeModal] = useState<SNSTopic | null>(null);
  const [viewMessages, setViewMessages] = useState<{ queueName: string; messages: Message[]; isDLQ?: boolean; url?: string } | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [viewHistory, setViewHistory] = useState<{ name: string; history: any[] } | null>(null);
  const [interactionModal, setInteractionModal] = useState<{ type: 'sqs' | 'sns'; name: string; id: string } | null>(null);
  const [selectedQueueArn, setSelectedQueueArn] = useState('');
  const [interactionBody, setInteractionBody] = useState('');
  const [isBatchMode, setIsBatchMode] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{ type: 'sqs' | 'sns'; name: string; id: string } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [redriving, setRedriving] = useState<string | null>(null);
  const initializedRef = React.useRef(false);

  const [formData, setFormData] = useState({
    name: '',
    isFifo: false,
    useDLQ: false,
    useSNS: false,
    createNewTopic: false,
    existingTopicArn: '',
    newTopicName: ''
  });

  const resetFormData = () => {
    setFormData({
      name: '',
      isFifo: false,
      useDLQ: false,
      useSNS: false,
      createNewTopic: false,
      existingTopicArn: '',
      newTopicName: ''
    });
  };

  const handleOpenCreateModal = (type: 'queue' | 'topic') => {
    resetFormData();
    setShowCreateModal(type);
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const [qData, tData] = await Promise.all([
        messagingService.getQueues(),
        messagingService.getTopics()
      ]);
      setQueues(qData);
      setTopics(tData);
    } catch (error) {
      console.error('Failed to load messaging data:', error);
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    if (!initializedRef.current) {
      loadData();
      initializedRef.current = true;
    }
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (showCreateModal === 'queue') {
        const rawNames = formData.name;
        let names: string[] = [];
        if (isBatchMode) {
          names = rawNames
            .split(/[\n,]+/)
            .map(n => n.trim())
            .filter(n => n.length > 0);
        } else {
          names = [rawNames.trim()];
        }

        if (names.length === 0) return;

        await Promise.all(
          names.map(name => {
            const dlqName = name.endsWith('_dlq') ? name : `${name}_dlq`;
            const topicName = name.endsWith('_notif') ? name : `${name}_notif`;

            return messagingService.createQueue({
              name: name,
              attributes: {
                VisibilityTimeout: 30,
                DelaySeconds: 0,
                FifoQueue: formData.isFifo ? 'true' : 'false'
              },
              createDlq: formData.useDLQ,
              dlqName: formData.useDLQ ? dlqName : undefined,
              maxReceiveCount: 3,
              snsAssociation: formData.useSNS ? {
                createNewTopic: formData.createNewTopic,
                topicArn: formData.createNewTopic ? undefined : formData.existingTopicArn,
                newTopicName: formData.createNewTopic ? topicName : undefined
              } : undefined
            });
          })
        );
      } else {
        const baseName = formData.name.trim();
        const topicName = baseName.endsWith('_notif') ? baseName : `${baseName}_notif`;
        await messagingService.createTopic({ name: topicName });
      }
      setFormData({
        name: '',
        isFifo: false,
        useDLQ: false,
        useSNS: false,
        createNewTopic: false,
        existingTopicArn: '',
        newTopicName: ''
      });
      setIsBatchMode(false);
      setShowCreateModal(null);
      loadData();
    } catch (error) {
      console.error('Failed to create resource:', error);
    }
  };

  const handleSubscribe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showSubscribeModal || !selectedQueueArn) return;
    try {
      await messagingService.subscribe(showSubscribeModal.arn, selectedQueueArn);
      setShowSubscribeModal(null);
      setSelectedQueueArn('');
      loadData();
    } catch (error) {
      console.error('Failed to subscribe:', error);
    }
  };

  const handleInteraction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!interactionModal || !interactionBody) return;
    try {
      if (interactionModal.type === 'sqs') {
        await messagingService.sendMessage(interactionModal.id, interactionBody);
      } else {
        await messagingService.publish(interactionModal.id, interactionBody);
      }
      setInteractionModal(null);
      setInteractionBody('');
      setTimeout(loadData, 500);
    } catch (error) {
      console.error('Interaction failed:', error);
    }
  };

  const handleRedrive = async (dlqUrl: string) => {
    const dlqQueue = queues.find(q => q.url === dlqUrl);
    if (!dlqQueue) return;

    const sourceQueue = queues.find(
      q => q.dlqStatus?.url === dlqUrl || (q.name + '_dlq' === dlqQueue.name)
    );

    if (!sourceQueue) {
      console.error('Source queue not found for DLQ:', dlqQueue.name);
      return;
    }

    setRedriving(dlqUrl);
    try {
      await messagingService.redrive(dlqUrl, sourceQueue.url);
      setTimeout(loadData, 500);
      if (viewMessages && viewMessages.url === dlqUrl) {
        setViewMessages(prev => prev ? { ...prev, messages: [] } : null);
      }
    } catch (error) {
      console.error('Failed to redrive messages:', error);
    } finally {
      setRedriving(null);
    }
  };

  const handleDeleteQueue = (name: string, url: string) => {
    setDeleteError(null);
    setDeleteConfirm({ type: 'sqs', name, id: url });
  };

  const handleDeleteTopic = (name: string, arn: string) => {
    setDeleteError(null);
    setDeleteConfirm({ type: 'sns', name, id: arn });
  };

  const executeDelete = async () => {
    if (!deleteConfirm) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      if (deleteConfirm.type === 'sqs') {
        await messagingService.deleteQueue(deleteConfirm.id);
      } else {
        await messagingService.deleteTopic(deleteConfirm.id);
      }
      setDeleteConfirm(null);
      loadData();
    } catch (error) {
      setDeleteError((error as Error).message || 'Delete failed');
      console.error('Delete failed:', error);
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col gap-5 animate-fade-in duration-500">
        <header className="flex justify-between items-end">
          <div className="flex flex-col gap-1">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-3 w-40" />
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-8 w-24" />
            <Skeleton className="h-8 w-24" />
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {[1, 2].map(i => (
            <section key={i} className="flex flex-col gap-3">
              <Skeleton className="h-4 w-32" />
              <div className="flex flex-col gap-3">
                {[1, 2, 3].map(j => (
                  <Card key={j} contentClassName="flex flex-row items-center justify-between gap-4" disableHover>
                    <div className="flex items-center gap-3">
                      <Skeleton variant="circular" className="w-8 h-8 shrink-0" />
                      <div className="flex flex-col gap-1">
                        <Skeleton className="h-3 w-24" />
                        <Skeleton className="h-2 w-32" />
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <Skeleton className="h-7 w-20" />
                    </div>
                  </Card>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    );
  }

  const totalQueuedMessages = queues
    .filter(q => !q.name.toLowerCase().includes('dlq'))
    .reduce((acc, q) => acc + (q.attributes?.ApproximateNumberOfMessages || 0), 0);

  const totalSubscriptions = topics.reduce((acc, t) => acc + (t.subscriptions?.length || 0), 0);

  const totalDLQMessages = queues
    .filter(q => q.name.toLowerCase().includes('dlq'))
    .reduce((acc, q) => acc + (q.attributes?.ApproximateNumberOfMessages || 0), 0);

  const isBodyEmpty = !interactionBody.trim();
  let isJsonInvalid = false;
  if (interactionBody.trim()) {
    try {
      JSON.parse(interactionBody);
    } catch (e) {
      isJsonInvalid = true;
    }
  }

  return (
    <>
      <div className="flex flex-col gap-1 animate-fade-in animate-slide-up">
        {/* Breadcrumb */}
        <div className="flex items-center gap-1.5 text-[10px] font-medium text-content-muted uppercase tracking-wider mb-1">
          <span>Console</span>
          <span>/</span>
          <span className="text-content-secondary">Messaging Services</span>
        </div>

        {/* Page Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div className="flex flex-col gap-1">
            <h1 className="m-0 text-2xl font-semibold tracking-tight text-content-primary">Messaging Services</h1>
            <p className="text-content-secondary text-xs leading-normal font-medium">
              Manage SQS Queues and SNS Topics with real-time operational insights.
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={() => handleOpenCreateModal('topic')}
              className="bg-surface-secondary border border-border-strong text-content-primary hover:bg-surface-tertiary text-xs font-medium py-1.5 px-3 rounded-md flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer"
            >
              <Zap size={14} className="text-brand-primary" /> Create Topic
            </button>
            <button
              onClick={() => handleOpenCreateModal('queue')}
              className="bg-content-primary text-surface-secondary hover:bg-content-primary/90 text-xs font-medium py-1.5 px-3 rounded-md flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer"
            >
              <Layers size={14} /> Create Queue
            </button>
          </div>
        </div>

        {/* Top Metrics Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="rounded-xl border border-border-subtle bg-surface-secondary p-4 shadow-xs flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium text-content-secondary uppercase tracking-wider">Queued Messages</span>
              <MessageSquare size={15} className="text-content-muted" />
            </div>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-semibold tracking-tight text-content-primary">{totalQueuedMessages}</span>
              {totalQueuedMessages > 0 && (
                <span className="text-[9px] font-bold text-status-success bg-status-success/10 px-1.5 py-0.5 rounded">
                  Active
                </span>
              )}
            </div>
            <span className="text-[10px] text-content-muted font-medium mt-0.5">Approximate messages count</span>
          </div>

          <div className="rounded-xl border border-border-subtle bg-surface-secondary p-4 shadow-xs flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium text-content-secondary uppercase tracking-wider">Active Topics</span>
              <Radio size={15} className="text-content-muted" />
            </div>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-semibold tracking-tight text-content-primary">{topics.length}</span>
              <span className="text-[9px] font-bold bg-brand-primary/10 text-brand-primary px-1.5 py-0.5 rounded uppercase">SNS</span>
            </div>
            <span className="text-[10px] text-content-muted font-medium mt-0.5">Registered SNS topics</span>
          </div>

          <div className="rounded-xl border border-border-subtle bg-surface-secondary p-4 shadow-xs flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium text-content-secondary uppercase tracking-wider">Active Subscriptions</span>
              <Zap size={15} className="text-content-muted" />
            </div>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-semibold tracking-tight text-content-primary">{totalSubscriptions}</span>
            </div>
            <span className="text-[10px] text-content-muted font-medium mt-0.5">Mapped across active topics</span>
          </div>

          <div className="rounded-xl border border-border-subtle bg-surface-secondary p-4 shadow-xs flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium text-content-secondary uppercase tracking-wider">Dead Letters</span>
              <Ban size={15} className="text-status-danger opacity-85" />
            </div>
            <div className="flex items-baseline gap-2 mt-1">
              <span className={`text-2xl font-semibold tracking-tight ${totalDLQMessages > 0 ? 'text-status-danger' : 'text-content-primary'}`}>{totalDLQMessages}</span>
              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase ${totalDLQMessages > 0 ? 'bg-status-error/10 text-status-error' : 'bg-content-muted/10 text-content-muted'}`}>
                {totalDLQMessages > 0 ? 'Failure' : 'None'}
              </span>
            </div>
            <span className="text-[10px] text-content-muted font-medium mt-0.5">Messages in DLQ queues</span>
          </div>
        </div>

        {/* SQS Queues and DLQ Section */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-6">
          {/* SQS Queues Card */}
          <div className="rounded-xl border border-border-subtle bg-surface-secondary shadow-xs flex flex-col overflow-hidden">
            <div className="p-4 border-b border-border-subtle flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MessageSquare size={16} className="text-content-primary" />
                <h3 className="font-semibold text-sm text-content-primary">SQS Queues</h3>
                <span className="text-[10px] font-medium bg-surface-tertiary text-content-muted px-2 py-0.5 rounded-full border border-border-subtle">
                  {queues.filter(q => !q.name.toLowerCase().includes('dlq')).length} Active
                </span>
              </div>
            </div>

            <div className="p-0">
              <div className="max-h-[300px] overflow-y-auto pr-0 custom-scrollbar">
                {queues.filter(q => !q.name.toLowerCase().includes('dlq')).length > 0 ? (
                  <table className="w-full text-left border-collapse text-xs">
                    <thead className="bg-surface-tertiary/50 border-b border-border-subtle sticky top-0 z-10 backdrop-blur-xs">
                      <tr>
                        <th className="px-4 py-2.5 text-[10px] font-semibold text-content-muted uppercase tracking-wider">Queue Name</th>
                        <th className="px-4 py-2.5 text-[10px] font-semibold text-content-muted uppercase tracking-wider text-center">Messages</th>
                        <th className="px-4 py-2.5 text-[10px] font-semibold text-content-muted uppercase tracking-wider text-center">Delay</th>
                        <th className="px-4 py-2.5 text-[10px] font-semibold text-content-muted uppercase tracking-wider text-right pr-6">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border-subtle/40">
                      {queues.filter(q => !q.name.toLowerCase().includes('dlq')).map(queue => (
                        <tr key={queue.id} className="hover:bg-surface-tertiary/30 transition-colors">
                          <td className="px-4 py-2 font-medium text-content-primary">
                            <div className="flex items-center gap-2 min-w-0 max-w-[220px] sm:max-w-none">
                              <span className="truncate" title={queue.name}>{queue.name}</span>
                              {queue.name.toLowerCase().includes('fifo') && (
                                <span className="text-[8px] font-bold bg-surface-tertiary text-content-muted px-1.5 py-0.2 rounded uppercase border border-border-subtle scale-95 shrink-0">FIFO</span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-2 text-center font-semibold text-content-secondary">
                            {queue.attributes.ApproximateNumberOfMessages || 0}
                          </td>
                          <td className="px-4 py-2 text-center text-content-muted">
                            {queue.attributes.DelaySeconds}s
                          </td>
                          <td className="px-4 py-2 text-right pr-6">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={() => setViewMessages({ queueName: queue.name, messages: queue.messages || [], url: queue.url })}
                                className="p-1 hover:bg-surface-tertiary rounded text-content-muted hover:text-content-primary transition-all cursor-pointer"
                                title="View Messages"
                              >
                                <Eye size={13} />
                              </button>
                              <button
                                onClick={() => setInteractionModal({ type: 'sqs', name: queue.name, id: queue.url })}
                                className="p-1 hover:bg-surface-tertiary rounded text-content-muted hover:text-brand-primary transition-all cursor-pointer"
                                title="Send Message"
                              >
                                <Send size={13} />
                              </button>
                              <button
                                onClick={() => setViewHistory({ name: queue.name, history: queue.sendHistory || [] })}
                                className="p-1 hover:bg-surface-tertiary rounded text-content-muted hover:text-content-primary transition-all cursor-pointer"
                                title="History"
                              >
                                <History size={13} />
                              </button>
                              <button
                                onClick={() => handleDeleteQueue(queue.name, queue.url)}
                                className="p-1 hover:bg-surface-tertiary rounded text-content-muted hover:text-status-danger transition-all cursor-pointer"
                                title="Delete"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div className="p-8 flex flex-col items-center justify-center gap-2 min-h-[220px]">
                    <div className="w-10 h-10 bg-surface-tertiary rounded-full flex items-center justify-center text-content-muted/30">
                      <MessageSquare size={20} />
                    </div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-content-muted/80">No queues found</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* SQS DLQ Card */}
          <div className="rounded-xl border border-border-subtle bg-surface-secondary shadow-xs flex flex-col overflow-hidden">
            <div className="p-4 border-b border-border-subtle flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Ban size={16} className="text-status-danger" />
                <h3 className="font-semibold text-sm text-content-primary">SQS DLQ Queues</h3>
                <span className="text-[10px] font-medium bg-status-danger/5 text-status-danger px-2 py-0.5 rounded-full border border-status-danger/10">
                  {queues.filter(q => q.name.toLowerCase().includes('dlq')).length} Monitored
                </span>
              </div>
            </div>

            <div className="p-0">
              <div className="max-h-[300px] overflow-y-auto pr-0 custom-scrollbar">
                {queues.filter(q => q.name.toLowerCase().includes('dlq')).length > 0 ? (
                  <table className="w-full text-left border-collapse text-xs">
                    <thead className="bg-surface-tertiary/50 border-b border-border-subtle sticky top-0 z-10 backdrop-blur-xs">
                      <tr>
                        <th className="px-4 py-2.5 text-[10px] font-semibold text-content-muted uppercase tracking-wider">Queue Name</th>
                        <th className="px-4 py-2.5 text-[10px] font-semibold text-content-muted uppercase tracking-wider text-center">Dead Letters</th>
                        <th className="px-4 py-2.5 text-[10px] font-semibold text-content-muted uppercase tracking-wider text-right pr-6">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border-subtle/40">
                      {queues.filter(q => q.name.toLowerCase().includes('dlq')).map(queue => (
                        <tr key={queue.id} className="hover:bg-surface-tertiary/30 transition-colors">
                          <td className="px-4 py-2 font-medium text-content-primary">
                            <div className="flex items-center gap-2 min-w-0 max-w-[220px] sm:max-w-none">
                              <span className="truncate text-status-danger" title={queue.name}>{queue.name}</span>
                              <span className="text-[8px] font-bold bg-status-danger/10 text-status-danger px-1.5 py-0.2 rounded uppercase border border-status-danger/20 scale-95 shrink-0">DLQ</span>
                            </div>
                          </td>
                          <td className="px-4 py-2 text-center font-bold">
                            <span className={queue.attributes.ApproximateNumberOfMessages > 0 ? "text-status-danger bg-status-danger/10 px-2 py-0.5 rounded" : "text-content-secondary"}>
                              {queue.attributes.ApproximateNumberOfMessages || 0}
                            </span>
                          </td>
                          <td className="px-4 py-2 text-right pr-6">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => handleRedrive(queue.url)}
                                disabled={redriving !== null || (queue.attributes?.ApproximateNumberOfMessages || 0) === 0}
                                className={`p-1 rounded transition-all ${
                                  redriving === queue.url
                                    ? 'animate-spin text-brand-primary'
                                    : (queue.attributes?.ApproximateNumberOfMessages || 0) === 0
                                      ? 'text-content-muted/30 cursor-not-allowed'
                                      : 'text-content-muted hover:text-brand-primary hover:bg-surface-tertiary cursor-pointer'
                                }`}
                                title={(queue.attributes?.ApproximateNumberOfMessages || 0) === 0 ? "No messages to redrive" : "Redrive Messages"}
                              >
                                <RefreshCw size={13} />
                              </button>
                              <button
                                onClick={() => setViewMessages({ queueName: queue.name, messages: queue.messages || [], url: queue.url, isDLQ: true })}
                                className="p-1 hover:bg-surface-tertiary rounded text-content-muted hover:text-content-primary transition-all cursor-pointer"
                                title="View Messages"
                              >
                                <Eye size={13} />
                              </button>
                              <button
                                onClick={() => handleDeleteQueue(queue.name, queue.url)}
                                className="p-1 hover:bg-surface-tertiary rounded text-content-muted hover:text-status-danger transition-all cursor-pointer"
                                title="Delete"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div className="p-8 flex flex-col items-center justify-center gap-2 min-h-[220px] bg-status-success/[0.01]">
                    <div className="w-10 h-10 bg-status-success/10 rounded-full flex items-center justify-center text-status-success">
                      <CheckCircle2 size={20} />
                    </div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-status-success">System Healthy</span>
                    <span className="text-[9px] text-content-muted font-medium">No dead-letter queues found.</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* SNS Topics Card */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-12">
          <div className="rounded-xl border border-border-subtle bg-surface-secondary shadow-xs flex flex-col overflow-hidden">
            <div className="p-4 border-b border-border-subtle flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Radio size={16} className="text-content-primary" />
                <h3 className="font-semibold text-sm text-content-primary">SNS Topics</h3>
                <span className="text-[10px] font-medium bg-surface-tertiary text-content-muted px-2 py-0.5 rounded-full border border-border-subtle">
                  {topics.length} Topics
                </span>
              </div>
            </div>

            <div className="p-0">
              <div className="max-h-[280px] overflow-y-auto pr-0 custom-scrollbar">
                {topics.length > 0 ? (
                  <table className="w-full text-left border-collapse text-xs">
                    <thead className="bg-surface-tertiary/50 border-b border-border-subtle sticky top-0 z-10 backdrop-blur-xs">
                      <tr>
                        <th className="px-4 py-2.5 text-[10px] font-semibold text-content-muted uppercase tracking-wider">Topic Name</th>
                        <th className="px-4 py-2.5 text-[10px] font-semibold text-content-muted uppercase tracking-wider text-center">Subscriptions</th>
                        <th className="px-4 py-2.5 text-[10px] font-semibold text-content-muted uppercase tracking-wider text-right pr-6">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border-subtle/40">
                      {topics.map(topic => (
                        <tr key={topic.id} className="hover:bg-surface-tertiary/30 transition-colors">
                          <td className="px-4 py-2 font-medium text-content-primary">
                            <div className="flex items-center gap-2 min-w-0 max-w-[220px] sm:max-w-none">
                              <span className="truncate" title={topic.name}>{topic.name}</span>
                              <span className="text-[8px] font-bold bg-surface-tertiary text-content-muted px-1.5 py-0.2 rounded uppercase border border-border-subtle scale-95 shrink-0">SNS</span>
                            </div>
                          </td>
                          <td className="px-4 py-2 text-center font-semibold text-content-secondary">
                            {topic.subscriptions?.length || 0}
                          </td>
                          <td className="px-4 py-2 text-right pr-6">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => setShowSubscribeModal(topic)}
                                className="p-1 hover:bg-surface-tertiary rounded text-content-muted hover:text-brand-primary transition-all cursor-pointer"
                                title="Add Subscription"
                              >
                                <Plus size={13} />
                              </button>
                              <button
                                onClick={() => setInteractionModal({ type: 'sns', name: topic.name, id: topic.arn })}
                                className="p-1 hover:bg-surface-tertiary rounded text-content-muted hover:text-brand-primary transition-all cursor-pointer"
                                title="Publish Message"
                              >
                                <Zap size={13} />
                              </button>
                              <button
                                onClick={() => handleDeleteTopic(topic.name, topic.arn)}
                                className="p-1 hover:bg-surface-tertiary rounded text-content-muted hover:text-status-danger transition-all cursor-pointer"
                                title="Delete"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div className="p-8 flex flex-col items-center justify-center gap-2 min-h-[200px]">
                    <div className="w-10 h-10 bg-surface-tertiary rounded-full flex items-center justify-center text-content-muted/30">
                      <Radio size={20} />
                    </div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-content-muted/80">No topics found</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* SNS Insights/Helper Card */}
          <div className="border border-dashed border-border-strong/30 rounded-xl flex flex-col items-center justify-center gap-3 bg-surface-tertiary/10 min-h-[220px] group hover:border-border-strong transition-all cursor-pointer shadow-xs">
            <div className="w-10 h-10 rounded-full border border-border-subtle flex items-center justify-center text-content-muted group-hover:scale-105 transition-all bg-surface-secondary">
              <Plus size={18} className="opacity-30" />
            </div>
            <span className="text-[10px] font-semibold text-content-muted uppercase tracking-wider">Create more topics to view insights</span>
          </div>
        </div>

        {/* Footer */}
        <footer className="mt-8 py-8 border-t border-border-subtle flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-[10px] font-semibold text-content-muted uppercase tracking-wider">
            © 2026 Amazon Web Services, Inc. or its affiliates. All rights reserved.
          </p>
          <div className="flex gap-6 text-[10px] font-semibold text-content-muted uppercase tracking-wider">
            <a href="#" className="hover:text-brand-primary transition-colors">Privacy Policy</a>
            <a href="#" className="hover:text-brand-primary transition-colors">Terms of Use</a>
            <a href="#" className="hover:text-brand-primary transition-colors">Cookies</a>
          </div>
        </footer>
      </div>

      {/* Messages Peek Modal */}
      {viewMessages && createPortal(
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-[10000] p-6 animate-fade-in">
          <Card
            title={`Messages for ${viewMessages.queueName}`}
            className="w-full max-w-4xl bg-surface-secondary shadow-2xl border border-border-strong/60 overflow-hidden rounded-xl"
            contentClassName="p-0"
            disableHover
          >
            <div className="max-h-[50vh] overflow-y-auto custom-scrollbar">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="bg-surface-tertiary border-b border-border-subtle sticky top-0 z-10">
                  <tr>
                    <th className="px-4 py-2 text-[10px] font-semibold text-content-muted uppercase tracking-wider">Message ID</th>
                    <th className="px-4 py-2 text-[10px] font-semibold text-content-muted uppercase tracking-wider">Body</th>
                    <th className="px-4 py-2 text-[10px] font-semibold text-content-muted uppercase tracking-wider">Sent At</th>
                    {viewMessages.isDLQ && <th className="px-4 py-2 text-[10px] font-semibold text-content-muted uppercase tracking-wider text-right pr-6">Actions</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle/40">
                  {viewMessages.messages.length > 0 ? (
                    viewMessages.messages.map(msg => (
                      <tr key={msg.id} className="hover:bg-surface-tertiary/20 transition-colors">
                        <td className="px-4 py-2.5 font-mono text-[10px] text-brand-primary font-semibold">{msg.id.slice(0, 8)}...</td>
                        <td className="px-4 py-2.5">
                          <pre className="text-[10px] text-content-secondary font-mono bg-surface-primary/75 p-2 rounded-md border border-border-subtle max-h-[90px] overflow-y-auto custom-scrollbar leading-relaxed">
                            {msg.body}
                          </pre>
                        </td>
                        <td className="px-4 py-2.5 text-[10px] text-content-muted font-medium">
                          {msg.attributes?.sentAt ? new Date(msg.attributes.sentAt).toLocaleString() : '—'}
                        </td>
                        {viewMessages.isDLQ && (
                          <td className="px-4 py-2.5 text-right pr-6">
                            <button
                              onClick={() => {
                                setViewMessages({
                                  ...viewMessages,
                                  messages: viewMessages.messages.filter(m => m.id !== msg.id)
                                });
                              }}
                              className="p-1 text-status-danger hover:bg-status-danger/10 rounded transition-all cursor-pointer"
                              title="Delete Message"
                            >
                              <Trash2 size={13} />
                            </button>
                          </td>
                        )}
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={viewMessages.isDLQ ? 4 : 3} className="px-4 py-10 text-center">
                        <div className="flex flex-col items-center gap-2 opacity-50">
                          <ScrollText size={28} className="text-content-muted" />
                          <span className="text-[10px] font-bold uppercase tracking-wider text-content-muted">Queue is empty</span>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="px-4 py-3 bg-surface-tertiary border-t border-border-subtle flex justify-end gap-2">
              {viewMessages.isDLQ && viewMessages.messages.length > 0 && (
                <button
                  className="bg-brand-primary text-white hover:bg-brand-primary/90 disabled:bg-brand-primary/50 text-xs font-semibold py-1.5 px-3 rounded-md shadow-sm flex items-center gap-1.5 transition-colors cursor-pointer"
                  onClick={() => {
                    if (viewMessages.url) {
                      handleRedrive(viewMessages.url);
                    }
                  }}
                  disabled={redriving !== null}
                >
                  <RefreshCw size={13} className={redriving === viewMessages.url ? "animate-spin" : ""} />
                  Redrive Messages
                </button>
              )}
              <button
                className="bg-surface-secondary border border-border-strong text-content-primary hover:bg-surface-primary text-xs font-semibold py-1.5 px-3 rounded-md shadow-sm transition-colors cursor-pointer"
                onClick={() => setViewMessages(null)}
              >
                Close
              </button>
            </div>
          </Card>
        </div>,
        document.body
      )}

      {/* History Modal */}
      {viewHistory && createPortal(
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-[10000] p-6 animate-fade-in">
          <Card
            title={`History for ${viewHistory.name}`}
            className="w-full max-w-2xl bg-surface-secondary shadow-2xl border border-border-strong/60 rounded-xl"
            contentClassName="p-4"
            disableHover
          >
            <div className="flex flex-col gap-2.5 max-h-[50vh] overflow-y-auto custom-scrollbar pr-1">
              {viewHistory.history.length > 0 ? (
                viewHistory.history.map((item, idx) => (
                  <div key={idx} className="flex flex-col gap-1.5 p-2.5 bg-surface-primary rounded-lg border border-border-subtle">
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] font-bold text-brand-primary uppercase tracking-wider">Message Sent</span>
                      <span className="text-[10px] text-content-muted font-medium">{new Date(item.timestamp).toLocaleString()}</span>
                    </div>
                    <pre className="text-[10px] text-content-secondary font-mono bg-surface-secondary p-2 rounded border border-border-subtle/50 overflow-x-auto leading-relaxed">
                      {item.body}
                    </pre>
                  </div>
                ))
              ) : (
                <div className="py-10 flex flex-col items-center gap-2 opacity-50">
                  <History size={28} className="text-content-muted" />
                  <span className="text-[10px] font-bold uppercase tracking-wider text-content-muted">No history recorded</span>
                </div>
              )}
            </div>
            <div className="flex justify-end mt-4">
              <button
                className="bg-surface-secondary border border-border-strong text-content-primary hover:bg-surface-primary text-xs font-semibold py-1.5 px-3 rounded-md shadow-sm flex items-center gap-1.5 transition-colors cursor-pointer"
                onClick={() => setViewHistory(null)}
              >
                <X size={13} /> Close
              </button>
            </div>
          </Card>
        </div>,
        document.body
      )}

      {/* Send/Publish Modal */}
      {interactionModal && createPortal(
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-[10000] p-6 animate-fade-in">
          <Card
            title={interactionModal.type === 'sqs' ? `Send to ${interactionModal.name}` : `Publish to ${interactionModal.name}`}
            className="w-full max-w-xl bg-surface-secondary shadow-2xl border border-border-strong/60 rounded-xl"
            contentClassName="p-5"
            disableHover
          >
            <form onSubmit={handleInteraction} className="flex flex-col gap-4 mt-1">
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold text-content-secondary uppercase tracking-wider">Message Body</label>
                <textarea
                  className={`bg-surface-primary border rounded-md px-3 py-2 text-content-primary outline-none focus:ring-1 transition-all font-mono text-xs min-h-[140px] resize-none leading-relaxed placeholder:opacity-40 ${
                    isJsonInvalid
                      ? 'border-status-danger focus:ring-status-danger focus:border-status-danger/50'
                      : 'border-border-strong focus:ring-brand-primary focus:border-brand-primary/50'
                  }`}
                  value={interactionBody}
                  onChange={e => setInteractionBody(e.target.value)}
                  placeholder={`{
  "event": "order.created",
  "data": {
    "id": "ord_123",
    "amount": 99.90,
    "currency": "USD"
  },
  "metadata": {
    "source": "ministack-ui"
  }
}`}
                />
                {isJsonInvalid && (
                  <span className="text-[10px] text-status-danger font-medium mt-1 animate-fade-in">
                    Invalid JSON format
                  </span>
                )}
              </div>

              <div className="flex justify-end gap-2 mt-2">
                <button
                  type="button"
                  className="bg-surface-secondary border border-border-strong text-content-primary hover:bg-surface-primary text-xs font-semibold py-1.5 px-3 rounded-md shadow-sm flex items-center gap-1.5 transition-colors cursor-pointer"
                  onClick={() => setInteractionModal(null)}
                >
                  <X size={13} /> Cancel
                </button>
                <button
                  type="submit"
                  disabled={isBodyEmpty || isJsonInvalid}
                  className={`text-xs font-semibold py-1.5 px-4 rounded-md shadow-sm flex items-center gap-1.5 transition-colors ${
                    (isBodyEmpty || isJsonInvalid)
                      ? 'bg-content-primary/40 text-surface-secondary/80 cursor-not-allowed'
                      : 'bg-content-primary text-surface-secondary hover:bg-content-primary/90 cursor-pointer'
                  }`}
                >
                  {interactionModal.type === 'sqs' ? <Send size={13} /> : <Zap size={13} />}
                  {interactionModal.type === 'sqs' ? 'Send' : 'Publish'}
                </button>
              </div>
            </form>
          </Card>
        </div>,
        document.body
      )}

      {/* Create Modal */}
      {showCreateModal && createPortal(
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-[10000] p-6 animate-fade-in">
          <div className="w-full max-w-xl bg-surface-secondary border border-border-strong/60 rounded-xl shadow-2xl overflow-hidden animate-slide-up">
            <div className="px-5 py-3.5 border-b border-border-subtle flex items-center justify-between bg-surface-tertiary/40">
              <div className="flex items-center gap-2">
                <div className="text-content-primary">
                  <MessageSquare size={18} />
                </div>
                <h2 className="text-sm font-semibold text-content-primary">
                  {showCreateModal === 'queue' ? 'Create SQS Queue' : 'Create SNS Topic'}
                </h2>
              </div>
              <button onClick={() => setShowCreateModal(null)} className="text-content-muted hover:text-content-primary transition-colors cursor-pointer">
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleCreate} className="p-6 flex flex-col gap-5 max-h-[75vh] overflow-y-auto custom-scrollbar bg-surface-secondary">
              {/* Resource Name */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold text-content-secondary uppercase tracking-wider">
                  {showCreateModal === 'queue' ? 'Queue Name' : 'Topic Name'}
                </label>
                <div className="flex flex-col gap-2">
                  {showCreateModal === 'queue' && (
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="batchMode"
                        className="w-3.5 h-3.5 accent-brand-primary cursor-pointer rounded border-border-strong"
                        checked={isBatchMode}
                        onChange={e => setIsBatchMode(e.target.checked)}
                      />
                      <label htmlFor="batchMode" className="text-xs text-content-secondary select-none cursor-pointer font-medium">
                        Create multiple queues (Batch Mode)
                      </label>
                    </div>
                  )}

                  {isBatchMode && showCreateModal === 'queue' ? (
                    <textarea
                      className="w-full bg-surface-primary border border-border-strong/60 rounded-md px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-brand-primary focus:border-brand-primary/50 transition-all placeholder:opacity-40 min-h-[100px] resize-y"
                      value={formData.name}
                      onChange={e => setFormData({ ...formData, name: e.target.value })}
                      placeholder="Enter queue names (one per line or separated by commas)"
                      required
                    />
                  ) : (
                    <input
                      type="text"
                      className="w-full bg-surface-primary border border-border-strong/60 rounded-md px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-brand-primary focus:border-brand-primary/50 transition-all placeholder:opacity-40"
                      value={formData.name}
                      onChange={e => setFormData({ ...formData, name: e.target.value })}
                      placeholder={showCreateModal === 'queue' ? "e.g. order-processing-queue" : "e.g. order-events"}
                      required
                    />
                  )}
                  {showCreateModal === 'topic' && formData.name && (
                    <div className="flex items-center gap-1.5 px-2.5 py-1 bg-brand-primary/5 border border-brand-primary/10 rounded-md animate-fade-in text-[10px]">
                      <span className="font-semibold text-brand-primary uppercase">Final Name:</span>
                      <span className="font-mono text-content-primary font-semibold">
                        {formData.name.trim().endsWith('_notif') ? formData.name.trim() : `${formData.name.trim()}_notif`}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {showCreateModal === 'queue' && (
                <>
                  {/* Queue Type */}
                  <div className="flex flex-col gap-2">
                    <label className="text-[10px] font-bold text-content-secondary uppercase tracking-wider">Queue Type</label>
                    <div className="grid grid-cols-2 gap-3">
                      <div
                        onClick={() => setFormData({ ...formData, isFifo: false })}
                        className={`p-3 border rounded-lg cursor-pointer transition-all flex flex-col gap-1 bg-surface-primary/40 ${!formData.isFifo ? 'border-brand-primary/80 ring-1 ring-brand-primary/30' : 'border-border-strong hover:border-border-subtle'}`}
                      >
                        <div className="flex justify-between items-center">
                          <span className="text-xs font-semibold text-content-primary">Standard</span>
                          <div className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${!formData.isFifo ? 'border-brand-primary' : 'border-border-strong'}`}>
                            {!formData.isFifo && <div className="w-1.5 h-1.5 rounded-full bg-brand-primary" />}
                          </div>
                        </div>
                        <p className="text-[10px] text-content-muted leading-normal font-medium">
                          At-least-once delivery, best-effort ordering.
                        </p>
                      </div>
                      <div
                        onClick={() => setFormData({ ...formData, isFifo: true })}
                        className={`p-3 border rounded-lg cursor-pointer transition-all flex flex-col gap-1 bg-surface-primary/40 ${formData.isFifo ? 'border-brand-primary/80 ring-1 ring-brand-primary/30' : 'border-border-strong hover:border-border-subtle'}`}
                      >
                        <div className="flex justify-between items-center">
                          <span className="text-xs font-semibold text-content-primary">FIFO</span>
                          <div className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${formData.isFifo ? 'border-brand-primary' : 'border-border-strong'}`}>
                            {formData.isFifo && <div className="w-1.5 h-1.5 rounded-full bg-brand-primary" />}
                          </div>
                        </div>
                        <p className="text-[10px] text-content-muted leading-normal font-medium">
                          First-in-first-out delivery, exactly-once processing.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="h-[1px] bg-border-subtle w-full" />

                  {/* Enable DLQ */}
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <AlertCircle size={16} className="text-status-danger" />
                        <span className="text-xs font-semibold text-content-primary">Enable Dead-Letter Queue (DLQ)</span>
                      </div>
                      <input
                        type="checkbox"
                        className="w-4 h-4 accent-brand-primary cursor-pointer border-border-strong rounded"
                        checked={formData.useDLQ}
                        onChange={e => setFormData({ ...formData, useDLQ: e.target.checked })}
                      />
                    </div>
                    {formData.useDLQ && (
                      <div className="flex flex-col gap-1.5 ml-6 animate-fade-in">
                        <p className="text-[10px] text-content-muted font-medium">Creates a companion queue to capture undeliverable messages.</p>
                        <div className="relative">
                          <input
                            type="text"
                            className="w-full bg-surface-primary/50 border border-border-strong/50 rounded-md px-3 py-1.5 text-xs outline-none opacity-70 font-mono italic"
                            value={formData.name ? (formData.name.trim().endsWith('_dlq') ? formData.name.trim() : `${formData.name.trim()}_dlq`) : 'name_dlq'}
                            readOnly
                          />
                          <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[8px] font-bold text-content-muted bg-surface-tertiary px-1 py-0.2 rounded border border-border-subtle uppercase">Auto</span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Associate SNS */}
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Radio size={16} className="text-brand-primary" />
                        <span className="text-xs font-semibold text-content-primary">Associate with SNS Topic</span>
                      </div>
                      <input
                        type="checkbox"
                        className="w-4 h-4 accent-brand-primary cursor-pointer border-border-strong rounded"
                        checked={formData.useSNS}
                        onChange={e => setFormData({ ...formData, useSNS: e.target.checked })}
                      />
                    </div>
                    {formData.useSNS && (
                      <div className="flex flex-col gap-2.5 ml-6 animate-fade-in bg-surface-primary/40 p-3 rounded-lg border border-border-subtle">
                        <div className="flex items-center gap-4">
                          <label className="flex items-center gap-1.5 cursor-pointer group">
                            <input
                              type="radio"
                              name="topicMode"
                              checked={!formData.createNewTopic}
                              onChange={() => setFormData({ ...formData, createNewTopic: false })}
                              className="w-3.5 h-3.5 accent-brand-primary"
                            />
                            <span className="text-[10px] font-semibold text-content-secondary group-hover:text-content-primary transition-colors">Existing Topic</span>
                          </label>
                          <label className="flex items-center gap-1.5 cursor-pointer group">
                            <input
                              type="radio"
                              name="topicMode"
                              checked={formData.createNewTopic}
                              onChange={() => setFormData({ ...formData, createNewTopic: true })}
                              className="w-3.5 h-3.5 accent-brand-primary"
                            />
                            <span className="text-[10px] font-semibold text-content-secondary group-hover:text-content-primary transition-colors">Create New Topic</span>
                          </label>
                        </div>

                        {!formData.createNewTopic ? (
                          <div className="relative">
                            <select
                              className="w-full bg-surface-primary border border-border-strong/60 rounded-md px-3 py-1.5 text-xs outline-none focus:ring-1 focus:ring-brand-primary focus:border-brand-primary/50 appearance-none font-medium cursor-pointer"
                              value={formData.existingTopicArn}
                              onChange={e => setFormData({ ...formData, existingTopicArn: e.target.value })}
                              required={formData.useSNS && !formData.createNewTopic}
                            >
                              <option value="">Select an existing SNS topic...</option>
                              {topics.map(t => (
                                <option key={t.arn} value={t.arn}>{t.name}</option>
                              ))}
                            </select>
                            <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-content-muted">
                              <ChevronDown size={14} />
                            </div>
                          </div>
                        ) : (
                          <div className="relative">
                            <input
                              type="text"
                              className="w-full bg-surface-primary/50 border border-border-strong/50 rounded-md px-3 py-1.5 text-xs outline-none opacity-70 font-mono italic"
                              value={formData.name ? (formData.name.trim().endsWith('_notif') ? formData.name.trim() : `${formData.name.trim()}_notif`) : 'name_notif'}
                              readOnly
                            />
                            <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[8px] font-bold text-content-muted bg-surface-tertiary px-1 py-0.2 rounded border border-border-subtle uppercase">Auto</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </>
              )}
            </form>

            <div className="px-5 py-3.5 bg-surface-tertiary/40 border-t border-border-subtle flex items-center justify-end gap-3">
              <button
                type="button"
                className="text-xs font-semibold text-content-secondary hover:text-content-primary transition-colors cursor-pointer"
                onClick={() => setShowCreateModal(null)}
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                type="button"
                className="bg-content-primary hover:bg-content-primary/95 text-surface-secondary px-4 py-1.5 rounded-md text-xs font-semibold shadow-sm flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Plus size={14} />
                {showCreateModal === 'queue' ? 'Create Queue' : 'Create Topic'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Subscribe Topic Modal */}
      {showSubscribeModal && createPortal(
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-[10000] p-6 animate-fade-in">
          <Card
            title={`Subscribe to ${showSubscribeModal.name}`}
            className="w-full max-w-lg bg-surface-secondary border border-border-strong/60 rounded-xl shadow-2xl"
            contentClassName="p-5"
            disableHover
          >
            <form onSubmit={handleSubscribe} className="flex flex-col gap-4 mt-1">
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold text-content-secondary uppercase tracking-wider">SQS Queue</label>
                <div className="relative">
                  <select
                    className="w-full bg-surface-primary border border-border-strong/60 rounded-md px-3 py-1.5 text-xs outline-none focus:ring-1 focus:ring-brand-primary focus:border-brand-primary/50 appearance-none font-medium cursor-pointer"
                    value={selectedQueueArn}
                    onChange={e => setSelectedQueueArn(e.target.value)}
                    required
                  >
                    <option value="">Select a queue...</option>
                    {queues.map(q => (
                      <option key={q.arn} value={q.arn}>{q.name}</option>
                    ))}
                  </select>
                  <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-content-muted">
                    <ChevronDown size={14} />
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 mt-2">
                <button
                  type="button"
                  className="bg-surface-secondary border border-border-strong text-content-primary hover:bg-surface-primary text-xs font-semibold py-1.5 px-3 rounded-md shadow-sm flex items-center gap-1.5 transition-colors cursor-pointer"
                  onClick={() => setShowSubscribeModal(null)}
                >
                  <X size={13} /> Cancel
                </button>
                <button
                  type="submit"
                  className="bg-content-primary text-surface-secondary hover:bg-content-primary/95 text-xs font-semibold py-1.5 px-4 rounded-md shadow-sm flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Plus size={13} /> Subscribe
                </button>
              </div>
            </form>
          </Card>
        </div>,
        document.body
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm && createPortal(
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-[10000] p-6 animate-fade-in">
          <div className="bg-surface-secondary border border-border-strong rounded-xl w-full max-w-sm shadow-2xl animate-slide-up overflow-hidden animate-fade-in">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border-subtle">
              <h2 className="text-sm font-bold text-content-primary">
                Delete {deleteConfirm.type === 'sqs' ? 'Queue' : 'Topic'}
              </h2>
              <button 
                onClick={() => setDeleteConfirm(null)} 
                className="text-content-muted hover:text-content-primary transition-colors p-0.5"
              >
                <X size={16} />
              </button>
            </div>

            <div className="px-5 py-4">
              <p className="text-xs text-content-secondary">
                Are you sure you want to delete the {deleteConfirm.type === 'sqs' ? 'queue' : 'topic'}{' '}
                <span className="font-bold text-content-primary">{deleteConfirm.name}</span>?
                This action cannot be undone.
              </p>
              {deleteError && (
                <div className="flex items-center gap-2 p-2.5 mt-3 bg-status-error/10 border border-status-error/20 rounded text-status-error text-xs animate-fade-in">
                  <AlertCircle size={13} className="shrink-0" /> {deleteError}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 px-5 py-4 border-t border-border-subtle">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="px-3 py-1.5 text-xs text-content-secondary border border-border-strong rounded hover:bg-surface-tertiary transition-colors font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={executeDelete}
                disabled={deleting}
                className="px-3 py-1.5 text-xs font-semibold bg-status-error text-white rounded hover:opacity-90 disabled:opacity-50 transition-opacity"
              >
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
};
