package domain

import (
	"errors"
	"time"
)

// FantasyCarouselMax is the most slides the Fantasy page carousel holds.
const FantasyCarouselMax = 10

// FantasyNewsCategories are the news categories a quick-added Fantasy article
// can be filed under. The first is the default.
var FantasyNewsCategories = []string{"Fantasy", "Fantasy News"}

var (
	// ErrFantasyCarouselFull is returned when the carousel already holds
	// FantasyCarouselMax slides.
	ErrFantasyCarouselFull = errors.New("the Fantasy carousel is full — it holds up to 10 articles. Remove one before adding another")
	// ErrAlreadyOnFantasyCarousel is returned when the article is already a slide.
	ErrAlreadyOnFantasyCarousel = errors.New("that article is already on the Fantasy carousel")
	// ErrFantasyCarouselArticleNotFound is returned when the article to add does
	// not exist, or is a hidden hero-slide article that cannot be featured.
	ErrFantasyCarouselArticleNotFound = errors.New("that article could not be found")
)

// FantasyCarouselSlide features one news article on the Fantasy page carousel.
// The article supplies everything the slide shows.
type FantasyCarouselSlide struct {
	ID           string
	NewsID       string
	DisplayOrder int
	IsActive     bool
	CreatedAt    time.Time
	UpdatedAt    time.Time
	News         *News
}
