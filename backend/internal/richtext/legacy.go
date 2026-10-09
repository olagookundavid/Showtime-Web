package richtext

import (
	"fmt"
	"html"
	"net/url"
	"regexp"
	"strings"
)

// Articles written before the rich-text editor used a plain-text tag grammar:
//
//	[image:URL] / [image:URL|Caption]   block photo
//	[youtube:URL or id]                 block video
//	[news:URL] / [news:URL|Title]       block news reference card
//	[team:UUID|Name] / [player:UUID|Name] inline mention
//
// with paragraphs separated by blank lines. LegacyToHTML converts that grammar
// to the editor's HTML so old articles render and edit like new ones. A tag that
// can't be parsed stays as its literal text, as it always rendered.

var (
	legacyMediaTagRe   = regexp.MustCompile(`\[(image|youtube|news):([^\]]+)\]`)
	legacyMentionTagRe = regexp.MustCompile(`\[(team|player):([^|\]]+)\|([^\]]+)\]`)
	legacyImageTagRe   = regexp.MustCompile(`\[image:([^|\]]+)`)
	paragraphBreakRe   = regexp.MustCompile(`\n{2,}`)
)

// LegacyToHTML converts a tag-grammar article body to editor HTML. HTML input
// is returned unchanged.
func LegacyToHTML(content string) string {
	if LooksLikeHTML(content) {
		return content
	}
	content = strings.ReplaceAll(content, "\r\n", "\n")

	var b strings.Builder
	last := 0
	for _, loc := range legacyMediaTagRe.FindAllStringSubmatchIndex(content, -1) {
		writeParagraphs(&b, content[last:loc[0]])
		full := content[loc[0]:loc[1]]
		kind := content[loc[2]:loc[3]]
		body := content[loc[4]:loc[5]]
		if block, ok := legacyMediaBlock(kind, body); ok {
			b.WriteString(block)
		} else {
			writeParagraphs(&b, full)
		}
		last = loc[1]
	}
	writeParagraphs(&b, content[last:])
	return b.String()
}

func legacyMediaBlock(kind, body string) (string, bool) {
	main, extra, _ := strings.Cut(body, "|")
	main, extra = strings.TrimSpace(main), strings.TrimSpace(extra)
	switch kind {
	case "image":
		if main == "" {
			return "", false
		}
		alt := extra
		if alt == "" {
			alt = "Article image"
		}
		caption := ""
		if extra != "" {
			caption = "<figcaption>" + html.EscapeString(extra) + "</figcaption>"
		}
		return fmt.Sprintf(`<figure data-type="image"><img src="%s" alt="%s">%s</figure>`,
			html.EscapeString(main), html.EscapeString(alt), caption), true
	case "youtube":
		id := YouTubeID(body)
		if id == "" {
			return "", false
		}
		return fmt.Sprintf(`<div data-youtube="%s"></div>`, id), true
	case "news":
		if main == "" || !refURLRe.MatchString(main) {
			return "", false
		}
		title := ""
		if extra != "" {
			title = fmt.Sprintf(` data-title="%s"`, html.EscapeString(extra))
		}
		return fmt.Sprintf(`<div data-news-ref="%s"%s></div>`, html.EscapeString(main), title), true
	}
	return "", false
}

func writeParagraphs(b *strings.Builder, text string) {
	for _, para := range paragraphBreakRe.Split(text, -1) {
		if strings.TrimSpace(para) == "" {
			continue
		}
		b.WriteString("<p>")
		b.WriteString(inlineMentions(strings.TrimSpace(para)))
		b.WriteString("</p>")
	}
}

func inlineMentions(text string) string {
	var b strings.Builder
	last := 0
	for _, loc := range legacyMentionTagRe.FindAllStringSubmatchIndex(text, -1) {
		b.WriteString(html.EscapeString(text[last:loc[0]]))
		kind := text[loc[2]:loc[3]]
		id := strings.TrimSpace(text[loc[4]:loc[5]])
		name := strings.TrimSpace(text[loc[6]:loc[7]])
		if uuidRe.MatchString(id) {
			fmt.Fprintf(&b, `<a data-mention="%s" data-id="%s" href="/%ss/%s">%s</a>`,
				kind, id, kind, id, html.EscapeString(name))
		} else {
			b.WriteString(html.EscapeString(text[loc[0]:loc[1]]))
		}
		last = loc[1]
	}
	b.WriteString(html.EscapeString(text[last:]))
	return b.String()
}

var youTubePathRe = regexp.MustCompile(`^/(?:embed|shorts|live|v)/([\w-]{11})`)

// YouTubeID extracts the 11-char video id from any YouTube URL form or a bare
// id, or returns "". Mirrors parseYouTubeId in frontend/src/utils/newsContent.ts.
func YouTubeID(input string) string {
	s := strings.TrimSpace(input)
	if youTubeIDRe.MatchString(s) {
		return s
	}
	u, err := url.Parse(s)
	if err != nil || u.Host == "" {
		return ""
	}
	host := strings.TrimPrefix(strings.TrimPrefix(u.Hostname(), "www."), "m.")
	switch host {
	case "youtu.be":
		id := strings.Split(strings.TrimPrefix(u.Path, "/"), "/")[0]
		if youTubeIDRe.MatchString(id) {
			return id
		}
	case "youtube.com", "youtube-nocookie.com":
		if v := u.Query().Get("v"); youTubeIDRe.MatchString(v) {
			return v
		}
		if m := youTubePathRe.FindStringSubmatch(u.Path); m != nil {
			return m[1]
		}
	}
	return ""
}
