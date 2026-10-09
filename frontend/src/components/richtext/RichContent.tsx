import { useMemo, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import DOMPurify from 'dompurify';
import parse, { domToReact, Element, Text, type DOMNode, type HTMLReactParserOptions } from 'html-react-parser';
import { LightboxImage } from '../ui';
import { NewsReferenceCard, YouTubeEmbed } from '../news';
import { looksLikeHtml, parseNewsRefUrl } from '../../utils';

// Renders a rich-text field saved by RichTextEditor. The HTML was already
// cleaned by the backend (internal/richtext); DOMPurify cleans it again here so
// nothing unsafe reaches the page even if a row was written some other way.
// Embeds in the stored markup become the site's own components:
//
//   <figure data-type="image">          → LightboxImage with caption
//   <div data-youtube="ID">             → YouTubeEmbed
//   <div data-news-ref="URL">           → NewsReferenceCard
//   <a data-mention="team|player">      → highlighted router link
//
// Values saved before the editor existed are plain text and render as
// paragraphs, never as markup.

const MENTION_STYLES: Record<string, string> = {
    team: 'bg-sffl-navy/10 text-sffl-navy dark:bg-blue-400/15 dark:text-blue-300',
    player: 'bg-sffl-red/10 text-sffl-red dark:bg-red-400/15 dark:text-red-300',
};

const VARIANT_STYLES = {
    article: 'prose prose-gray sm:prose-lg dark:prose-invert max-w-none wrap-break-word prose-headings:font-black prose-a:text-sffl-red dark:prose-a:text-red-300 prose-blockquote:border-l-sffl-red prose-th:bg-gray-100 dark:prose-th:bg-gray-800 prose-th:px-3 prose-td:px-3 prose-th:border prose-td:border prose-th:border-gray-200 prose-td:border-gray-200 dark:prose-th:border-gray-700 dark:prose-td:border-gray-700 prose-table:my-0',
    basic: 'prose prose-gray prose-sm sm:prose-base dark:prose-invert max-w-none wrap-break-word prose-p:my-2 prose-ul:my-2 prose-ol:my-2 prose-a:text-sffl-red dark:prose-a:text-red-300',
};

const textOf = (nodes: DOMNode[]): string =>
    nodes
        .map(n => (n instanceof Text ? n.data : n instanceof Element ? textOf(n.children as DOMNode[]) : ''))
        .join('');

const findChild = (el: Element, name: string): Element | undefined =>
    (el.children as DOMNode[]).find((c): c is Element => c instanceof Element && c.name === name);

const options: HTMLReactParserOptions = {
    replace(node) {
        if (!(node instanceof Element)) return undefined;
        const { name, attribs } = node;
        const children = node.children as DOMNode[];

        if (name === 'figure' && attribs['data-type'] === 'image') {
            const img = findChild(node, 'img');
            if (!img?.attribs.src) return <></>;
            const captionEl = findChild(node, 'figcaption');
            const caption = captionEl ? textOf(captionEl.children as DOMNode[]).trim() : '';
            return (
                <figure className="not-prose my-8">
                    <div className="rounded-xl overflow-hidden">
                        <LightboxImage
                            src={img.attribs.src}
                            alt={caption || img.attribs.alt || 'Article image'}
                            thumbnailClassName="w-full"
                            imgClassName="w-full h-auto object-cover"
                        />
                    </div>
                    {caption && (
                        <figcaption className="mt-2 text-center text-sm text-gray-500 dark:text-gray-400 italic">
                            {caption}
                        </figcaption>
                    )}
                </figure>
            );
        }

        if (name === 'div' && attribs['data-youtube']) {
            const videoId = attribs['data-youtube'];
            if (!/^[\w-]{11}$/.test(videoId)) return <></>;
            return (
                <div className="not-prose my-8 aspect-video rounded-xl overflow-hidden">
                    <YouTubeEmbed videoId={videoId} title="Embedded video" />
                </div>
            );
        }

        if (name === 'div' && attribs['data-news-ref']) {
            const ref = parseNewsRefUrl(attribs['data-news-ref']);
            if (!ref) return <></>;
            return (
                <div className="not-prose">
                    <NewsReferenceCard
                        url={ref.url}
                        isInternal={ref.isInternal}
                        slug={ref.slug}
                        domain={ref.domain}
                        title={attribs['data-title'] || undefined}
                    />
                </div>
            );
        }

        if (name === 'a' && attribs['data-mention']) {
            const kind = attribs['data-mention'];
            const id = attribs['data-id'];
            if (!MENTION_STYLES[kind] || !id) return <>{domToReact(children, options)}</>;
            return (
                <Link
                    to={`/${kind}s/${id}`}
                    className={`not-prose inline-flex items-baseline font-bold px-1.5 py-0.5 rounded-md no-underline hover:underline transition ${MENTION_STYLES[kind]}`}
                >
                    {textOf(children)}
                </Link>
            );
        }

        if (name === 'a' && attribs.href) {
            const href = attribs.href;
            if (href.startsWith('/') && !href.startsWith('//')) {
                return <Link to={href}>{domToReact(children, options)}</Link>;
            }
            return (
                <a href={href} target="_blank" rel="noopener noreferrer">
                    {domToReact(children, options)}
                </a>
            );
        }

        if (name === 'table') {
            // Wide tables scroll sideways inside the article instead of
            // pushing the page wider than the phone.
            return (
                <div className="my-6 overflow-x-auto">
                    <table>{domToReact(children, options)}</table>
                </div>
            );
        }

        return undefined;
    },
};

interface RichContentProps {
    html: string | null | undefined;
    /** `article` for news bodies, `basic` for descriptions and bios. */
    variant?: 'article' | 'basic';
    className?: string;
}

export const RichContent = ({ html, variant = 'article', className = '' }: RichContentProps) => {
    const rendered = useMemo<ReactNode>(() => {
        const value = (html || '').trim();
        if (!value) return null;
        if (!looksLikeHtml(value)) {
            return value
                .split(/\n\s*\n/)
                .map(p => p.trim())
                .filter(Boolean)
                .map((p, i) => (
                    <p key={i} className="whitespace-pre-line">
                        {p}
                    </p>
                ));
        }
        return parse(DOMPurify.sanitize(value), options);
    }, [html]);

    if (!rendered) return null;
    return <div className={`${VARIANT_STYLES[variant]} ${className}`}>{rendered}</div>;
};
