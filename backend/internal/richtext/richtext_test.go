package richtext

import (
	"strings"
	"testing"
)

const testUUID = "3f2b8c1e-1d2a-4c3b-9e8f-0a1b2c3d4e5f"

func TestSanitizeArticleKeepsEditorMarkup(t *testing.T) {
	in := `<h2 style="text-align: center">Title</h2>` +
		`<p><strong>Bold</strong> <em>it</em> <u>u</u> <s>s</s> <span style="color: #ff0000">red</span> <mark data-color="#ffff00" style="background-color: #ffff00">hl</mark></p>` +
		`<ul><li><p>one</p></li></ul><ol start="3"><li><p>three</p></li></ol>` +
		`<table><tbody><tr><th colspan="2" rowspan="1"><p>H</p></th></tr><tr><td colspan="1" rowspan="1" colwidth="120"><p>c</p></td></tr></tbody></table>` +
		`<figure data-type="image"><img src="https://cdn.example.com/a.jpg" alt="cap"><figcaption>cap</figcaption></figure>` +
		`<div data-youtube="dQw4w9WgXcQ"></div>` +
		`<div data-news-ref="/news/some-slug" data-title="Read this"></div>` +
		`<p><a data-mention="player" data-id="` + testUUID + `" href="/players/` + testUUID + `">Jones</a></p>` +
		`<blockquote><p>q</p></blockquote><hr>`
	out := SanitizeArticle(in)
	for _, want := range []string{
		`<h2 style="text-align: center">`,
		`<span style="color: #ff0000">red</span>`,
		`data-color="#ffff00"`,
		`<ol start="3">`,
		`colspan="2"`,
		`colwidth="120"`,
		`<figure data-type="image"><img src="https://cdn.example.com/a.jpg" alt="cap"><figcaption>cap</figcaption></figure>`,
		`<div data-youtube="dQw4w9WgXcQ"></div>`,
		`<div data-news-ref="/news/some-slug" data-title="Read this"></div>`,
		`data-mention="player"`,
		`href="/players/` + testUUID + `"`,
		`<blockquote>`,
		`<hr>`,
	} {
		if !strings.Contains(out, want) {
			t.Errorf("sanitized output lost %q\n got: %s", want, out)
		}
	}
}

func TestSanitizeStripsDangerousMarkup(t *testing.T) {
	in := `<p onclick="x()">hi<script>alert(1)</script></p>` +
		`<img src="javascript:alert(1)" onerror="alert(1)">` +
		`<a href="javascript:alert(1)">bad</a>` +
		`<iframe src="https://evil.example"></iframe>` +
		`<span style="color: red; position: fixed">x</span>` +
		`<div data-youtube="not a valid id!!"></div>`
	out := SanitizeArticle(in)
	for _, bad := range []string{"script", "onclick", "onerror", "javascript:", "iframe", "position", "data-youtube"} {
		if strings.Contains(out, bad) {
			t.Errorf("sanitized output still contains %q: %s", bad, out)
		}
	}
}

func TestSanitizeBasicDropsArticleOnlyMarkup(t *testing.T) {
	out := SanitizeBasic(`<h2>Big</h2><p><strong>ok</strong></p><table><tr><td>t</td></tr></table>`)
	if strings.Contains(out, "<h2") || strings.Contains(out, "<table") {
		t.Errorf("basic policy kept article markup: %s", out)
	}
	if !strings.Contains(out, "<strong>ok</strong>") {
		t.Errorf("basic policy lost inline formatting: %s", out)
	}
	if got := SanitizeBasic("<p></p>"); got != "" {
		t.Errorf("empty editor doc should store as empty, got %q", got)
	}
	if got := SanitizeBasic("plain <b>text</b> & more"); got != "plain <b>text</b> & more" {
		t.Errorf("plain text must pass through untouched, got %q", got)
	}
}

func TestExternalLinksOpenInNewTab(t *testing.T) {
	out := SanitizeBasic(`<p><a href="https://example.com">x</a></p>`)
	if !strings.Contains(out, `target="_blank"`) || !strings.Contains(out, "noopener") {
		t.Errorf("external link not opened safely: %s", out)
	}
}

func TestPlainText(t *testing.T) {
	got := PlainText(`<p>Hello <strong>world</strong>.</p><p>Next&amp;para</p><ul><li><p>a</p></li></ul>`)
	if got != "Hello world. Next&para a" {
		t.Errorf("PlainText = %q", got)
	}
	if got := PlainText("  legacy text  "); got != "legacy text" {
		t.Errorf("PlainText(legacy) = %q", got)
	}
}

