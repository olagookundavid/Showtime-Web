import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';

// Keeps coloured text readable in dark mode. Text colours are stored as the
// author picked them (a navy or black chosen in light mode is near-invisible on
// the dark background), so each coloured run also gets a class and a CSS
// variable carrying that colour. index.css lifts its lightness in dark mode
// (.rc-color) and picks black or white text over a highlight (.rc-hl). The
// public page does the same in RichContent. Nothing here changes the saved HTML.
export const ColorContrast = Extension.create({
    name: 'colorContrast',

    addProseMirrorPlugins() {
        return [
            new Plugin({
                key: new PluginKey('colorContrast'),
                props: {
                    decorations: state => {
                        const decorations: Decoration[] = [];
                        state.doc.descendants((node, pos) => {
                            if (!node.isText) return;
                            for (const mark of node.marks) {
                                const color = mark.attrs.color as string | null | undefined;
                                if (!color) continue;
                                if (mark.type.name === 'textStyle') {
                                    decorations.push(Decoration.inline(pos, pos + node.nodeSize, { class: 'rc-color', style: `--rc: ${color}` }));
                                } else if (mark.type.name === 'highlight') {
                                    decorations.push(Decoration.inline(pos, pos + node.nodeSize, { class: 'rc-hl', style: `--hl: ${color}` }));
                                }
                            }
                        });
                        return DecorationSet.create(state.doc, decorations);
                    },
                },
            }),
        ];
    },
});
