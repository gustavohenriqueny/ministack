package messaging

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/service/sns"
	"github.com/aws/aws-sdk-go-v2/service/sqs"
	"github.com/aws/aws-sdk-go-v2/service/sqs/types"
	"github.com/ministack/backend/internal/client"
)

type Service struct {
	aws             *client.AWSClient
	history         []HistoryItem
	persistencePath string
	mu              sync.RWMutex
}

func NewService(awsClient *client.AWSClient) *Service {
	s := &Service{
		aws:             awsClient,
		history:         make([]HistoryItem, 0),
		persistencePath: "data/history.json",
	}
	s.loadHistory()
	return s
}

func (s *Service) ListQueues(ctx context.Context) ([]SQSQueue, error) {
	// 1. List all subscriptions to find topic links
	allSubs, _ := s.aws.SNS.ListSubscriptions(ctx, &sns.ListSubscriptionsInput{})
	
	output, err := s.aws.SQS.ListQueues(ctx, &sqs.ListQueuesInput{})
	if err != nil {
		return nil, err
	}

	queues := make([]SQSQueue, 0)
	for _, url := range output.QueueUrls {
		attrs, err := s.aws.SQS.GetQueueAttributes(ctx, &sqs.GetQueueAttributesInput{
			QueueUrl: aws.String(url),
			AttributeNames: []types.QueueAttributeName{
				types.QueueAttributeNameQueueArn,
				types.QueueAttributeNameApproximateNumberOfMessages,
				types.QueueAttributeNameVisibilityTimeout,
				types.QueueAttributeNameDelaySeconds,
				types.QueueAttributeNameRedrivePolicy,
				types.QueueAttributeNameCreatedTimestamp,
				types.QueueAttributeNameFifoQueue,
			},
		})
		if err != nil {
			continue
		}

		queueArn := attrs.Attributes[string(types.QueueAttributeNameQueueArn)]
		nameParts := strings.Split(url, "/")
		name := nameParts[len(nameParts)-1]

		numMsgs, _ := strconv.Atoi(attrs.Attributes[string(types.QueueAttributeNameApproximateNumberOfMessages)])
		visTimeout, _ := strconv.Atoi(attrs.Attributes[string(types.QueueAttributeNameVisibilityTimeout)])
		delay, _ := strconv.Atoi(attrs.Attributes[string(types.QueueAttributeNameDelaySeconds)])
		fifo := attrs.Attributes[string(types.QueueAttributeNameFifoQueue)]
		
		createdAt := time.Now().Format(time.RFC3339)
		if tsStr, ok := attrs.Attributes[string(types.QueueAttributeNameCreatedTimestamp)]; ok {
			if ts, err := strconv.ParseInt(tsStr, 10, 64); err == nil {
				createdAt = time.Unix(ts, 0).Format(time.RFC3339)
			}
		}

		// Find subscriptions for this queue
		subs := make([]string, 0)
		if allSubs != nil {
			for _, sub := range allSubs.Subscriptions {
				if sub.Endpoint != nil && *sub.Endpoint == queueArn {
					subs = append(subs, *sub.TopicArn)
				}
			}
		}

		// Peek messages
		messages := make([]Message, 0)
		if numMsgs > 0 {
			msgOutput, err := s.aws.SQS.ReceiveMessage(ctx, &sqs.ReceiveMessageInput{
				QueueUrl:            aws.String(url),
				MaxNumberOfMessages: 5,
				VisibilityTimeout:   10, // Small timeout just for peeking
				WaitTimeSeconds:     0,
			})
			if err == nil {
				for _, m := range msgOutput.Messages {
					messages = append(messages, Message{
						ID:   *m.MessageId,
						Body: *m.Body,
					})
				}
			}
		}

		var redrivePolicy *RedrivePolicy
		var dlqStatus *DLQStatus
		if policyStr, ok := attrs.Attributes[string(types.QueueAttributeNameRedrivePolicy)]; ok && policyStr != "" {
			var rp struct {
				DeadLetterTargetArn string `json:"deadLetterTargetArn"`
				MaxReceiveCount     int    `json:"maxReceiveCount"`
			}
			if err := json.Unmarshal([]byte(policyStr), &rp); err == nil {
				redrivePolicy = &RedrivePolicy{
					DeadLetterTargetArn: rp.DeadLetterTargetArn,
					MaxReceiveCount:     rp.MaxReceiveCount,
				}

				// Fetch DLQ status
				dlqUrl, err := s.getQueueUrlByArn(ctx, rp.DeadLetterTargetArn)
				if err == nil {
					dlqAttrs, err := s.aws.SQS.GetQueueAttributes(ctx, &sqs.GetQueueAttributesInput{
						QueueUrl: aws.String(dlqUrl),
						AttributeNames: []types.QueueAttributeName{
							types.QueueAttributeNameApproximateNumberOfMessages,
						},
					})
					if err == nil {
						count, _ := strconv.Atoi(dlqAttrs.Attributes[string(types.QueueAttributeNameApproximateNumberOfMessages)])
						
						// Peek DLQ messages
						dlqMsgs := make([]Message, 0)
						if count > 0 {
							dlqMsgOut, _ := s.aws.SQS.ReceiveMessage(ctx, &sqs.ReceiveMessageInput{
								QueueUrl:            aws.String(dlqUrl),
								MaxNumberOfMessages: 5,
								VisibilityTimeout:   10,
							})
							if dlqMsgOut != nil {
								for _, m := range dlqMsgOut.Messages {
									dlqMsgs = append(dlqMsgs, Message{
										ID:   *m.MessageId,
										Body: *m.Body,
									})
								}
							}
						}

						dlqStatus = &DLQStatus{
							ARN:          rp.DeadLetterTargetArn,
							URL:          dlqUrl,
							MessageCount: count,
							Messages:     dlqMsgs,
						}
					}
				}
			}
		}

		queues = append(queues, SQSQueue{
			ID:   name,
			Name: name,
			URL:  url,
			ARN:  queueArn,
			Attributes: QueueAttributes{
				ApproximateNumberOfMessages: numMsgs,
				VisibilityTimeout:           visTimeout,
				DelaySeconds:                delay,
				FifoQueue:                   fifo,
				CreatedTimestamp:            createdAt,
				RedrivePolicy:               redrivePolicy,
			},
			Subscriptions: subs,
			Messages:      messages,
			DLQStatus:     dlqStatus,
			SendHistory:   s.getHistoryForTarget(url),
			CreatedAt:     createdAt,
		})
	}

	return queues, nil
}

