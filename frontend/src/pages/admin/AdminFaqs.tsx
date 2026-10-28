import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
    ArrowDownIcon,
    ArrowTopRightOnSquareIcon,
    ArrowUpIcon,
    EyeIcon,
    EyeSlashIcon,
    PencilSquareIcon,
    PlusIcon,
    QuestionMarkCircleIcon,
    TrashIcon,
} from '@heroicons/react/24/outline';
import {
    createFaqCategory, createFaqItem, createFaqPage, deleteFaqCategory, deleteFaqItem, deleteFaqPage,
    getAdminFaqPage, getAdminFaqPages, reorderFaqs, updateFaqCategory, updateFaqItem, updateFaqPage,
} from '../../services';
import type { FaqCategory, FaqCategoryPayload, FaqItem, FaqItemPayload, FaqPage, UpdateFaqPagePayload } from '../../types';
import {
    Button, ConfirmDialog, ConfirmSummary, DashboardPageHeader, DataTable, FAQ_ICONS, FaqCategoryBrowser,
    FaqCategoryModal, FaqItemModal, FaqList, FaqPageModal, Loader, RowActions, Tabs,
    type Column,
} from '../../components';
import { getApiErrorMessage } from '../../utils';

type ItemModal = { item: FaqItem | null; categoryId: string | null };

type PendingAction =
    | { kind: 'toggleItem'; item: FaqItem }
    | { kind: 'deleteItem'; item: FaqItem }
    | { kind: 'deleteCategory'; category: FaqCategory }
    | { kind: 'deletePage' };

/** A question as a table row, with where it sits so the row menu knows what Up and Down can do. */
interface ItemRow {
    item: FaqItem;
    categoryTitle: string;
    isFirst: boolean;
    isLast: boolean;
}

interface CategoryRow {
    category: FaqCategory;
    isFirst: boolean;
    isLast: boolean;
}

const NO_PAGES: never[] = [];
const NO_ROWS: ItemRow[] = [];
const NO_CATEGORY_ROWS: CategoryRow[] = [];

/** `ids` with the element at `index` moved one place in `direction`, or null if it can't move. */
const movedIds = (ids: string[], index: number, direction: 'up' | 'down'): string[] | null => {
    const target = direction === 'up' ? index - 1 : index + 1;
    if (target < 0 || target >= ids.length) return null;
    const next = [...ids];
    [next[index], next[target]] = [next[target], next[index]];
    return next;
};

