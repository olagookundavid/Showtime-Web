package queue

import (
	"context"
	"fmt"
	"pkg-common/helpers"
	"pkg-common/logger"
	"strings"
	"sync"
	"time"

	amqp "github.com/rabbitmq/amqp091-go"
)

const (
	DLXName           = "global-dlx-exchange"
	PublishTimeout    = 5 * time.Second
	DefaultMaxRetries = 3
	DefaultRetryDelay = 5000
)

type RabbitMQConsumer struct {
	url           string
	exchange      string
	prefetchCount int
	conn          *amqp.Connection
	channel       *amqp.Channel
	mu            sync.RWMutex
	done          chan struct{}

	connCloseErr chan *amqp.Error
	chanCloseErr chan *amqp.Error

	subscriptions []subscriptionConfig
	subMu         sync.Mutex
}

type subscriptionConfig struct {
	queue        string
	bindingKeys  []string
	handler      MessageHandler
	maxRetries   int
	retryDelayMs int
}

func NewRabbitMQConsumer(url, exchange string, prefetchCount int) (MessageConsumer, error) {
	consumer := &RabbitMQConsumer{
		url:           url,
		exchange:      exchange,
		prefetchCount: prefetchCount,
		done:          make(chan struct{}),
		subscriptions: make([]subscriptionConfig, 0),
	}

	if err := consumer.connect(); err != nil {
		return nil, err
	}

	if err := consumer.setupGlobalDLX(); err != nil {
		consumer.Close()
		return nil, fmt.Errorf("failed to setup DLX: %w", err)
	}

	helpers.BackgroundFunc(func() {
		consumer.monitorConnection()
	})

	return consumer, nil
}

func (c *RabbitMQConsumer) connect() error {
	c.mu.Lock()
	defer c.mu.Unlock()

	if c.channel != nil {
		c.channel.Close()
	}
	if c.conn != nil {
		c.conn.Close()
	}

	conn, err := amqp.Dial(c.url)
	if err != nil {
		return fmt.Errorf("failed to connect to RabbitMQ: %w", err)
	}

	ch, err := conn.Channel()
	if err != nil {
		conn.Close()
		return fmt.Errorf("failed to open channel: %w", err)
	}

	err = ch.ExchangeDeclare(
		c.exchange,
		"topic",
		true,
		false,
		false,
		false,
		nil,
	)
	if err != nil {
		ch.Close()
		conn.Close()
		return fmt.Errorf("failed to declare exchange: %w", err)
	}

	if c.prefetchCount > 0 {
		err = ch.Qos(c.prefetchCount, 0, false)
		if err != nil {
			ch.Close()
			conn.Close()
			return fmt.Errorf("failed to set QoS: %w", err)
		}
	}

	c.conn = conn
	c.channel = ch

	c.connCloseErr = make(chan *amqp.Error, 1)
	c.chanCloseErr = make(chan *amqp.Error, 1)
	c.conn.NotifyClose(c.connCloseErr)
	c.channel.NotifyClose(c.chanCloseErr)

	return nil
}

func (c *RabbitMQConsumer) setupGlobalDLX() error {
	c.mu.RLock()
	ch := c.channel
	c.mu.RUnlock()

	if ch == nil {
		return fmt.Errorf("channel is not initialized")
	}

	return ch.ExchangeDeclare(
		DLXName,
		"topic",
		true,
		false,
		false,
		false,
		nil,
	)
}

func (c *RabbitMQConsumer) monitorConnection() {
	for {
		select {
		case <-c.done:
			return
		case err := <-c.connCloseErr:
			if err != nil {
				logger.GetSingletonLogger().Printf("RabbitMQ connection closed: %v. Reconnecting...", err)
				c.reconnect()
			}
		case err := <-c.chanCloseErr:
			if err != nil {
				logger.GetSingletonLogger().Printf("RabbitMQ channel closed: %v. Reconnecting...", err)
				c.reconnect()
			}
		}
	}
}

func (c *RabbitMQConsumer) reconnect() {
	for {
		select {
		case <-c.done:
			return
		default:
			logger.GetSingletonLogger().Printf("Attempting to reconnect to RabbitMQ...")

			if err := c.connect(); err != nil {
				logger.GetSingletonLogger().Printf("Reconnection failed: %v. Retrying in 5s...", err)
				time.Sleep(5 * time.Second)
				continue
			}

			if err := c.setupGlobalDLX(); err != nil {
				logger.GetSingletonLogger().Printf("Failed to setup DLX: %v", err)
				time.Sleep(5 * time.Second)
				continue
			}

			logger.GetSingletonLogger().Printf("Successfully reconnected to RabbitMQ")

			if err := c.resubscribeAll(); err != nil {
				logger.GetSingletonLogger().Printf("Failed to resubscribe: %v. Retrying...", err)
				time.Sleep(5 * time.Second)
				continue
			}

			logger.GetSingletonLogger().Printf("Successfully resubscribed to all queues")
			return
		}
	}
}

