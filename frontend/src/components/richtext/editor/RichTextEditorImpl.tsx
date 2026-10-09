import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import toast from 'react-hot-toast';
import { EditorContent, useEditor, useEditorState } from '@tiptap/react';
import { BubbleMenu } from '@tiptap/react/menus';
import type { Editor, Extensions } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { TextStyle, Color } from '@tiptap/extension-text-style';
import Highlight from '@tiptap/extension-highlight';
import TextAlign from '@tiptap/extension-text-align';
import Subscript from '@tiptap/extension-subscript';
import Superscript from '@tiptap/extension-superscript';
import { TableKit } from '@tiptap/extension-table';
import { CharacterCount, Placeholder } from '@tiptap/extensions';
import {
    ArrowsPointingInIcon,
    ArrowsPointingOutIcon,
    BoldIcon,
    ItalicIcon,
    LinkIcon,
    ListBulletIcon,
    MinusIcon,
    NewspaperIcon,
    NumberedListIcon,
    PhotoIcon,
    PlayCircleIcon,
    StrikethroughIcon,
    TableCellsIcon,
    UnderlineIcon,
    H2Icon,
    H3Icon,
} from '@heroicons/react/24/outline';
import { Button, IconButton, Modal } from '../../ui';
import { QuoteIcon, TextColorIcon } from '../../icons';
import { useImageUpload } from '../../../hooks';
import { toEditorHtml } from '../../../utils';
import type { RichTextEditorProps } from '../RichTextEditor';
import { FigureImage, NewsRefBlock, YouTubeBlock } from './embedNodes';
import { EntityMention, SlashCommands, type SlashAction } from './suggestionExtensions';
import { EditorToolbar } from './EditorToolbar';
import { ColorContrast } from './colorContrast';
import { stripForeignColors } from './pasteCleanup';
import { ColorPanel, LinkPanel, NewsPanel, YouTubePanel, type Panel } from './EditorPanels';

// The rich-text editor (TipTap). Loaded on demand by RichTextEditor so public
// pages never download it. `article` is the full editor for news and TOTW
// stories; `basic` is inline formatting, lists and links for short fields.
// Output is HTML in the shape backend/internal/richtext allows.

const MAX_IMAGE_MB = 10;

const buildExtensions = (isArticle: boolean, placeholder: string, getSlashActions: () => SlashAction[]): Extensions => {
    const shared: Extensions = [
        TextStyle,
        Color,
        Highlight.configure({ multicolor: true }),
        Placeholder.configure({ placeholder }),
        CharacterCount,
        ColorContrast,
    ];
    if (!isArticle) {
        return [
            StarterKit.configure({
                heading: false,
                blockquote: false,
                codeBlock: false,
                code: false,
                horizontalRule: false,
                link: { openOnClick: false, autolink: true, defaultProtocol: 'https' },
            }),
            ...shared,
        ];
    }
    return [
        StarterKit.configure({
            heading: { levels: [2, 3, 4] },
            link: { openOnClick: false, autolink: true, defaultProtocol: 'https' },
        }),
        ...shared,
        TextAlign.configure({ types: ['heading', 'paragraph'] }),
        Subscript,
        Superscript,
        TableKit.configure({ table: { resizable: true } }),
        FigureImage,
        YouTubeBlock,
        NewsRefBlock,
        EntityMention,
        SlashCommands.configure({ getActions: getSlashActions }),
    ];
};

const isImageFile = (f: File) => f.type.startsWith('image/') || /\.(heic|heif)$/i.test(f.name);

