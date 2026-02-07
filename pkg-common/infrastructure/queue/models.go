package queue

import "io"

type ImageRequest struct {
	File        io.Reader
	Filename    string
	ContentType string
	ProductId   string
	Type        string
}