func (s *Service) getQueueUrlByArn(ctx context.Context, arn string) (string, error) {
	parts := strings.Split(arn, ":")
	if len(parts) == 0 {
		return "", fmt.Errorf("invalid arn")
	}
	name := parts[len(parts)-1]
	
	output, err := s.aws.SQS.GetQueueUrl(ctx, &sqs.GetQueueUrlInput{
		QueueName: aws.String(name),
	})
	if err != nil {
		return "", err
	}
	return *output.QueueUrl, nil
}

func (s *Service) RedriveMessages(ctx context.Context, dlqUrl, sourceQueueUrl string) error {
	// 1. Receive all messages from DLQ (limited for this tool)
	output, err := s.aws.SQS.ReceiveMessage(ctx, &sqs.ReceiveMessageInput{
		QueueUrl:            aws.String(dlqUrl),
		MaxNumberOfMessages: 10,
		VisibilityTimeout:   30,
	})
	if err != nil {
		return err
	}

	for _, m := range output.Messages {
		// 2. Send to source queue
		_, err := s.aws.SQS.SendMessage(ctx, &sqs.SendMessageInput{
			QueueUrl:    aws.String(sourceQueueUrl),
			MessageBody: m.Body,
		})
		if err != nil {
			continue
		}

		// 3. Delete from DLQ
		_, _ = s.aws.SQS.DeleteMessage(ctx, &sqs.DeleteMessageInput{
			QueueUrl:      aws.String(dlqUrl),
			ReceiptHandle: m.ReceiptHandle,
		})
	}

	return nil
}