func (c *RabbitMQConsumer) resubscribeAll() error {
	c.subMu.Lock()
	subs := make([]subscriptionConfig, len(c.subscriptions))
	copy(subs, c.subscriptions)
	c.subMu.Unlock()

	var errors []string
	for _, sub := range subs {
		if err := c.setupQueue(sub.queue, sub.bindingKeys, sub.handler, sub.maxRetries, sub.retryDelayMs); err != nil {
			errors = append(errors, fmt.Sprintf("%s: %v", sub.queue, err))
			logger.GetSingletonLogger().Printf("Failed to resubscribe to %s: %v", sub.queue, err)
		}
	}

	if len(errors) > 0 {
		return fmt.Errorf("resubscribe errors: %s", strings.Join(errors, "; "))
	}

	return nil
}

func (c *RabbitMQConsumer) Subscribe(queue string, bindingKeys []string, handler MessageHandler) error {
	return c.SubscribeWithRetry(queue, bindingKeys, handler, DefaultMaxRetries, DefaultRetryDelay)
}

func (c *RabbitMQConsumer) SubscribeWithRetry(queue string, bindingKeys []string, handler MessageHandler, maxRetries int, retryDelayMs int) error {
	c.subMu.Lock()
	c.subscriptions = append(c.subscriptions, subscriptionConfig{
		queue:        queue,
		bindingKeys:  bindingKeys,
		handler:      handler,
		maxRetries:   maxRetries,
		retryDelayMs: retryDelayMs,
	})
	c.subMu.Unlock()

	return c.setupQueue(queue, bindingKeys, handler, maxRetries, retryDelayMs)
}

func (c *RabbitMQConsumer) setupQueue(queue string, bindingKeys []string, handler MessageHandler, maxRetries int, retryDelayMs int) error {
	c.mu.RLock()
	defer c.mu.RUnlock()

	if c.channel == nil {
		return fmt.Errorf("channel is not initialized")
	}

	dlxName := DLXName

	retryQueueName := queue + "-retry"
	_, err := c.channel.QueueDeclare(
		retryQueueName,
		true,
		false,
		false,
		false,
		amqp.Table{
			"x-dead-letter-exchange":    c.exchange,
			"x-dead-letter-routing-key": getPrimaryRoutingKey(bindingKeys),
			"x-message-ttl":             int32(retryDelayMs),
		},
	)
	if err != nil {
		return fmt.Errorf("failed to declare retry queue: %w", err)
	}

	err = c.channel.QueueBind(retryQueueName, queue+".retry", dlxName, false, nil)
	if err != nil {
		return fmt.Errorf("failed to bind retry queue: %w", err)
	}

	dlqName := queue + "-dlq"
	_, err = c.channel.QueueDeclare(
		dlqName,
		true,
		false,
		false,
		false,
		nil,
	)
	if err != nil {
		return fmt.Errorf("failed to declare DLQ: %w", err)
	}

	err = c.channel.QueueBind(dlqName, queue+".failed", dlxName, false, nil)
	if err != nil {
		return fmt.Errorf("failed to bind DLQ: %w", err)
	}

	q, err := c.channel.QueueDeclare(
		queue,
		true,
		false,
		false,
		false,
		amqp.Table{
			"x-dead-letter-exchange": dlxName,
		},
	)
	if err != nil {
		return fmt.Errorf("failed to declare queue: %w", err)
	}

	for _, key := range bindingKeys {
		err = c.channel.QueueBind(q.Name, key, c.exchange, false, nil)
		if err != nil {
			return fmt.Errorf("failed to bind queue to key %s: %w", key, err)
		}
	}

	msgs, err := c.channel.Consume(
		q.Name,
		"",
		false,
		false,
		false,
		false,
		nil,
	)
	if err != nil {
		return fmt.Errorf("failed to start consuming: %w", err)
	}
	helpers.BackgroundFunc(func() {
		c.handleMessages(msgs, handler, maxRetries, queue)
	})

	logger.GetSingletonLogger().Printf("Started consuming from queue: %s (maxRetries: %d, retryDelay: %dms, DLQ: %s)",
		queue, maxRetries, retryDelayMs, dlqName)
	return nil
}

