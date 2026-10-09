import { ReactRenderer } from '@tiptap/react';
import type { SuggestionOptions, SuggestionProps } from '@tiptap/suggestion';
import { SuggestionList, type MenuItem, type SuggestionListHandle, type SuggestionListProps } from './SuggestionList';

/** Builds the `render` option of a Suggestion plugin around SuggestionList. */
export const suggestionMenu = <I extends MenuItem>(heading: string, emptyLabel: string): SuggestionOptions<I, I>['render'] => () => {
    let renderer: ReactRenderer<SuggestionListHandle, SuggestionListProps> | null = null;
    let unmount: (() => void) | null = null;

    const listProps = (props: SuggestionProps<I, I>): SuggestionListProps => ({
        items: props.items,
        // The list only hands back items it was given, so they are all I.
        command: props.command as (item: MenuItem) => void,
        loading: props.loading,
        emptyLabel,
        heading,
    });

    return {
        onStart: props => {
            renderer = new ReactRenderer(SuggestionList, { props: listProps(props), editor: props.editor });
            const element = renderer.element as HTMLElement;
            // Above Modal (z-100), since editors also live inside dialogs.
            element.style.zIndex = '110';
            unmount = props.mount(element);
        },
        onUpdate: props => renderer?.updateProps(listProps(props)),
        onKeyDown: ({ event }) => renderer?.ref?.onKeyDown(event) ?? false,
        onExit: () => {
            unmount?.();
            renderer?.destroy();
            renderer = null;
            unmount = null;
        },
    };
};
