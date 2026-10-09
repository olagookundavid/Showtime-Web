// Package richtext cleans the HTML that admin rich-text editors produce before
// it is stored, and derives plain text from it for search and previews.
//
// Two allowlists exist: Article (news / TOTW story bodies: headings, tables,
// embeds) and Basic (product descriptions, bios, badge descriptions: inline
// formatting, lists and links only). Anything not on the list is dropped, so a
// compromised editor account can't plant scripts on public pages.
//
// Values that aren't HTML (legacy plain text) pass through untouched; the
// frontend renders those as plain paragraphs, never as markup. LooksLikeHTML is
// the shared test, mirrored by looksLikeHtml in frontend/src/utils/richText.ts.
//
// The embed markup is a contract with the editor and the public renderer
// (frontend/src/components/richtext/):
//
//	<figure data-type="image"><img src="URL" alt="…"><figcaption>…</figcaption></figure>
//	<div data-youtube="VIDEO_ID"></div>
//	<div data-news-ref="URL or /news/slug" data-title="…"></div>
//	<a data-mention="team|player" data-id="UUID" href="/teams/UUID">Name</a>
package richtext

import (
	"html"
	"regexp"
	"strings"

	"github.com/microcosm-cc/bluemonday"
)

var (
	colorRe     = regexp.MustCompile(`^(#[0-9a-fA-F]{3,8}|rgba?\(\s*[\d.]+%?\s*,\s*[\d.]+%?\s*,\s*[\d.]+%?\s*(,\s*[\d.]+%?\s*)?\))$`)
	uuidRe      = regexp.MustCompile(`^[0-9a-fA-F-]{36}$`)
	youTubeIDRe = regexp.MustCompile(`^[\w-]{11}$`)
	refURLRe    = regexp.MustCompile(`^[^\s"'<>]{1,1000}$`)
	colWidthRe  = regexp.MustCompile(`^\d+(,\d+)*$`)

	basicPolicy   = newBasicPolicy()
	articlePolicy = newArticlePolicy()
	stripPolicy   = bluemonday.StrictPolicy()
)

func newBasicPolicy() *bluemonday.Policy {
	p := bluemonday.NewPolicy()
	p.AllowElements("p", "br", "strong", "b", "em", "i", "u", "s", "sub", "sup", "ul", "ol", "li", "span", "mark")
	p.AllowAttrs("start").Matching(bluemonday.Integer).OnElements("ol")

	p.RequireParseableURLs(true)
	p.AllowRelativeURLs(true)
	p.AllowURLSchemes("http", "https", "mailto", "tel")
	p.AllowAttrs("href").OnElements("a")
	p.AddTargetBlankToFullyQualifiedLinks(true)
	p.AllowAttrs("data-mention").Matching(regexp.MustCompile(`^(team|player)$`)).OnElements("a")
	p.AllowAttrs("data-id").Matching(uuidRe).OnElements("a")

	p.AllowStyles("color").Matching(colorRe).OnElements("span")
	p.AllowStyles("background-color").Matching(colorRe).OnElements("span", "mark")
	p.AllowAttrs("data-color").Matching(colorRe).OnElements("mark")
	return p
}

func newArticlePolicy() *bluemonday.Policy {
	p := newBasicPolicy()
	p.AllowElements("h2", "h3", "h4", "blockquote", "hr", "pre", "code",
		"table", "thead", "tbody", "tr", "th", "td", "colgroup", "col", "figcaption")
	p.AllowAttrs("colspan", "rowspan").Matching(bluemonday.Integer).OnElements("td", "th")
	p.AllowAttrs("colwidth").Matching(colWidthRe).OnElements("td", "th")
	p.AllowStyles("text-align").MatchingEnum("left", "center", "right", "justify").
		OnElements("p", "h2", "h3", "h4", "td", "th")

	p.AllowAttrs("data-type").Matching(regexp.MustCompile(`^image$`)).OnElements("figure")
	p.AllowAttrs("src").OnElements("img")
	p.AllowAttrs("alt").OnElements("img")
	p.AllowAttrs("data-youtube").Matching(youTubeIDRe).OnElements("div")
	p.AllowAttrs("data-news-ref").Matching(refURLRe).OnElements("div")
	p.AllowAttrs("data-title").OnElements("div")
	return p
}

// LooksLikeHTML reports whether a stored value is editor HTML rather than
// legacy plain text. Every editor document starts with a block element.
func LooksLikeHTML(s string) bool {
	return strings.HasPrefix(strings.TrimSpace(s), "<")
}

// SanitizeArticle cleans an article body (news, TOTW story).
func SanitizeArticle(s string) string {
	if !LooksLikeHTML(s) {
		return s
	}
	return strings.TrimSpace(articlePolicy.Sanitize(s))
}

// SanitizeBasic cleans a short formatted field (descriptions, bios).
func SanitizeBasic(s string) string {
	if !LooksLikeHTML(s) {
		return s
	}
	out := strings.TrimSpace(basicPolicy.Sanitize(s))
	if PlainText(out) == "" {
		// An editor cleared to "<p></p>" means "no description".
		return ""
	}
	return out
}

var blockBoundaryRe = regexp.MustCompile(`(?i)<br\s*/?>|</(p|h[1-6]|li|td|th|figcaption|blockquote|pre|div|tr)>`)
var spaceRunRe = regexp.MustCompile(`\s+`)

// PlainText returns the readable text of a value, for search and previews.
// Block boundaries become spaces so words from adjacent paragraphs don't fuse.
func PlainText(s string) string {
	if !LooksLikeHTML(s) {
		return strings.TrimSpace(s)
	}
	s = blockBoundaryRe.ReplaceAllString(s, "$0 ")
	s = html.UnescapeString(stripPolicy.Sanitize(s))
	return strings.TrimSpace(spaceRunRe.ReplaceAllString(s, " "))
}

var imgSrcRe = regexp.MustCompile(`<img[^>]+src="([^"]+)"`)

// ImageURLs lists every inline image an article body references, in either the
// HTML format or the legacy [image:URL] tag format.
func ImageURLs(s string) map[string]struct{} {
	urls := make(map[string]struct{})
	for _, m := range imgSrcRe.FindAllStringSubmatch(s, -1) {
		urls[html.UnescapeString(m[1])] = struct{}{}
	}
	for _, m := range legacyImageTagRe.FindAllStringSubmatch(s, -1) {
		urls[strings.TrimSpace(m[1])] = struct{}{}
	}
	return urls
}
