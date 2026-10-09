import type { Editor } from '@tiptap/core';
import { useEditorState } from '@tiptap/react';
import {
    ArrowsPointingInIcon,
    ArrowsPointingOutIcon,
    ArrowUturnLeftIcon,
    ArrowUturnRightIcon,
    AtSymbolIcon,
    Bars3BottomLeftIcon,
    Bars3BottomRightIcon,
    Bars3Icon,
    BoldIcon,
    ItalicIcon,
    LinkIcon,
    ListBulletIcon,
    MinusIcon,
    NewspaperIcon,
    NumberedListIcon,
    PhotoIcon,
    PlayCircleIcon,
    PlusIcon,
    StrikethroughIcon,
    TableCellsIcon,
    TrashIcon,
    UnderlineIcon,
} from '@heroicons/react/24/outline';
import { Button, IconButton, Select, type HeroIcon } from '../../ui';
import {
    AlignCenterIcon,
    ClearFormattingIcon,
    HighlighterIcon,
    QuoteIcon,
    SubscriptIcon,
    SuperscriptIcon,
    TextColorIcon,
} from '../../icons';
import type { Panel } from './EditorPanels';

interface EditorToolbarProps {
    editor: Editor;
    isArticle: boolean;
    panel: Panel | null;
    togglePanel: (panel: Panel) => void;
    onPickImage: () => void;
    uploadLabel: string | null;
}

type BlockType = 'p' | 'h2' | 'h3' | 'h4';
type Align = 'left' | 'center' | 'right' | 'justify';

const ALIGNMENTS: { value: Align; label: string; icon: HeroIcon }[] = [
    { value: 'left', label: 'Align left', icon: Bars3BottomLeftIcon },
    { value: 'center', label: 'Align centre', icon: AlignCenterIcon },
    { value: 'right', label: 'Align right', icon: Bars3BottomRightIcon },
    { value: 'justify', label: 'Justify', icon: Bars3Icon },
];

/** A toggle in the toolbar: filled when the formatting is on at the cursor. */
const Tool = ({ icon, label, active = false, disabled = false, onClick }: {
    icon: HeroIcon;
    label: string;
    active?: boolean;
    disabled?: boolean;
    onClick: () => void;
}) => (
    <IconButton
        icon={icon}
        label={label}
        variant={active ? 'secondary' : 'ghost'}
        aria-pressed={active}
        disabled={disabled}
        // Keep the text selection while clicking a tool.
        onMouseDown={e => e.preventDefault()}
        onClick={onClick}
    />
);

const Divider = () => <span className="mx-1 h-6 w-px shrink-0 bg-gray-200 dark:bg-gray-600" aria-hidden="true" />;

