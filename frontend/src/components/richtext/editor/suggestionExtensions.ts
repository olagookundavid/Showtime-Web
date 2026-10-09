import { Extension, Node, type Editor } from '@tiptap/core';
import { PluginKey } from '@tiptap/pm/state';
import { Suggestion } from '@tiptap/suggestion';
import { UserIcon } from '@heroicons/react/24/outline';
import { getPlayers, getTeams } from '../../../services/api';
import type { Team } from '../../../types';
import { FootballIcon } from '../../icons';
import type { MenuItem } from './SuggestionList';
import { suggestionMenu } from './suggestionMenu';

// --- "@" mentions ----------------------------------------------------------
//
// Typing "@" opens a search over teams and players; picking one inserts a
// mention that links to their page. Stored as
// <a data-mention="team|player" data-id="UUID" href="/teams/UUID">Name</a>.

declare module '@tiptap/core' {
    interface Commands<ReturnType> {
        entityMention: {
            /** Types "@" at the cursor, opening the mention search. */
            startMention: () => ReturnType;
        };
    }
}

let teamsRequest: Promise<Team[]> | null = null;
const allTeams = () => {
    teamsRequest ??= getTeams(1, 100)
        .then(res => res.data || [])
        .catch(() => {
            teamsRequest = null;
            return [];
        });
    return teamsRequest;
};

const searchEntities = async (query: string): Promise<MenuItem[]> => {
    const q = query.trim().toLowerCase();
    const [teams, players] = await Promise.all([
        allTeams(),
        getPlayers(undefined, 1, 6, q || undefined).then(res => res.data || []).catch(() => []),
    ]);
    const teamItems: MenuItem[] = teams
        .filter(t => !q || t.name.toLowerCase().includes(q) || t.short_name?.toLowerCase().includes(q))
        .slice(0, 4)
        .map(t => ({
            key: `team:${t.id}`,
            label: t.name,
            hint: 'Team',
            image: t.logo || undefined,
            icon: FootballIcon,
        }));
    const playerItems: MenuItem[] = players.map(p => ({
        key: `player:${p.id}`,
        label: p.name,
        hint: [`#${p.jersey_number} ${p.position}`, p.team?.name].filter(Boolean).join(' · '),
        icon: UserIcon,
    }));
    return [...teamItems, ...playerItems];
};

export const EntityMention = Node.create({
    name: 'entityMention',
    group: 'inline',
    inline: true,
    atom: true,
    selectable: false,

    addAttributes() {
        return {
            kind: { default: 'player' },
            id: { default: null },
            label: { default: '' },
        };
    },

    parseHTML() {
        return [
            {
                tag: 'a[data-mention]',
                // Beat the Link mark's a[href] rule so a mention stays a mention.
                priority: 60,
                getAttrs: el => ({
                    kind: el.getAttribute('data-mention'),
                    id: el.getAttribute('data-id'),
                    label: el.textContent?.trim() ?? '',
                }),
            },
        ];
    },

    renderHTML({ node }) {
        const { kind, id, label } = node.attrs as { kind: string; id: string; label: string };
        return ['a', { 'data-mention': kind, 'data-id': id, href: `/${kind}s/${id}` }, label];
    },

    renderText({ node }) {
        return node.attrs.label as string;
    },

    addCommands() {
        return {
            startMention: () => ({ commands }) => commands.insertContent(' @'),
        };
    },

    addProseMirrorPlugins() {
        return [
            Suggestion<MenuItem, MenuItem>({
                editor: this.editor,
                pluginKey: new PluginKey('entityMention'),
                char: '@',
                debounce: 200,
                floatingUi: { strategy: 'fixed' },
                items: ({ query }) => searchEntities(query),
                command: ({ editor, range, props }) => {
                    const [kind, id] = props.key.split(':');
                    editor
                        .chain()
                        .focus()
                        .insertContentAt(range, [
                            { type: this.name, attrs: { kind, id, label: props.label } },
                            { type: 'text', text: ' ' },
                        ])
                        .run();
                },
                render: suggestionMenu<MenuItem>('Tag a team or player', 'No team or player matches'),
            }),
        ];
    },
});

// --- "/" insert menu -------------------------------------------------------
//
// Typing "/" at the start of a line or after a space lists everything that can
// be inserted (headings, lists, table, image, video…). The editor supplies the
// actions, since some of them open its own panels.

export interface SlashAction extends MenuItem {
    run: (editor: Editor) => void;
}

export const SlashCommands = Extension.create<{ getActions: () => SlashAction[] }>({
    name: 'slashCommands',

    addOptions() {
        return { getActions: () => [] };
    },

    addProseMirrorPlugins() {
        return [
            Suggestion<SlashAction, SlashAction>({
                editor: this.editor,
                pluginKey: new PluginKey('slashCommands'),
                char: '/',
                floatingUi: { strategy: 'fixed' },
                items: ({ query }) => {
                    const q = query.toLowerCase();
                    return this.options.getActions().filter(a => a.label.toLowerCase().includes(q));
                },
                command: ({ editor, range, props }) => {
                    editor.chain().focus().deleteRange(range).run();
                    props.run(editor);
                },
                render: suggestionMenu<SlashAction>('Insert', 'Nothing to insert by that name'),
            }),
        ];
    },
});
