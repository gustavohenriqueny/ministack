export interface HistoryItem {
  id: string;
  type: 'sqs' | 'sns';
  target: string;
  body: string;
  timestamp: string;
}

export interface SQSQueue {
  id: string;
  name: string;
  url: string;
  arn: string;
  attributes: {
    ApproximateNumberOfMessages: number;
    VisibilityTimeout: number;
    DelaySeconds: number;
    RedrivePolicy?: {
      deadLetterTargetArn: string;
      maxReceiveCount: number;
    };
  };
  subscriptions: string[];
  messages: Message[];
  dlqStatus?: {
    arn: string;
    url: string;
    messageCount: number;
    messages: Message[];
  };
  sendHistory: HistoryItem[];
  createdAt: string;
}

export interface Message {
  id: string;
  body: string;
  attributes?: Record<string, string>;
}

export interface SNSTopic {
  id: string;
  name: string;
  arn: string;
  subscriptions: string[];
  sendHistory: HistoryItem[];
  createdAt: string;
}

export interface SNSSubscription {
  id: string;
  topicArn: string;
  protocol: 'sqs' | 'lambda' | 'http';
  endpoint: string;
  subscriptionArn: string;
}

export interface CreateQueueRequest {
  name: string;
  attributes: {
    VisibilityTimeout: number;
    DelaySeconds: number;
    FifoQueue?: 'true' | 'false';
  };
  createDlq?: boolean;
  dlqName?: string;
  maxReceiveCount?: number;
  snsAssociation?: SNSAssociation;
}

export interface SNSAssociation {
  topicArn?: string;
  createNewTopic: boolean;
  newTopicName?: string;
}

export interface CreateTopicRequest {
  name: string;
}