export const EditorToolbar = ({ editor, isArticle, panel, togglePanel, onPickImage, uploadLabel }: EditorToolbarProps) => {
    const s = useEditorState({
        editor,
        selector: ({ editor: e }) => ({
            bold: e.isActive('bold'),
            italic: e.isActive('italic'),
            underline: e.isActive('underline'),
            strike: e.isActive('strike'),
            subscript: e.isActive('subscript'),
            superscript: e.isActive('superscript'),
            bulletList: e.isActive('bulletList'),
            orderedList: e.isActive('orderedList'),
            blockquote: e.isActive('blockquote'),
            link: e.isActive('link'),
            color: !!e.getAttributes('textStyle').color,
            highlight: e.isActive('highlight'),
            inTable: e.isActive('table'),
            block: (e.isActive('heading', { level: 2 }) ? 'h2'
                : e.isActive('heading', { level: 3 }) ? 'h3'
                    : e.isActive('heading', { level: 4 }) ? 'h4' : 'p') as BlockType,
            align: (ALIGNMENTS.find(a => e.isActive({ textAlign: a.value }))?.value ?? 'left') as Align,
            canUndo: e.can().undo(),
            canRedo: e.can().redo(),
            // Table commands exist only in the article editor.
            canMerge: isArticle && e.can().mergeCells(),
            canSplit: isArticle && e.can().splitCell(),
        }),
    });

    const run = () => editor.chain().focus();

    const setBlock = (block: BlockType) => {
        if (block === 'p') run().setParagraph().run();
        else run().setHeading({ level: Number(block[1]) as 2 | 3 | 4 }).run();
    };

    return (
        <div className="sticky top-0 z-10 border-b border-gray-200 dark:border-gray-600 bg-white/95 dark:bg-gray-800/95 backdrop-blur rounded-t-xl">
            {/* One scrolling row on phones, wrapping rows from 640px. */}
            <div role="toolbar" aria-label="Text formatting" className="flex items-center gap-0.5 p-1 overflow-x-auto sm:flex-wrap">
                <Tool icon={ArrowUturnLeftIcon} label="Undo" disabled={!s.canUndo} onClick={() => run().undo().run()} />
                <Tool icon={ArrowUturnRightIcon} label="Redo" disabled={!s.canRedo} onClick={() => run().redo().run()} />
                <Divider />

                {isArticle && (
                    <>
                        <Select
                            aria-label="Text style"
                            value={s.block}
                            onChange={e => setBlock(e.target.value as BlockType)}
                            className="w-40 shrink-0"
                        >
                            <option value="p">Normal text</option>
                            <option value="h2">Large heading</option>
                            <option value="h3">Medium heading</option>
                            <option value="h4">Small heading</option>
                        </Select>
                        <Divider />
                    </>
                )}

                <Tool icon={BoldIcon} label="Bold (Ctrl+B)" active={s.bold} onClick={() => run().toggleBold().run()} />
                <Tool icon={ItalicIcon} label="Italic (Ctrl+I)" active={s.italic} onClick={() => run().toggleItalic().run()} />
                <Tool icon={UnderlineIcon} label="Underline (Ctrl+U)" active={s.underline} onClick={() => run().toggleUnderline().run()} />
                <Tool icon={StrikethroughIcon} label="Strikethrough" active={s.strike} onClick={() => run().toggleStrike().run()} />
                {isArticle && (
                    <>
                        <Tool icon={SubscriptIcon} label="Subscript" active={s.subscript} onClick={() => run().toggleSubscript().run()} />
                        <Tool icon={SuperscriptIcon} label="Superscript" active={s.superscript} onClick={() => run().toggleSuperscript().run()} />
                    </>
                )}
                <Tool icon={TextColorIcon} label="Text colour" active={s.color || panel === 'color'} onClick={() => togglePanel('color')} />
                <Tool icon={HighlighterIcon} label="Highlight" active={s.highlight || panel === 'highlight'} onClick={() => togglePanel('highlight')} />
                <Tool icon={ClearFormattingIcon} label="Clear formatting" onClick={() => run().unsetAllMarks().run()} />
                <Divider />

                <Tool icon={ListBulletIcon} label="Bulleted list" active={s.bulletList} onClick={() => run().toggleBulletList().run()} />
                <Tool icon={NumberedListIcon} label="Numbered list" active={s.orderedList} onClick={() => run().toggleOrderedList().run()} />
                {isArticle && (
                    <>
                        <Tool icon={QuoteIcon} label="Quote" active={s.blockquote} onClick={() => run().toggleBlockquote().run()} />
                        <Tool icon={MinusIcon} label="Divider line" onClick={() => run().setHorizontalRule().run()} />
                        <Divider />
                        {ALIGNMENTS.map(a => (
                            <Tool
                                key={a.value}
                                icon={a.icon}
                                label={a.label}
                                active={s.align === a.value && a.value !== 'left'}
                                onClick={() => run().setTextAlign(a.value).run()}
                            />
                        ))}
                    </>
                )}
                <Divider />

                <Tool icon={LinkIcon} label="Link" active={s.link || panel === 'link'} onClick={() => togglePanel('link')} />
                {isArticle && (
                    <>
                        <Tool
                            icon={TableCellsIcon}
                            label="Insert table"
                            active={s.inTable}
                            onClick={() => run().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
                        />
                        <Tool icon={PhotoIcon} label={uploadLabel ?? 'Insert image'} disabled={!!uploadLabel} onClick={onPickImage} />
                        <Tool icon={PlayCircleIcon} label="Insert YouTube video" active={panel === 'youtube'} onClick={() => togglePanel('youtube')} />
                        <Tool icon={NewspaperIcon} label="Insert news card" active={panel === 'news'} onClick={() => togglePanel('news')} />
                        <Tool icon={AtSymbolIcon} label="Tag a team or player" onClick={() => run().startMention().run()} />
                    </>
                )}
            </div>

            {isArticle && s.inTable && (
                <div role="toolbar" aria-label="Table" className="flex items-center gap-1 px-2 pb-2 overflow-x-auto sm:flex-wrap">
                    <span className="text-xs font-bold text-gray-500 dark:text-gray-400 shrink-0 mr-1">Table:</span>
                    <Button size="sm" variant="ghost" icon={PlusIcon} className="shrink-0" onClick={() => run().addRowBefore().run()}>Row above</Button>
                    <Button size="sm" variant="ghost" icon={PlusIcon} className="shrink-0" onClick={() => run().addRowAfter().run()}>Row below</Button>
                    <Button size="sm" variant="ghost" icon={PlusIcon} className="shrink-0" onClick={() => run().addColumnBefore().run()}>Column left</Button>
                    <Button size="sm" variant="ghost" icon={PlusIcon} className="shrink-0" onClick={() => run().addColumnAfter().run()}>Column right</Button>
                    <Button size="sm" variant="ghost" icon={TableCellsIcon} className="shrink-0" onClick={() => run().toggleHeaderRow().run()}>Header row</Button>
                    <Button size="sm" variant="ghost" icon={ArrowsPointingInIcon} className="shrink-0" disabled={!s.canMerge} onClick={() => run().mergeCells().run()}>Merge cells</Button>
                    <Button size="sm" variant="ghost" icon={ArrowsPointingOutIcon} className="shrink-0" disabled={!s.canSplit} onClick={() => run().splitCell().run()}>Split cell</Button>
                    <Button size="sm" variant="ghost" icon={TrashIcon} className="shrink-0" onClick={() => run().deleteRow().run()}>Delete row</Button>
                    <Button size="sm" variant="ghost" icon={TrashIcon} className="shrink-0" onClick={() => run().deleteColumn().run()}>Delete column</Button>
                    <Button size="sm" variant="danger" icon={TrashIcon} className="shrink-0" onClick={() => run().deleteTable().run()}>Delete table</Button>
                </div>
            )}
        </div>
    );
};
