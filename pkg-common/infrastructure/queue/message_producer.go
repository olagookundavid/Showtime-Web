package queue

import (
	"context"
	"encoding/json"
	"fmt"
	"pkg-common/helpers"
	"pkg-common/logger"
	"sync"
	"time"

	amqp "github.com/rabbitmq/amqp091-go"
)

type RabbitMQPublisher struct {
	url      string
	exchange string
	conn     *amqp.Connection
	channel  *amqp.Channel
	mu       sync.RWMutex
	done     chan struct{}

	// Notification channels
	connCloseErr chan *amqp.Error
	chanCloseErr chan *amqp.Error
}

func NewRabbitMQPublisher(url, exchange string) (MessagePublisher, error) {
	pub := &RabbitMQPublisher{
		url:      url,
		exchange: exchange,
		done:     make(chan struct{}),
	}

	if err := pub.connect(); err != nil {
		return nil, err
	}

	// Start connection monitor
	helpers.BackgroundFunc(func() {
		pub.monitorConnection()
	})

	return pub, nil
}

func (p *RabbitMQPublisher) connect() error {
	p.mu.Lock()
	defer p.mu.Unlock()

	// Close existing connection if any
	if p.channel != nil {
		p.channel.Close()
	}
	if p.conn != nil {
		p.conn.Close()
	}

	// Establish new connection
	conn, err := amqp.Dial(p.url)
	if err != nil {
		return fmt.Errorf("failed to connect to RabbitMQ: %w", err)
	}

	ch, err := conn.Channel()
	if err != nil {
		conn.Close()
		return fmt.Errorf("failed to open channel: %w", err)
	}

	// Declare exchange
	err = ch.ExchangeDeclare(
		p.exchange,
		"topic",
		true,  // durable
		false, // auto-deleted
		false, // internal
		false, // no-wait
		nil,
	)
	if err != nil {
		ch.Close()
		conn.Close()
		return fmt.Errorf("failed to declare exchange: %w", err)
	}

	p.conn = conn
	p.channel = ch

	// Setup notification channels for connection/channel closure
	p.connCloseErr = make(chan *amqp.Error, 1)
	p.chanCloseErr = make(chan *amqp.Error, 1)
	p.conn.NotifyClose(p.connCloseErr)
	p.channel.NotifyClose(p.chanCloseErr)

	return nil
}

func (p *RabbitMQPublisher) monitorConnection() {
	for {
		select {
		case <-p.done:
			return
		case err := <-p.connCloseErr:
			if err != nil {
				logger.GetSingletonLogger().Printf("RabbitMQ connection closed: %v. Reconnecting...", err)
				p.reconnect()
			}
		case err := <-p.chanCloseErr:
			if err != nil {
				logger.GetSingletonLogger().Printf("RabbitMQ channel closed: %v. Reconnecting...", err)
				p.reconnect()
			}
		}
	}
}

func (p *RabbitMQPublisher) reconnect() {
	retryInterval := time.Second
	maxRetryInterval := 30 * time.Second

	for {
		select {
		case <-p.done:
			return
		default:
			logger.GetSingletonLogger().Printf("Attempting to reconnect to RabbitMQ (waiting %v)...", retryInterval)
			time.Sleep(retryInterval)

			if err := p.connect(); err != nil {
				logger.GetSingletonLogger().Printf("Reconnection failed: %v", err)
				// Exponential backoff
				retryInterval = min(retryInterval*2, maxRetryInterval)
				continue
			}

			logger.GetSingletonLogger().Printf("Successfully reconnected to RabbitMQ")
			return
		}
	}
}

func (p *RabbitMQPublisher) Publish(topic string, data any) error {
	p.mu.RLock()
	defer p.mu.RUnlock()

	// Check if channel is available
	if p.channel == nil {
		return fmt.Errorf("channel is not initialized")
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	jsonBody, err := json.Marshal(data)
	if err != nil {
		return fmt.Errorf("failed to marshal JSON: %w", err)
	}

	err = p.channel.PublishWithContext(
		ctx,
		p.exchange,
		topic,
		false, // mandatory
		false, // immediate
		amqp.Publishing{
			ContentType:  "application/json",
			Body:         jsonBody,
			Timestamp:    time.Now(),
			DeliveryMode: amqp.Persistent,
		},
	)

	if err != nil {
		return fmt.Errorf("failed to publish message: %w", err)
	}

	return nil
}

func (p *RabbitMQPublisher) Close() {
	close(p.done)

	p.mu.Lock()
	defer p.mu.Unlock()

	if p.channel != nil {
		p.channel.Close()
	}
	if p.conn != nil {
		p.conn.Close()
	}
}

func (p *RabbitMQPublisher) IsHealthy() bool {
	p.mu.RLock()
	defer p.mu.RUnlock()

	return p.conn != nil && !p.conn.IsClosed() &&
		p.channel != nil && !p.channel.IsClosed()
}

func (p *RabbitMQPublisher) GetStats() map[string]interface{} {
	p.mu.RLock()
	defer p.mu.RUnlock()

	return map[string]interface{}{
		"connected":    p.conn != nil && !p.conn.IsClosed(),
		"channel_open": p.channel != nil && !p.channel.IsClosed(),
		"exchange":     p.exchange,
	}
}