func (s *Service) CreateQueue(ctx context.Context, req CreateQueueRequest) (*SQSQueue, error) {
	attrs := map[string]string{
		string(types.QueueAttributeNameVisibilityTimeout): strconv.Itoa(req.Attributes.VisibilityTimeout),
		string(types.QueueAttributeNameDelaySeconds):      strconv.Itoa(req.Attributes.DelaySeconds),
	}

	if req.Attributes.FifoQueue == "true" {
		attrs[string(types.QueueAttributeNameFifoQueue)] = "true"
		attrs[string(types.QueueAttributeNameContentBasedDeduplication)] = "true"
	}

	if req.CreateDLQ && req.DLQName != "" {
		// 1. Create DLQ
		dlqOutput, err := s.aws.SQS.CreateQueue(ctx, &sqs.CreateQueueInput{
			QueueName: aws.String(req.DLQName),
		})
		if err != nil {
			return nil, fmt.Errorf("failed to create DLQ: %w", err)
		}

		dlqAttrs, err := s.aws.SQS.GetQueueAttributes(ctx, &sqs.GetQueueAttributesInput{
			QueueUrl:       dlqOutput.QueueUrl,
			AttributeNames: []types.QueueAttributeName{types.QueueAttributeNameQueueArn},
		})
		if err != nil {
			return nil, fmt.Errorf("failed to get DLQ ARN: %w", err)
		}

		dlqArn := dlqAttrs.Attributes[string(types.QueueAttributeNameQueueArn)]
		policy := map[string]interface{}{
			"deadLetterTargetArn": dlqArn,
			"maxReceiveCount":     req.MaxReceiveCount,
		}
		policyBytes, _ := json.Marshal(policy)
		attrs[string(types.QueueAttributeNameRedrivePolicy)] = string(policyBytes)
	}

	output, err := s.aws.SQS.CreateQueue(ctx, &sqs.CreateQueueInput{
		QueueName:  aws.String(req.Name),
		Attributes: attrs,
	})
	if err != nil {
		return nil, err
	}

	if req.SNSAssociation != nil {
		var topicArn string
		if req.SNSAssociation.CreateNewTopic && req.SNSAssociation.NewTopicName != "" {
			topic, err := s.CreateTopic(ctx, CreateTopicRequest{Name: req.SNSAssociation.NewTopicName})
			if err != nil {
				// We don't fail the whole queue creation if association fails, or should we?
				// User probably wants it to work.
				return nil, fmt.Errorf("failed to create SNS topic for association: %w", err)
			}
			topicArn = topic.ARN
		} else if req.SNSAssociation.TopicArn != "" {
			topicArn = req.SNSAssociation.TopicArn
		}

		if topicArn != "" {
			// Get Queue ARN to subscribe
			queueAttrs, err := s.aws.SQS.GetQueueAttributes(ctx, &sqs.GetQueueAttributesInput{
				QueueUrl:       output.QueueUrl,
				AttributeNames: []types.QueueAttributeName{types.QueueAttributeNameQueueArn},
			})
			if err == nil {
				queueArn := queueAttrs.Attributes[string(types.QueueAttributeNameQueueArn)]
				_, _ = s.Subscribe(ctx, topicArn, queueArn)
			}
		}
	}

	// Just return a basic representation, client can reload
	return &SQSQueue{
		ID:   req.Name,
		Name: req.Name,
		URL:  *output.QueueUrl,
	}, nil
}

func (s *Service) ListTopics(ctx context.Context) ([]SNSTopic, error) {
	output, err := s.aws.SNS.ListTopics(ctx, &sns.ListTopicsInput{})
	if err != nil {
		return nil, err
	}

	topics := make([]SNSTopic, 0)
	for _, t := range output.Topics {
		arn := *t.TopicArn
		parts := strings.Split(arn, ":")
		name := parts[len(parts)-1]

		// Get topic attributes
		topicAttrs, _ := s.aws.SNS.GetTopicAttributes(ctx, &sns.GetTopicAttributesInput{
			TopicArn: aws.String(arn),
		})

		createdAt := time.Now().Format(time.RFC3339)
		if topicAttrs != nil {
			// Some LocalStack versions use EffectiveDeliveryPolicy.Created
			// Standard AWS uses "CreatedTimestamp" (Unix float string)
			if tsStr, ok := topicAttrs.Attributes["CreatedTimestamp"]; ok {
				if ts, err := strconv.ParseFloat(tsStr, 64); err == nil {
					createdAt = time.Unix(int64(ts), 0).Format(time.RFC3339)
				}
			}
		}

		// Get subscriptions for this topic
		subsOutput, _ := s.aws.SNS.ListSubscriptionsByTopic(ctx, &sns.ListSubscriptionsByTopicInput{
			TopicArn: aws.String(arn),
		})
		subs := make([]string, 0)
		if subsOutput != nil {
			for _, sub := range subsOutput.Subscriptions {
				if sub.Endpoint != nil {
					subs = append(subs, *sub.Endpoint)
				}
			}
		}

		var attributes map[string]string
		if topicAttrs != nil {
			attributes = topicAttrs.Attributes
		}

		topics = append(topics, SNSTopic{
			ID:            name,
			Name:          name,
			ARN:           arn,
			Subscriptions: subs,
			Attributes:    attributes,
			SendHistory:   s.getHistoryForTarget(arn),
			CreatedAt:     createdAt,
		})
	}

	return topics, nil
}

func (s *Service) CreateTopic(ctx context.Context, req CreateTopicRequest) (*SNSTopic, error) {
	output, err := s.aws.SNS.CreateTopic(ctx, &sns.CreateTopicInput{
		Name: aws.String(req.Name),
	})
	if err != nil {
		return nil, err
	}

	return &SNSTopic{
		ID:   req.Name,
		Name: req.Name,
		ARN:  *output.TopicArn,
	}, nil
}

