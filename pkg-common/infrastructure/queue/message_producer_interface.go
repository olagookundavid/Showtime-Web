package queue

type MessagePublisher interface {
	Publish(topic string, data any) error
	Close()
}
