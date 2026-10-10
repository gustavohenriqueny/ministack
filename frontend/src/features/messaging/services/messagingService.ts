import type { SQSQueue, SNSTopic, CreateQueueRequest, CreateTopicRequest, SNSSubscription } from '../types';

const API_BASE = '/api/v1';

export const messagingService = {
  getQueues: async (): Promise<SQSQueue[]> => {
    const resp = await fetch(`${API_BASE}/queues`);
    if (!resp.ok) throw new Error('Failed to fetch queues');
    return resp.json();
  },

  createQueue: async (req: CreateQueueRequest): Promise<SQSQueue> => {
    const resp = await fetch(`${API_BASE}/queues`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req)
    });
    if (!resp.ok) throw new Error('Failed to create queue');
    return resp.json();
  },

  deleteQueue: async (url: string): Promise<void> => {
    const resp = await fetch(`${API_BASE}/queues/${encodeURIComponent(url)}`, {
      method: 'DELETE'
    });
    if (!resp.ok) throw new Error('Failed to delete queue');
  },

  purgeQueue: async (url: string): Promise<void> => {
    const resp = await fetch(`${API_BASE}/queues/${encodeURIComponent(url)}/purge`, {
      method: 'POST'
    });
    if (!resp.ok) throw new Error('Failed to purge queue');
  },


  getTopics: async (): Promise<SNSTopic[]> => {
    const resp = await fetch(`${API_BASE}/topics`);
    if (!resp.ok) throw new Error('Failed to fetch topics');
    return resp.json();
  },

  createTopic: async (req: CreateTopicRequest): Promise<SNSTopic> => {
    const resp = await fetch(`${API_BASE}/topics`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req)
    });
    if (!resp.ok) throw new Error('Failed to create topic');
    return resp.json();
  },

  deleteTopic: async (arn: string): Promise<void> => {
    const resp = await fetch(`${API_BASE}/topics/${encodeURIComponent(arn)}`, {
      method: 'DELETE'
    });
    if (!resp.ok) throw new Error('Failed to delete topic');
  },


  subscribe: async (topicArn: string, queueArn: string): Promise<SNSSubscription> => {
    const resp = await fetch(`${API_BASE}/topics/${encodeURIComponent(topicArn)}/subscriptions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ queueArn })
    });
    if (!resp.ok) throw new Error('Failed to subscribe');
    return resp.json();
  },

  sendMessage: async (queueUrl: string, body: string): Promise<void> => {
    const resp = await fetch(`${API_BASE}/queues/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ queueUrl, body })
    });
    if (!resp.ok) throw new Error('Failed to send message');
  },

  publish: async (topicArn: string, body: string): Promise<void> => {
    const resp = await fetch(`${API_BASE}/topics/${encodeURIComponent(topicArn)}/publish`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body })
    });
    if (!resp.ok) throw new Error('Failed to publish message');
  },

  redrive: async (dlqUrl: string, sourceQueueUrl: string): Promise<void> => {
    const resp = await fetch(`${API_BASE}/queues/redrive`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dlqUrl, sourceQueueUrl })
    });
    if (!resp.ok) throw new Error('Failed to redrive messages');
  }
};