func (c *RabbitMQConsumer) handleMessages(msgs <-chan amqp.Delivery, handler MessageHandler, maxRetries int, queue string) {
	for d := range msgs {
		retryCount := getRetryCount(d)

		if err := handler.HandleMessage(d.RoutingKey, d.Body); err != nil {
			logger.GetSingletonLogger().Printf("Error handling message (attempt %d/%d): %v",
				retryCount+1, maxRetries+1, err)

			if retryCount < maxRetries {
				if err := c.sendToRetryQueue(d, retryCount+1, queue); err == nil {
					d.Ack(false)
				} else {
					logger.GetSingletonLogger().Printf("Failed to publish to retry queue. Requeueing message. Error: %v", err)
					d.Nack(false, true)
				}
			} else {
				logger.GetSingletonLogger().Printf("Max retries reached for message. Sending to DLQ. Routing key: %s", d.RoutingKey)

				if err := c.sendToDLQ(d, queue); err == nil {
					d.Ack(false)
				} else {
					logger.GetSingletonLogger().Printf("Failed to publish to DLQ. Requeueing message. Error: %v", err)
					d.Nack(false, true)
				}
			}
		} else {
			d.Ack(false)
		}
	}
}

func getRetryCount(d amqp.Delivery) int {
	if d.Headers == nil {
		return 0
	}
	if count, ok := d.Headers["x-retry-count"].(int32); ok {
		return int(count)
	}
	return 0
}

func (c *RabbitMQConsumer) sendToRetryQueue(d amqp.Delivery, retryCount int, queue string) error {
	c.mu.RLock()
	ch := c.channel
	c.mu.RUnlock()

	if ch == nil {
		return fmt.Errorf("channel is not initialized")
	}

	headers := d.Headers
	if headers == nil {
		headers = amqp.Table{}
	}
	headers["x-retry-count"] = int32(retryCount)
	headers["x-original-queue"] = queue

	ctx, cancel := context.WithTimeout(context.Background(), PublishTimeout)
	defer cancel()

	err := ch.PublishWithContext(
		ctx,
		DLXName,
		queue+".retry",
		false,
		false,
		amqp.Publishing{
			ContentType:  d.ContentType,
			Body:         d.Body,
			Headers:      headers,
			Timestamp:    time.Now(),
			DeliveryMode: amqp.Persistent,
		},
	)

	if err != nil {
		return fmt.Errorf("failed to send message to retry queue: %w", err)
	}

	logger.GetSingletonLogger().Printf("Message sent to retry queue (attempt %d)", retryCount)
	return nil
}

func (c *RabbitMQConsumer) sendToDLQ(d amqp.Delivery, queue string) error {
	c.mu.RLock()
	ch := c.channel
	c.mu.RUnlock()

	if ch == nil {
		return fmt.Errorf("channel is not initialized")
	}

	headers := d.Headers
	if headers == nil {
		headers = amqp.Table{}
	}
	headers["x-death-reason"] = "max-retries-exceeded"
	headers["x-death-time"] = time.Now().Format(time.RFC3339)
	headers["x-original-queue"] = queue

	ctx, cancel := context.WithTimeout(context.Background(), PublishTimeout)
	defer cancel()

	err := ch.PublishWithContext(
		ctx,
		DLXName,
		queue+".failed",
		false,
		false,
		amqp.Publishing{
			ContentType:  d.ContentType,
			Body:         d.Body,
			Headers:      headers,
			Timestamp:    time.Now(),
			DeliveryMode: amqp.Persistent,
		},
	)

	if err != nil {
		return fmt.Errorf("failed to send message to DLQ: %w", err)
	}

	logger.GetSingletonLogger().Printf("Message sent to DLQ: %s", queue)
	return nil
}

func (c *RabbitMQConsumer) Close() {
	close(c.done)

	c.mu.Lock()
	defer c.mu.Unlock()

	if c.channel != nil {
		c.channel.Close()
	}
	if c.conn != nil {
		c.conn.Close()
	}

	logger.GetSingletonLogger().Printf("RabbitMQ consumer closed gracefully")
}

func getPrimaryRoutingKey(bindingKeys []string) string {
	if len(bindingKeys) == 0 {
		return "#"
	}
	return bindingKeys[0]
}
