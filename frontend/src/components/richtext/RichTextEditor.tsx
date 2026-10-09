import { lazy, Suspense } from 'react';
import { Spinner } from '../ui';

// Rich-text field for admin forms. The editor engine is large, so it loads on
// first use; public pages, which only render saved content with RichContent,
// never download it. The editor/ folder is deliberately not re-exported from
// this folder's barrel, for the same code-splitting reason as lazy routes.

const RichTextEditorImpl = lazy(() => import('./editor/RichTextEditorImpl'));

export interface RichTextEditorProps {
    value: string;
    onChange: (html: string) => void;
    /** `article`: headings, tables, alignment, images, video, news cards and
     *  mentions (news, TOTW stories). `basic`: inline formatting, colour, lists
     *  and links (descriptions, bios). */
    variant?: 'article' | 'basic';
    placeholder?: string;
    /** Id of the editable area, for a Field's htmlFor. */
    id?: string;
    invalid?: boolean;
    'aria-label'?: string;
}

export const RichTextEditor = (props: RichTextEditorProps) => (
    <Suspense
        fallback={
            <div className={`rounded-xl border border-gray-300 dark:border-gray-600 flex items-center justify-center ${props.variant === 'basic' ? 'min-h-40' : 'min-h-96'}`}>
                <Spinner label="Loading editor" size="sm" className="py-6" />
            </div>
        }
    >
        <RichTextEditorImpl {...props} />
    </Suspense>
);