const StatusBadge = ({ active }: { active: boolean }) => (
    <span
        className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-bold ${active
            ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
            : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300'}`}
    >
        {active ? 'Showing' : 'Hidden'}
    </span>
);

export const AdminFaqs = () => {
    const queryClient = useQueryClient();
    const [searchParams, setSearchParams] = useSearchParams();

    const { data: pages = NO_PAGES, isLoading: pagesLoading } = useQuery({
        queryKey: ['adminFaqPages'],
        queryFn: getAdminFaqPages,
    });

    const requestedKey = searchParams.get('page');
    const pageKey = pages.find(p => p.key === requestedKey)?.key ?? pages[0]?.key ?? '';

    const { data: page, isLoading: pageLoading } = useQuery({
        queryKey: ['adminFaqPage', pageKey],
        queryFn: () => getAdminFaqPage(pageKey),
        enabled: pageKey !== '',
    });

    const [itemModal, setItemModal] = useState<ItemModal | null>(null);
    const [categoryModal, setCategoryModal] = useState<{ category: FaqCategory | null } | null>(null);
    const [pageModal, setPageModal] = useState<'new' | 'edit' | null>(null);
    const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
    const [previewSlug, setPreviewSlug] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);

    const selectPage = (key: string) => setSearchParams({ page: key }, { replace: true });

    // Runs one write, then refreshes the admin lists and the copy visitors get.
    const run = async (work: () => Promise<unknown>, success: string, failure: string, forKey = pageKey): Promise<boolean> => {
        setBusy(true);
        try {
            await work();
            toast.success(success);
            await Promise.all([
                queryClient.invalidateQueries({ queryKey: ['adminFaqPages'] }),
                queryClient.invalidateQueries({ queryKey: ['adminFaqPage', forKey] }),
                queryClient.invalidateQueries({ queryKey: ['faqPage', forKey] }),
            ]);
            return true;
        } catch (err) {
            toast.error(getApiErrorMessage(err, failure));
            return false;
        } finally {
            setBusy(false);
        }
    };

    const saveItem = async (payload: FaqItemPayload) => {
        const editing = itemModal?.item;
        const ok = await run(
            () => (editing ? updateFaqItem(editing.id, payload) : createFaqItem(pageKey, payload)),
            editing ? 'FAQ updated' : 'FAQ added',
            'Failed to save FAQ',
        );
        if (ok) setItemModal(null);
    };

    const saveCategory = async (payload: FaqCategoryPayload) => {
        const editing = categoryModal?.category;
        const ok = await run(
            () => (editing ? updateFaqCategory(editing.id, payload) : createFaqCategory(pageKey, payload)),
            editing ? 'Category updated' : 'Category added',
            'Failed to save category',
        );
        if (ok) setCategoryModal(null);
    };

    const createPage = async (payload: { key: string; name: string; path: string; description: string }) => {
        const ok = await run(() => createFaqPage(payload), 'Page created', 'Failed to create page', payload.key);
        if (ok) {
            setPageModal(null);
            selectPage(payload.key);
        }
    };

    const savePage = async (payload: UpdateFaqPagePayload) => {
        const ok = await run(() => updateFaqPage(pageKey, payload), 'Page updated', 'Failed to update page');
        if (ok) setPageModal(null);
    };

    const move = (kind: 'category' | 'item', ids: string[] | null) => {
        if (ids) void run(() => reorderFaqs(kind, ids), 'Order updated', 'Failed to reorder');
    };

    const confirmPendingAction = async () => {
        const action = pendingAction;
        if (!action) return;
        switch (action.kind) {
            case 'toggleItem': {
                const { item } = action;
                await run(
                    () => updateFaqItem(item.id, {
                        category_id: item.category_id, question: item.question, answer: item.answer, is_active: !item.is_active,
                    }),
                    item.is_active ? 'FAQ hidden from the site' : 'FAQ is showing on the site',
                    'Failed to update FAQ',
                );
                break;
            }
            case 'deleteItem':
                await run(() => deleteFaqItem(action.item.id), 'FAQ deleted', 'Failed to delete FAQ');
                break;
            case 'deleteCategory':
                await run(() => deleteFaqCategory(action.category.id), 'Category deleted', 'Failed to delete category');
                break;
            case 'deletePage': {
                const deleted = pageKey;
                const ok = await run(() => deleteFaqPage(deleted), 'Page deleted', 'Failed to delete page');
                if (ok) setSearchParams({}, { replace: true });
                break;
            }
        }
        setPendingAction(null);
    };

    const categories = page?.categories;
    const ungrouped = page?.faqs;

    // Questions in the order visitors see them: each category's, then the loose ones.
    const itemRows = useMemo<ItemRow[]>(() => {
        if (!categories || !ungrouped) return NO_ROWS;
        const groups: { title: string; items: FaqItem[] }[] = [
            ...categories.map(c => ({ title: c.title, items: c.faqs })),
            { title: categories.length > 0 ? 'No category' : '', items: ungrouped },
        ];
        return groups.flatMap(g =>
            g.items.map((item, i) => ({ item, categoryTitle: g.title, isFirst: i === 0, isLast: i === g.items.length - 1 })),
        );
    }, [categories, ungrouped]);

    const categoryRows = useMemo<CategoryRow[]>(
        () => categories?.map((category, i) => ({ category, isFirst: i === 0, isLast: i === categories.length - 1 })) ?? NO_CATEGORY_ROWS,
        [categories],
    );

    const itemColumns = useMemo<Column<ItemRow>[]>(() => [
        {
            header: 'Question',
            accessor: 'item.question',
            sortValue: r => r.item.question,
            cell: r => <span className="block min-w-64 max-w-xl whitespace-normal font-bold text-gray-900 dark:text-white">{r.item.question}</span>,
        },
        ...(categories && categories.length > 0
            ? [{ header: 'Category', cell: (r: ItemRow) => <span className="text-gray-600 dark:text-gray-300">{r.categoryTitle}</span> }]
            : []),
        { header: 'Status', cell: r => <StatusBadge active={r.item.is_active} /> },
        {
            header: 'Actions',
            align: 'right',
            cell: r => {
                const group = r.item.category_id ? categories?.find(c => c.id === r.item.category_id)?.faqs : ungrouped;
                const ids = group?.map(i => i.id) ?? [];
                const index = ids.indexOf(r.item.id);
                return (
                    <RowActions
                        label={`Actions for ${r.item.question}`}
                        actions={[
                            { label: 'Edit', icon: PencilSquareIcon, onSelect: () => setItemModal({ item: r.item, categoryId: r.item.category_id }) },
                            { label: 'Move up', icon: ArrowUpIcon, disabled: r.isFirst, hint: r.isFirst ? 'Already first in its group' : undefined, onSelect: () => move('item', movedIds(ids, index, 'up')) },
                            { label: 'Move down', icon: ArrowDownIcon, disabled: r.isLast, hint: r.isLast ? 'Already last in its group' : undefined, onSelect: () => move('item', movedIds(ids, index, 'down')) },
                            r.item.is_active
                                ? { label: 'Hide from site', icon: EyeSlashIcon, onSelect: () => setPendingAction({ kind: 'toggleItem', item: r.item }) }
                                : { label: 'Show on site', icon: EyeIcon, onSelect: () => setPendingAction({ kind: 'toggleItem', item: r.item }) },
                            { label: 'Delete', icon: TrashIcon, danger: true, onSelect: () => setPendingAction({ kind: 'deleteItem', item: r.item }) },
                        ]}
                    />
                );
            },
        },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- move() only closes over stable setters and pageKey
    ], [categories, ungrouped, pageKey]);

    const categoryColumns = useMemo<Column<CategoryRow>[]>(() => [
        {
            header: 'Category',
            cell: r => {
                const Icon = FAQ_ICONS[r.category.icon];
                return (
                    <span className="inline-flex items-center gap-2 font-bold text-gray-900 dark:text-white">
                        {Icon && <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />}
                        {r.category.title}
                    </span>
                );
            },
        },
        { header: 'Questions', align: 'right', cell: r => r.category.faqs.length },
        {
            header: 'Actions',
            align: 'right',
            cell: r => {
                const ids = categories?.map(c => c.id) ?? [];
                const index = ids.indexOf(r.category.id);
                return (
                    <RowActions
                        label={`Actions for ${r.category.title}`}
                        actions={[
                            { label: 'Add FAQ here', icon: PlusIcon, onSelect: () => setItemModal({ item: null, categoryId: r.category.id }) },
                            { label: 'Edit', icon: PencilSquareIcon, onSelect: () => setCategoryModal({ category: r.category }) },
                            { label: 'Move up', icon: ArrowUpIcon, disabled: r.isFirst, hint: r.isFirst ? 'Already first' : undefined, onSelect: () => move('category', movedIds(ids, index, 'up')) },
                            { label: 'Move down', icon: ArrowDownIcon, disabled: r.isLast, hint: r.isLast ? 'Already last' : undefined, onSelect: () => move('category', movedIds(ids, index, 'down')) },
                            { label: 'Delete', icon: TrashIcon, danger: true, onSelect: () => setPendingAction({ kind: 'deleteCategory', category: r.category }) },
                        ]}
                    />
                );
            },
        },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- move() only closes over stable setters and pageKey
    ], [categories, pageKey]);

    // What visitors get: hidden questions out, and categories left empty by that out too.
    const preview = useMemo<FaqPage | null>(() => {
        if (!page) return null;
        const shown = (faqs: FaqItem[]) => faqs.filter(f => f.is_active);
        return {
            ...page,
            categories: page.categories.map(c => ({ ...c, faqs: shown(c.faqs) })).filter(c => c.faqs.length > 0),
            faqs: shown(page.faqs),
        };
    }, [page]);

    const dialog = (() => {
        switch (pendingAction?.kind) {
            case 'toggleItem': {
                const { item } = pendingAction;
                return {
                    title: item.is_active ? 'Hide this FAQ?' : 'Show this FAQ?',
                    description: item.is_active
                        ? 'It stays saved here but visitors no longer see it.'
                        : 'Visitors can see it on the page again.',
                    confirmLabel: item.is_active ? 'Hide FAQ' : 'Show FAQ',
                    tone: 'info' as const,
                    icon: item.is_active ? EyeSlashIcon : EyeIcon,
                    body: <ConfirmSummary rows={[['Page', page?.name], ['Question', item.question]]} />,
                };
            }
            case 'deleteItem':
                return {
                    title: 'Delete this FAQ?',
                    description: "It's removed from the page for good. This can't be undone.",
                    confirmLabel: 'Delete FAQ',
                    tone: 'danger' as const,
                    icon: TrashIcon,
                    body: <ConfirmSummary rows={[['Page', page?.name], ['Question', pendingAction.item.question]]} />,
                };
            case 'deleteCategory': {
                const { category } = pendingAction;
                return {
                    title: 'Delete this category?',
                    description: `Its ${category.faqs.length} ${category.faqs.length === 1 ? 'question is' : 'questions are'} deleted with it. This can't be undone.`,
                    confirmLabel: 'Delete Category',
                    tone: 'danger' as const,
                    icon: TrashIcon,
                    body: <ConfirmSummary rows={[['Page', page?.name], ['Category', category.title], ['Questions deleted', String(category.faqs.length)]]} />,
                };
            }
            case 'deletePage': {
                const total = itemRows.length;
                return {
                    title: 'Delete this page?',
                    description: `Every category and question on it is deleted. If the site still asks for "${pageKey}", it will show no FAQs. This can't be undone.`,
                    confirmLabel: 'Delete Page',
                    tone: 'danger' as const,
                    icon: TrashIcon,
                    body: <ConfirmSummary rows={[['Page', page?.name], ['Key', pageKey], ['Questions deleted', String(total)]]} />,
                };
            }
            default:
                return { title: '', description: undefined, confirmLabel: 'Confirm', tone: 'info' as const, icon: QuestionMarkCircleIcon, body: undefined };
        }
    })();

    const hasCategories = (categories?.length ?? 0) > 0;

    return (
        <div className="space-y-6">
            <DashboardPageHeader
                title="FAQs"
                subtitle="The questions and answers shown on each page of the site. Pick a page, then edit what visitors read there."
                actions={
                    <>
                        <Button variant="secondary" icon={PlusIcon} onClick={() => setPageModal('new')} className="w-full sm:w-auto">
                            New Page
                        </Button>
                        <Button
                            icon={PlusIcon}
                            onClick={() => setItemModal({ item: null, categoryId: null })}
                            disabled={!page}
                            className="w-full sm:w-auto"
                        >
                            Add FAQ
                        </Button>
                    </>
                }
            />

            {pagesLoading ? (
                <Loader />
            ) : pages.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 px-4 py-12 text-center dark:border-gray-700 dark:bg-gray-800/50">
                    <QuestionMarkCircleIcon className="mx-auto mb-4 h-14 w-14 text-gray-300 dark:text-gray-600" aria-hidden="true" />
                    <p className="font-bold text-gray-700 dark:text-gray-300">No FAQ pages yet.</p>
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Click "New Page" to add the first page that shows FAQs.</p>
                </div>
            ) : (
                <>
                    <Tabs
                        aria-label="FAQ pages"
                        items={pages.map(p => ({ value: p.key, label: `${p.name} (${p.item_count})` }))}
                        value={pageKey}
                        onChange={selectPage}
                    />

                    {pageLoading || !page ? (
                        <Loader />
                    ) : (
                        <div className="space-y-8">
                            <section className="flex flex-col gap-4 rounded-xl border border-gray-200 bg-white p-4 sm:flex-row sm:items-start sm:justify-between sm:p-6 dark:border-gray-700 dark:bg-gray-800">
                                <div className="min-w-0 space-y-2">
                                    <h2 className="text-lg font-black text-gray-900 dark:text-white">{page.name}</h2>
                                    {page.description && <p className="text-sm text-gray-600 dark:text-gray-300">{page.description}</p>}
                                    <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
                                        <dt className="text-gray-500 dark:text-gray-400">Appears on</dt>
                                        <dd className="min-w-0 font-bold text-gray-900 dark:text-white">
                                            {page.path ? (
                                                <a
                                                    href={page.path}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    className="inline-flex max-w-full items-center gap-1 text-sffl-red hover:underline"
                                                >
                                                    <span className="truncate">{page.path}</span>
                                                    <ArrowTopRightOnSquareIcon className="h-4 w-4 shrink-0" aria-hidden="true" />
                                                </a>
                                            ) : '—'}
                                        </dd>
                                        <dt className="text-gray-500 dark:text-gray-400">Key</dt>
                                        <dd className="min-w-0 break-all font-mono text-xs font-bold text-gray-900 dark:text-white">{page.key}</dd>
                                    </dl>
                                </div>
                                <div className="flex shrink-0 flex-wrap gap-2">
                                    <Button variant="secondary" icon={PencilSquareIcon} onClick={() => setPageModal('edit')}>Edit Page</Button>
                                    <Button variant="danger" icon={TrashIcon} onClick={() => setPendingAction({ kind: 'deletePage' })}>Delete Page</Button>
                                </div>
                            </section>

                            <section className="space-y-3">
                                <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                                    <div>
                                        <h2 className="text-lg font-black text-gray-900 dark:text-white">Categories</h2>
                                        <p className="text-sm text-gray-500 dark:text-gray-400">
                                            Optional. Add them to group questions under headings, like the FAQ page does. Without any, the page shows one plain list.
                                        </p>
                                    </div>
                                    <Button variant="secondary" icon={PlusIcon} onClick={() => setCategoryModal({ category: null })} className="w-full sm:w-auto">
                                        Add Category
                                    </Button>
                                </div>
                                {hasCategories && (
                                    <DataTable
                                        data={categoryRows}
                                        columns={categoryColumns}
                                        getRowId={r => r.category.id}
                                        searchable={false}
                                        paginated={false}
                                        compact
                                    />
                                )}
                            </section>

                            <section className="space-y-3">
                                <div>
                                    <h2 className="text-lg font-black text-gray-900 dark:text-white">Questions</h2>
                                    <p className="text-sm text-gray-500 dark:text-gray-400">In the order visitors see them. Use the row menu to edit, reorder, hide or delete.</p>
                                </div>
                                <DataTable
                                    data={itemRows}
                                    columns={itemColumns}
                                    getRowId={r => r.item.id}
                                    paginated={false}
                                    searchPlaceholder="Search questions"
                                    emptyMessage="No questions on this page yet. Click Add FAQ to write the first one."
                                />
                            </section>

                            <section className="space-y-3">
                                <div>
                                    <h2 className="text-lg font-black text-gray-900 dark:text-white">Preview</h2>
                                    <p className="text-sm text-gray-500 dark:text-gray-400">How the list looks to visitors. Hidden questions are left out.</p>
                                </div>
                                <div className="rounded-xl border border-gray-200 bg-white p-4 sm:p-6 dark:border-gray-700 dark:bg-gray-900">
                                    {preview && preview.categories.length === 0 && preview.faqs.length === 0 ? (
                                        <p className="text-sm text-gray-500 dark:text-gray-400">Nothing to show yet.</p>
                                    ) : (
                                        preview && (
                                            <div className="space-y-6">
                                                <FaqCategoryBrowser categories={preview.categories} activeSlug={previewSlug} onSelect={setPreviewSlug} />
                                                <FaqList faqs={preview.faqs} />
                                            </div>
                                        )
                                    )}
                                </div>
                            </section>
                        </div>
                    )}
                </>
            )}

            {itemModal && page && (
                <FaqItemModal
                    key={itemModal.item?.id ?? 'new'}
                    item={itemModal.item}
                    categories={page.categories}
                    defaultCategoryId={itemModal.categoryId}
                    pending={busy}
                    onSubmit={saveItem}
                    onClose={() => setItemModal(null)}
                />
            )}
            {categoryModal && (
                <FaqCategoryModal
                    key={categoryModal.category?.id ?? 'new'}
                    category={categoryModal.category}
                    pending={busy}
                    onSubmit={saveCategory}
                    onClose={() => setCategoryModal(null)}
                />
            )}
            {pageModal && (pageModal === 'new' || page) && (
                <FaqPageModal
                    key={pageModal === 'edit' ? pageKey : 'new'}
                    page={pageModal === 'edit' ? page ?? null : null}
                    pending={busy}
                    onCreate={createPage}
                    onUpdate={savePage}
                    onClose={() => setPageModal(null)}
                />
            )}

            <ConfirmDialog
                open={pendingAction !== null}
                title={dialog.title}
                description={dialog.description}
                body={dialog.body}
                confirmLabel={dialog.confirmLabel}
                tone={dialog.tone}
                icon={dialog.icon}
                pending={busy}
                onConfirm={confirmPendingAction}
                onCancel={() => setPendingAction(null)}
            />
        </div>
    );
};
