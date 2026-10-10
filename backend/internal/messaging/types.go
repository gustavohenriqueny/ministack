package messaging

type HistoryItem struct {
	ID        string `json:"id"`
	Type      string `json:"type"` // "sqs" or "sns"
	Target    string `json:"target"` // Queue URL or Topic ARN
	Body      string `json:"body"`
	Timestamp string `json:"timestamp"`
}

type SQSQueue struct {
	ID            string            `json:"id"`
	Name          string            `json:"name"`
	URL           string            `json:"url"`
	ARN           string            `json:"arn"`
	Attributes    QueueAttributes   `json:"attributes"`
	Subscriptions []string          `json:"subscriptions"` // List of Topic ARNs
	Messages      []Message         `json:"messages"`      // Sample of current messages
	DLQStatus     *DLQStatus        `json:"dlqStatus,omitempty"`
	SendHistory   []HistoryItem     `json:"sendHistory"`
	CreatedAt     string            `json:"createdAt"`
}

type SNSTopic struct {
	ID            string            `json:"id"`
	Name          string            `json:"name"`
	ARN           string            `json:"arn"`
	Subscriptions []string          `json:"subscriptions"` // List of Queue ARNs/Endpoints
	Attributes    map[string]string `json:"attributes,omitempty"`
	SendHistory   []HistoryItem     `json:"sendHistory"`
	CreatedAt     string            `json:"createdAt"`
}

type DLQStatus struct {
	ARN          string    `json:"arn"`
	URL          string    `json:"url"`
	MessageCount int       `json:"messageCount"`
	Messages     []Message `json:"messages,omitempty"`
}

type Message struct {
	ID         string            `json:"id"`
	Body       string            `json:"body"`
	Attributes map[string]string `json:"attributes"`
}

type QueueAttributes struct {
	ApproximateNumberOfMessages int            `json:"ApproximateNumberOfMessages"`
	VisibilityTimeout           int            `json:"VisibilityTimeout"`
	DelaySeconds                int            `json:"DelaySeconds"`
	FifoQueue                   string         `json:"FifoQueue,omitempty"`
	CreatedTimestamp            string         `json:"CreatedTimestamp,omitempty"`
	RedrivePolicy               *RedrivePolicy `json:"RedrivePolicy,omitempty"`
}

type RedrivePolicy struct {
	DeadLetterTargetArn string `json:"deadLetterTargetArn"`
	MaxReceiveCount     int    `json:"maxReceiveCount"`
}

type CreateQueueRequest struct {
	Name            string          `json:"name"`
	Attributes      QueueAttributes `json:"attributes"`
	CreateDLQ       bool            `json:"createDlq"`
	DLQName         string          `json:"dlqName"`
	MaxReceiveCount int             `json:"maxReceiveCount"`
	SNSAssociation  *SNSAssociation `json:"snsAssociation,omitempty"`
}

type SNSAssociation struct {
	TopicArn       string `json:"topicArn,omitempty"`
	CreateNewTopic bool   `json:"createNewTopic"`
	NewTopicName   string `json:"newTopicName,omitempty"`
}

type CreateTopicRequest struct {
	Name string `json:"name"`
}

type SNSSubscription struct {
	ID              string `json:"id"`
	TopicArn        string `json:"topicArn"`
	Protocol        string `json:"protocol"`
	Endpoint        string `json:"endpoint"`
	SubscriptionArn string `json:"subscriptionArn"`
}