export default function RichTextEditorImpl({
    value,
    onChange,
    variant = 'article',
    placeholder,
    id,
    invalid = false,
    'aria-label': ariaLabel,
}: RichTextEditorProps) {
    const isArticle = variant === 'article';
    const [panel, setPanel] = useState<Panel | null>(null);
    // Full-screen mode moves the same editor into a large dialog.
    const [expanded, setExpanded] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const { uploadImage, isUploading, progress } = useImageUpload();
    // The last HTML this editor reported, so a parent re-render with that same
    // value isn't mistaken for a new document (which would reset the cursor).
    const lastEmitted = useRef(value);
    const editorRef = useRef<Editor | null>(null);

    const insertImageFiles = async (files: File[]) => {
        for (const file of files) {
            if (file.size > MAX_IMAGE_MB * 1024 * 1024) {
                toast.error(`${file.name} is over the ${MAX_IMAGE_MB}MB limit`);
                continue;
            }
            const url = await uploadImage(file, 'news', { maxSizeMB: 1.5, maxWidthOrHeight: 1920 });
            if (url) editorRef.current?.chain().focus().insertFigureImage({ src: url }).run();
            else toast.error('Failed to upload image');
        }
    };

    const [slashActions] = useState<SlashAction[]>(() => [
        { key: 'h2', label: 'Large heading', icon: H2Icon, run: e => e.chain().focus().setHeading({ level: 2 }).run() },
        { key: 'h3', label: 'Medium heading', icon: H3Icon, run: e => e.chain().focus().setHeading({ level: 3 }).run() },
        { key: 'bullet', label: 'Bulleted list', icon: ListBulletIcon, run: e => e.chain().focus().toggleBulletList().run() },
        { key: 'ordered', label: 'Numbered list', icon: NumberedListIcon, run: e => e.chain().focus().toggleOrderedList().run() },
        { key: 'quote', label: 'Quote', icon: QuoteIcon, run: e => e.chain().focus().toggleBlockquote().run() },
        { key: 'table', label: 'Table', hint: '3 × 3 with a header row', icon: TableCellsIcon, run: e => e.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run() },
        { key: 'image', label: 'Image', hint: 'Upload a photo', icon: PhotoIcon, run: () => fileInputRef.current?.click() },
        { key: 'youtube', label: 'YouTube video', icon: PlayCircleIcon, run: () => setPanel('youtube') },
        { key: 'news', label: 'News card', hint: 'Link to another article', icon: NewspaperIcon, run: () => setPanel('news') },
        { key: 'hr', label: 'Divider line', icon: MinusIcon, run: e => e.chain().focus().setHorizontalRule().run() },
    ]);

    const [extensions] = useState(() =>
        buildExtensions(
            isArticle,
            placeholder ?? (isArticle ? 'Write your article… Type / to insert a heading, table, image or video, and @ to tag a team or player.' : 'Write here…'),
            () => slashActions,
        ),
    );

    const editor = useEditor({
        extensions,
        content: toEditorHtml(value),
        shouldRerenderOnTransaction: false,
        editorProps: {
            attributes: {
                ...(id ? { id } : {}),
                'aria-label': ariaLabel ?? (isArticle ? 'Article body' : 'Text'),
                'aria-multiline': 'true',
                role: 'textbox',
                class: `rich-editor prose prose-gray dark:prose-invert max-w-none wrap-break-word px-4 py-3 focus:outline-none ${isArticle ? 'sm:prose-lg' : 'prose-sm sm:prose-base prose-p:my-2'}`,
            },
            transformPastedHTML: stripForeignColors,
            handlePaste: (_view, event) => {
                const files = Array.from(event.clipboardData?.files ?? []).filter(isImageFile);
                if (!isArticle || !files.length) return false;
                void insertImageFiles(files);
                return true;
            },
            handleDrop: (_view, event, _slice, moved) => {
                const files = Array.from(event.dataTransfer?.files ?? []).filter(isImageFile);
                if (moved || !isArticle || !files.length) return false;
                event.preventDefault();
                void insertImageFiles(files);
                return true;
            },
        },
        onCreate: ({ editor: e }) => { editorRef.current = e; },
        onUpdate: ({ editor: e }) => {
            const html = e.isEmpty ? '' : e.getHTML();
            lastEmitted.current = html;
            onChange(html);
        },
    });

    // A new value from outside (the form switched to another record) replaces
    // the document; the editor's own echoes are ignored.
    useEffect(() => {
        if (!editor || value === lastEmitted.current) return;
        lastEmitted.current = value;
        editor.commands.setContent(toEditorHtml(value), { emitUpdate: false });
    }, [editor, value]);

    const counts = useEditorState({
        editor,
        selector: ({ editor: e }) => ({
            words: e?.storage.characterCount?.words() ?? 0,
            characters: e?.storage.characterCount?.characters() ?? 0,
        }),
    });

    const togglePanel = (next: Panel) => setPanel(current => (current === next ? null : next));
    const closePanel = () => setPanel(null);

    const pickImage = async (e: ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files ?? []);
        e.target.value = '';
        if (files.length) await insertImageFiles(files);
    };

    // Back at the cursor after the editor moves between the form and the dialog.
    useEffect(() => {
        if (!editor) return;
        const frame = requestAnimationFrame(() => editor.commands.focus());
        return () => cancelAnimationFrame(frame);
    }, [editor, expanded]);

    if (!editor) return null;

    const surface = (isExpanded: boolean) => (
        <div
            className={`rounded-xl border bg-white dark:bg-gray-800 transition-colors focus-within:ring-2 focus-within:ring-sffl-red focus-within:border-transparent ${invalid ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'} ${
                isExpanded
                    ? '[&_.ProseMirror]:min-h-[60dvh] [&_.ProseMirror]:max-w-4xl [&_.ProseMirror]:mx-auto [&_.ProseMirror]:py-6'
                    : isArticle ? '[&_.ProseMirror]:min-h-72' : '[&_.ProseMirror]:min-h-28'
            }`}
        >
            <EditorToolbar
                editor={editor}
                isArticle={isArticle}
                panel={panel}
                togglePanel={togglePanel}
                onPickImage={() => { closePanel(); fileInputRef.current?.click(); }}
                uploadLabel={isUploading ? `Uploading ${progress}%` : null}
                expanded={isExpanded}
                onToggleExpand={() => setExpanded(!isExpanded)}
            />

            {panel === 'link' && <LinkPanel editor={editor} onClose={closePanel} />}
            {(panel === 'color' || panel === 'highlight') && <ColorPanel key={panel} editor={editor} onClose={closePanel} mode={panel} />}
            {panel === 'youtube' && <YouTubePanel editor={editor} onClose={closePanel} />}
            {panel === 'news' && <NewsPanel editor={editor} onClose={closePanel} />}
            {isUploading && (
                <p className="px-4 py-2 text-sm text-gray-600 dark:text-gray-300 border-b border-gray-200 dark:border-gray-600" role="status">
                    Uploading image… {progress}%
                </p>
            )}

            <BubbleMenu
                editor={editor}
                options={{ placement: 'top' }}
                shouldShow={({ editor: e, state }) =>
                    e.isEditable && !state.selection.empty && !e.isActive('figureImage') && !e.isActive('youtubeBlock') && !e.isActive('newsRefBlock')}
                className="flex items-center gap-0.5 p-1 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-xl"
            >
                <IconButton icon={BoldIcon} label="Bold" onMouseDown={e => e.preventDefault()} onClick={() => editor.chain().focus().toggleBold().run()} />
                <IconButton icon={ItalicIcon} label="Italic" onMouseDown={e => e.preventDefault()} onClick={() => editor.chain().focus().toggleItalic().run()} />
                <IconButton icon={UnderlineIcon} label="Underline" onMouseDown={e => e.preventDefault()} onClick={() => editor.chain().focus().toggleUnderline().run()} />
                <IconButton icon={StrikethroughIcon} label="Strikethrough" onMouseDown={e => e.preventDefault()} onClick={() => editor.chain().focus().toggleStrike().run()} />
                <IconButton icon={TextColorIcon} label="Text colour" onMouseDown={e => e.preventDefault()} onClick={() => setPanel('color')} />
                <IconButton icon={LinkIcon} label="Link" onMouseDown={e => e.preventDefault()} onClick={() => setPanel('link')} />
            </BubbleMenu>

            <EditorContent editor={editor} />
        </div>
    );

    return (
        <div className="space-y-1.5">
            <input type="file" ref={fileInputRef} onChange={pickImage} accept="image/*,.heic,.heif" multiple className="hidden" />

            {expanded ? (
                <div className="rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-600 p-6 flex flex-col sm:flex-row items-center justify-between gap-3">
                    <p className="text-sm text-gray-600 dark:text-gray-300">This text is open in full screen.</p>
                    <Button variant="secondary" size="sm" icon={ArrowsPointingInIcon} onClick={() => setExpanded(false)}>
                        Back to form
                    </Button>
                </div>
            ) : (
                surface(false)
            )}

            <Modal
                open={expanded}
                onClose={() => setExpanded(false)}
                title={isArticle ? 'Article editor' : 'Text editor'}
                subtitle="Full screen"
                maxWidth="full"
                footer={<Button onClick={() => setExpanded(false)}>Done</Button>}
            >
                {surface(true)}
            </Modal>

            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-xs text-gray-500 dark:text-gray-400">
                <span>
                    {isArticle
                        ? 'Type / to insert anything, @ to tag a team or player. Paste or drop photos straight in.'
                        : 'Select text to format it. Ctrl+B bold, Ctrl+I italic.'}
                </span>
                <span className="inline-flex items-center gap-3">
                    <span>
                        {counts.words} {counts.words === 1 ? 'word' : 'words'}
                        {isArticle ? ` · ${Math.max(1, Math.ceil(counts.words / 200))} min read` : ` · ${counts.characters} characters`}
                    </span>
                    {!expanded && (
                        <Button variant="secondary" size="sm" icon={ArrowsPointingOutIcon} onClick={() => setExpanded(true)}>
                            Full screen
                        </Button>
                    )}
                </span>
            </div>
        </div>
    );
}
