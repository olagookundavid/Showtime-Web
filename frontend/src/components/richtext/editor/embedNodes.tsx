import { Node } from '@tiptap/core';
import { NodeViewWrapper, ReactNodeViewRenderer, type ReactNodeViewProps } from '@tiptap/react';
import { PlayCircleIcon, TrashIcon } from '@heroicons/react/24/outline';
import { IconButton } from '../../ui';
import { NewsReferenceCard } from '../../news';
import { parseNewsRefUrl, youTubeThumbnailUrl } from '../../../utils';

// Block embeds an article can carry. Each one stores the markup contract in
// backend/internal/richtext/richtext.go, and RichContent turns it back into the
// site's components on the public page. In the editor they show as a preview
// card that can be dragged, selected and deleted as one piece.

declare module '@tiptap/core' {
    interface Commands<ReturnType> {
        embeds: {
            insertFigureImage: (attrs: { src: string; caption?: string }) => ReturnType;
            insertYouTube: (attrs: { videoId: string }) => ReturnType;
            insertNewsRef: (attrs: { url: string; title?: string }) => ReturnType;
        };
    }
}

const frameClass = (selected: boolean) =>
    `my-4 rounded-xl border-2 transition ${selected ? 'border-sffl-red' : 'border-transparent'}`;

const RemoveButton = ({ onRemove, label }: { onRemove: () => void; label: string }) => (
    <IconButton
        icon={TrashIcon}
        label={label}
        variant="secondary"
        onClick={onRemove}
        className="absolute top-2 right-2 shadow"
    />
);

// --- Image with caption ----------------------------------------------------

const FigureImageView = ({ node, updateAttributes, deleteNode, selected, editor }: ReactNodeViewProps) => {
    const { src, caption } = node.attrs as { src: string; caption: string };
    return (
        <NodeViewWrapper className={frameClass(selected)} data-drag-handle>
            <figure className="relative m-0">
                <img src={src} alt={caption || 'Article image'} className="w-full h-auto rounded-xl" />
                {editor.isEditable && <RemoveButton onRemove={deleteNode} label="Remove image" />}
                {/* Raw input: a borderless caption line inside the image card. */}
                <input
                    type="text"
                    value={caption}
                    onChange={e => updateAttributes({ caption: e.target.value })}
                    placeholder="Add a caption (optional)"
                    aria-label="Image caption"
                    className="mt-2 w-full bg-transparent text-center text-base sm:text-sm italic text-gray-600 dark:text-gray-300 placeholder:text-gray-400 focus:outline-none min-h-11"
                />
            </figure>
        </NodeViewWrapper>
    );
};

export const FigureImage = Node.create({
    name: 'figureImage',
    group: 'block',
    atom: true,
    draggable: true,

    addAttributes() {
        return {
            src: { default: null },
            caption: { default: '' },
        };
    },

    parseHTML() {
        return [
            {
                tag: 'figure[data-type="image"]',
                getAttrs: el => ({
                    src: el.querySelector('img')?.getAttribute('src') ?? null,
                    caption: el.querySelector('figcaption')?.textContent?.trim() ?? '',
                }),
            },
            // A bare <img> pasted from another page becomes a captionless figure.
            {
                tag: 'img[src]',
                getAttrs: el => ({ src: el.getAttribute('src'), caption: '' }),
            },
        ];
    },

    renderHTML({ node }) {
        const { src, caption } = node.attrs as { src: string; caption: string };
        const img = ['img', { src, alt: caption || 'Article image' }];
        return caption
            ? ['figure', { 'data-type': 'image' }, img, ['figcaption', {}, caption]]
            : ['figure', { 'data-type': 'image' }, img];
    },

    addNodeView() {
        return ReactNodeViewRenderer(FigureImageView);
    },

    addCommands() {
        return {
            insertFigureImage: attrs => ({ commands }) =>
                commands.insertContent({ type: this.name, attrs: { caption: '', ...attrs } }),
        };
    },
});

// --- YouTube video ---------------------------------------------------------

const YouTubeView = ({ node, deleteNode, selected, editor }: ReactNodeViewProps) => {
    const videoId = node.attrs.videoId as string;
    return (
        <NodeViewWrapper className={frameClass(selected)} data-drag-handle>
            <div className="relative aspect-video rounded-xl overflow-hidden bg-gray-900">
                <img src={youTubeThumbnailUrl(videoId)} alt="YouTube video thumbnail" className="w-full h-full object-cover opacity-80" />
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-white">
                    <PlayCircleIcon className="w-14 h-14 drop-shadow" aria-hidden="true" />
                    <span className="text-sm font-semibold drop-shadow">YouTube video plays here on the article</span>
                </div>
                {editor.isEditable && <RemoveButton onRemove={deleteNode} label="Remove video" />}
            </div>
        </NodeViewWrapper>
    );
};

export const YouTubeBlock = Node.create({
    name: 'youtubeBlock',
    group: 'block',
    atom: true,
    draggable: true,

    addAttributes() {
        return { videoId: { default: null, rendered: false } };
    },

    parseHTML() {
        return [{ tag: 'div[data-youtube]', getAttrs: el => ({ videoId: el.getAttribute('data-youtube') }) }];
    },

    renderHTML({ node }) {
        return ['div', { 'data-youtube': node.attrs.videoId }];
    },

    addNodeView() {
        return ReactNodeViewRenderer(YouTubeView);
    },

    addCommands() {
        return {
            insertYouTube: attrs => ({ commands }) => commands.insertContent({ type: this.name, attrs }),
        };
    },
});

// --- News reference card ---------------------------------------------------

const NewsRefView = ({ node, deleteNode, selected, editor }: ReactNodeViewProps) => {
    const { url, title } = node.attrs as { url: string; title: string | null };
    const ref = parseNewsRefUrl(url);
    return (
        <NodeViewWrapper className={`relative ${frameClass(selected)}`} data-drag-handle>
            {/* The real card, made inert so a click selects it instead of navigating. */}
            <div className="pointer-events-none">
                {ref ? (
                    <NewsReferenceCard url={ref.url} isInternal={ref.isInternal} slug={ref.slug} domain={ref.domain} title={title || undefined} />
                ) : (
                    <p className="p-4 text-sm text-gray-500">Invalid news link: {url}</p>
                )}
            </div>
            {editor.isEditable && <RemoveButton onRemove={deleteNode} label="Remove news card" />}
        </NodeViewWrapper>
    );
};

export const NewsRefBlock = Node.create({
    name: 'newsRefBlock',
    group: 'block',
    atom: true,
    draggable: true,

    addAttributes() {
        return { url: { default: null }, title: { default: null } };
    },

    parseHTML() {
        return [
            {
                tag: 'div[data-news-ref]',
                getAttrs: el => ({ url: el.getAttribute('data-news-ref'), title: el.getAttribute('data-title') }),
            },
        ];
    },

    renderHTML({ node }) {
        const { url, title } = node.attrs as { url: string; title: string | null };
        return ['div', title ? { 'data-news-ref': url, 'data-title': title } : { 'data-news-ref': url }];
    },

    addNodeView() {
        return ReactNodeViewRenderer(NewsRefView);
    },

    addCommands() {
        return {
            insertNewsRef: attrs => ({ commands }) => commands.insertContent({ type: this.name, attrs }),
        };
    },
});