func (s *Service) Subscribe(ctx context.Context, topicArn, queueArn string) (*SNSSubscription, error) {
	output, err := s.aws.SNS.Subscribe(ctx, &sns.SubscribeInput{
		TopicArn: aws.String(topicArn),
		Protocol: aws.String("sqs"),
		Endpoint: aws.String(queueArn),
		Attributes: map[string]string{
			"RawMessageDelivery": "true",
		},
	})
	if err != nil {
		return nil, err
	}

	// 2. Automate SQS Policy update to allow SNS to send messages
	queueUrl, err := s.getQueueUrlByArn(ctx, queueArn)
	if err == nil {
		_ = s.updateQueuePolicy(ctx, queueUrl, queueArn, topicArn)
	}

	return &SNSSubscription{
		ID:              *output.SubscriptionArn,
		TopicArn:        topicArn,
		Protocol:        "sqs",
		Endpoint:        queueArn,
		SubscriptionArn: *output.SubscriptionArn,
	}, nil
}

func (s *Service) SendMessage(ctx context.Context, queueUrl, body string) error {
	output, err := s.aws.SQS.SendMessage(ctx, &sqs.SendMessageInput{
		QueueUrl:    aws.String(queueUrl),
		MessageBody: aws.String(body),
	})
	if err == nil {
		s.recordHistory("sqs", queueUrl, *output.MessageId, body)
	}
	return err
}

func (s *Service) Publish(ctx context.Context, topicArn, body string) error {
	output, err := s.aws.SNS.Publish(ctx, &sns.PublishInput{
		TopicArn: aws.String(topicArn),
		Message:  aws.String(body),
	})
	if err == nil {
		s.recordHistory("sns", topicArn, *output.MessageId, body)
	}
	return err
}

func (s *Service) PurgeQueue(ctx context.Context, queueUrl string) error {
	_, err := s.aws.SQS.PurgeQueue(ctx, &sqs.PurgeQueueInput{
		QueueUrl: aws.String(queueUrl),
	})
	return err
}

func (s *Service) DeleteQueue(ctx context.Context, queueUrl string) error {
	_, err := s.aws.SQS.DeleteQueue(ctx, &sqs.DeleteQueueInput{
		QueueUrl: aws.String(queueUrl),
	})
	return err
}

func (s *Service) DeleteTopic(ctx context.Context, topicArn string) error {
	_, err := s.aws.SNS.DeleteTopic(ctx, &sns.DeleteTopicInput{
		TopicArn: aws.String(topicArn),
	})
	return err
}

func (s *Service) updateQueuePolicy(ctx context.Context, queueUrl, queueArn, topicArn string) error {
	policy := map[string]interface{}{
		"Version": "2012-10-17",
		"Statement": []map[string]interface{}{
			{
				"Effect":    "Allow",
				"Principal": "*",
				"Action":    "sqs:SendMessage",
				"Resource":  queueArn,
				"Condition": map[string]interface{}{
					"ArnEquals": map[string]interface{}{
						"aws:SourceArn": topicArn,
					},
				},
			},
		},
	}
	policyBytes, _ := json.Marshal(policy)

	_, err := s.aws.SQS.SetQueueAttributes(ctx, &sqs.SetQueueAttributesInput{
		QueueUrl: aws.String(queueUrl),
		Attributes: map[string]string{
			string(types.QueueAttributeNamePolicy): string(policyBytes),
		},
	})
	return err
}

func (s *Service) recordHistory(itemType, target, id, body string) {
	s.mu.Lock()
	defer s.mu.Unlock()

	item := HistoryItem{
		ID:        id,
		Type:      itemType,
		Target:    target,
		Body:      body,
		Timestamp: time.Now().Format(time.RFC3339),
	}

	// Prepend to history
	s.history = append([]HistoryItem{item}, s.history...)

	// Keep only last 50 items
	if len(s.history) > 50 {
		s.history = s.history[:50]
	}

	s.saveHistory()
}

func (s *Service) saveHistory() {
	data, err := json.Marshal(s.history)
	if err != nil {
		return
	}
	_ = os.WriteFile(s.persistencePath, data, 0644)
}

func (s *Service) loadHistory() {
	data, err := os.ReadFile(s.persistencePath)
	if err != nil {
		return
	}
	_ = json.Unmarshal(data, &s.history)
}

func (s *Service) getHistoryForTarget(target string) []HistoryItem {
	s.mu.RLock()
	defer s.mu.RUnlock()

	result := make([]HistoryItem, 0)
	for _, item := range s.history {
		if item.Target == target {
			result = append(result, item)
		}
	}
	return result
}
