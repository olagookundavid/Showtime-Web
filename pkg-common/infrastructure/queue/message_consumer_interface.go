package queue

type MessageConsumer interface {
	Subscribe(queue string, bindingKeys []string, handler MessageHandler) error
	Close()
}

type MessageHandler interface {
	HandleMessage(topic string, body []byte) error
}