func TestLegacyToHTML(t *testing.T) {
	in := "First para with [player:" + testUUID + "|Jones] & co.\n\n" +
		"[image:https://cdn.example.com/a.jpg|Jones scores]\n\n" +
		"[youtube:https://youtu.be/dQw4w9WgXcQ]\n" +
		"[news:/news/some-slug|Earlier story]\n\n" +
		"[youtube:nope]\n\nLast <para>"
	out := LegacyToHTML(in)
	for _, want := range []string{
		`<p>First para with <a data-mention="player" data-id="` + testUUID + `" href="/players/` + testUUID + `">Jones</a> &amp; co.</p>`,
		`<figure data-type="image"><img src="https://cdn.example.com/a.jpg" alt="Jones scores"><figcaption>Jones scores</figcaption></figure>`,
		`<div data-youtube="dQw4w9WgXcQ"></div>`,
		`<div data-news-ref="/news/some-slug" data-title="Earlier story"></div>`,
		`<p>[youtube:nope]</p>`,
		`<p>Last &lt;para&gt;</p>`,
	} {
		if !strings.Contains(out, want) {
			t.Errorf("LegacyToHTML missing %q\n got: %s", want, out)
		}
	}
	// The converted body must survive the article sanitizer unchanged in substance.
	if SanitizeArticle(out) == "" || !strings.Contains(SanitizeArticle(out), "data-youtube") {
		t.Errorf("converted legacy body did not survive sanitizing: %s", SanitizeArticle(out))
	}
	if got := LegacyToHTML("<p>already html</p>"); got != "<p>already html</p>" {
		t.Errorf("HTML input should pass through, got %q", got)
	}
}

func TestImageURLs(t *testing.T) {
	urls := ImageURLs(`<figure data-type="image"><img src="https://cdn.example.com/a.jpg?x=1&amp;y=2" alt=""></figure> [image:https://cdn.example.com/b.jpg|c]`)
	for _, want := range []string{"https://cdn.example.com/a.jpg?x=1&y=2", "https://cdn.example.com/b.jpg"} {
		if _, ok := urls[want]; !ok {
			t.Errorf("ImageURLs missing %q: %v", want, urls)
		}
	}
}

func TestYouTubeID(t *testing.T) {
	for in, want := range map[string]string{
		"dQw4w9WgXcQ": "dQw4w9WgXcQ",
		"https://www.youtube.com/watch?v=dQw4w9WgXcQ": "dQw4w9WgXcQ",
		"https://youtu.be/dQw4w9WgXcQ":                "dQw4w9WgXcQ",
		"https://youtube.com/shorts/dQw4w9WgXcQ":      "dQw4w9WgXcQ",
		"https://example.com/watch?v=dQw4w9WgXcQ":     "",
		"nope": "",
	} {
		if got := YouTubeID(in); got != want {
			t.Errorf("YouTubeID(%q) = %q, want %q", in, got, want)
		}
	}
}

// Captured from the real editor (RichTextEditorImpl) in a browser, so the
// allowlist is checked against what TipTap actually serializes — browsers
// normalize colours to rgb() and add trailing semicolons, for example.
func TestSanitizeKeepsRealEditorOutput(t *testing.T) {
	in := `<p>O<span style="color: rgb(29, 78, 216);"><strong><mark data-color="#fef08a" style="background-color: rgb(254, 240, 138); color: inherit;">ld </mark></strong></span>plain text para one.</p>` +
		`<h3 style="text-align: center;">tail</h3>` +
		`<table style="min-width: 50px;"><colgroup><col style="min-width: 25px;"><col style="min-width: 25px;"></colgroup><tbody><tr><th colspan="1" rowspan="1"><p>h</p></th></tr><tr><td colspan="1" rowspan="1" colwidth="150"><p>c</p></td></tr></tbody></table>` +
		`<figure data-type="image"><img src="https://example.com/b.jpg" alt="A caption"><figcaption>A caption</figcaption></figure>` +
		`<div data-youtube="dQw4w9WgXcQ"></div><div data-news-ref="/news/some-slug"></div>` +
		`<ul><li><p><a data-mention="team" data-id="` + testUUID + `" href="/teams/` + testUUID + `">Rebels</a>item</p></li></ul><p></p>`
	out := SanitizeArticle(in)
	for _, want := range []string{
		`<span style="color: rgb(29, 78, 216)">`,
		`background-color: rgb(254, 240, 138)`,
		`<h3 style="text-align: center">tail</h3>`,
		`<td colspan="1" rowspan="1" colwidth="150">`,
		`<figure data-type="image"><img src="https://example.com/b.jpg" alt="A caption"><figcaption>A caption</figcaption></figure>`,
		`<div data-youtube="dQw4w9WgXcQ"></div>`,
		`<div data-news-ref="/news/some-slug"></div>`,
		`<a data-mention="team" data-id="` + testUUID + `" href="/teams/` + testUUID + `">Rebels</a>`,
	} {
		if !strings.Contains(out, want) {
			t.Errorf("sanitized editor output lost %q\n got: %s", want, out)
		}
	}
}
