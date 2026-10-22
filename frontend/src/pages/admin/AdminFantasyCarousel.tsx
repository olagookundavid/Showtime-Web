import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
    ArrowDownIcon,
    ArrowTopRightOnSquareIcon,
    ArrowUpIcon,
    EyeIcon,
    EyeSlashIcon,
    FilmIcon,
    MagnifyingGlassIcon,
    PaperAirplaneIcon,
    PlusIcon,
    TrashIcon,
} from '@heroicons/react/24/outline';
import {
    addFantasyCarouselSlide,
    getAdminFantasyCarousel,
    getNews,
    quickAddFantasyArticle,
    removeFantasyCarouselSlide,
    updateFantasyCarouselSlide,
} from '../../services/api';
import type { FantasyCarouselArticle, FantasyCarouselSlide, News } from '../../types';
import {
    Button,
    ConfirmDialog,
    ConfirmSummary,
    DashboardPageHeader,
    Field,
    ImageUploadField,
    Input,
    Loader,
    Modal,
    RichTextEditor,
    Select,
    Textarea,
} from '../../components';
import { getApiErrorMessage, isRichTextEmpty, parseYouTubeId, youTubeThumbnailUrl } from '../../utils';
import { FANTASY_CAROUSEL_MAX, FANTASY_NEWS_CATEGORIES } from '../../constants';

const NO_SLIDES: FantasyCarouselSlide[] = [];
const NO_RESULTS: News[] = [];

interface QuickAddForm {
    title: string;
    category: string;
    author: string;
    excerpt: string;
    content: string;
    featured_image: string;
}

const emptyQuickAdd: QuickAddForm = {
    title: '', category: FANTASY_NEWS_CATEGORIES[0], author: '', excerpt: '', content: '', featured_image: '',
};

type PendingAction =
    | { kind: 'quickAdd' }
    | { kind: 'add'; article: News }
    | { kind: 'toggle'; slide: FantasyCarouselSlide; position: number }
    | { kind: 'move'; slide: FantasyCarouselSlide; position: number; direction: 'up' | 'down' }
    | { kind: 'remove'; slide: FantasyCarouselSlide; position: number };

const FAILURE: Record<PendingAction['kind'], string> = {
    quickAdd: 'Could not publish the article',
    add: 'Could not add the article to the carousel',
    toggle: 'Could not update the slide',
    move: 'Could not reorder the slides',
    remove: 'Could not remove the slide',
};

/** The picture a slide shows: the video's thumbnail, else the featured image. */
const articleImage = (a: Pick<FantasyCarouselArticle, 'featured_media_type' | 'featured_youtube_url' | 'featured_image'>) => {
    if (a.featured_media_type === 'youtube') {
        const id = parseYouTubeId(a.featured_youtube_url);
        if (id) return youTubeThumbnailUrl(id);
    }
    return a.featured_image || '';
};

const shortDate = (iso: string) => {
    const d = new Date(iso);
    return Number.isNaN(d.getTime())
        ? ''
        : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
};

/**
 * The carousel at the top of the Fantasy page, managed like the homepage Hero
 * Slides: each slide is a published news article, in an order you set, up to
 * ten. Add an article that already exists, or write one with quick add below,
 * which publishes it to the news site and features it in one step.
 */
export const AdminFantasyCarousel = () => {
    const queryClient = useQueryClient();
    const { data: slides = NO_SLIDES, isLoading } = useQuery({
        queryKey: ['adminFantasyCarousel'],
        queryFn: getAdminFantasyCarousel,
    });
    const sortedSlides = [...slides].sort((a, b) => a.display_order - b.display_order);
    const isFull = sortedSlides.length >= FANTASY_CAROUSEL_MAX;
    const onCarousel = new Set(sortedSlides.map((s) => s.article.id));

    const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
    const [busy, setBusy] = useState(false);

    // Add an existing article
    const [showPicker, setShowPicker] = useState(false);
    const [searchInput, setSearchInput] = useState('');
    const [search, setSearch] = useState('');
    const { data: results, isFetching: searching } = useQuery({
        queryKey: ['fantasyCarouselPicker', search],
        queryFn: () => getNews(1, 10, search || undefined),
        enabled: showPicker,
    });
    const pickerArticles = results?.data ?? NO_RESULTS;

    // Quick add. The key remounts the image field after a successful publish,
    // in the same step that clears `busy`, so the field unmounts while still
    // committed and never deletes the image the new article now uses.
    const [quick, setQuick] = useState<QuickAddForm>(emptyQuickAdd);
    const [quickKey, setQuickKey] = useState(0);
    const setQ = <K extends keyof QuickAddForm>(field: K, value: QuickAddForm[K]) =>
        setQuick((p) => ({ ...p, [field]: value }));

    const refresh = () => {
        queryClient.invalidateQueries({ queryKey: ['adminFantasyCarousel'] });
        queryClient.invalidateQueries({ queryKey: ['fantasyCarousel'] });
    };

    const requestQuickAdd = () => {
        if (!quick.title.trim()) { toast.error('Give the article a title'); return; }
        if (isRichTextEmpty(quick.content)) { toast.error('Write the article before publishing it'); return; }
        setPendingAction({ kind: 'quickAdd' });
    };

    const requestMove = (slide: FantasyCarouselSlide, direction: 'up' | 'down') => {
        const index = sortedSlides.findIndex((s) => s.id === slide.id);
        const swapIndex = direction === 'up' ? index - 1 : index + 1;
        if (swapIndex < 0 || swapIndex >= sortedSlides.length) return;
        setPendingAction({ kind: 'move', slide, position: index + 1, direction });
    };

    const confirmPendingAction = async () => {
        const action = pendingAction;
        if (!action) return;
        setBusy(true);
        try {
            switch (action.kind) {
                case 'quickAdd':
                    await quickAddFantasyArticle({
                        title: quick.title.trim(),
                        category: quick.category,
                        author: quick.author.trim(),
                        excerpt: quick.excerpt.trim(),
                        content: quick.content,
                        featured_image: quick.featured_image,
                        featured_media_type: 'image',
                    });
                    setQuick(emptyQuickAdd);
                    setQuickKey((k) => k + 1);
                    queryClient.invalidateQueries({ queryKey: ['adminNews'] });
                    toast.success('Published and added to the Fantasy carousel');
                    break;
                case 'add':
                    await addFantasyCarouselSlide(action.article.id);
                    setShowPicker(false);
                    toast.success('Added to the Fantasy carousel');
                    break;
                case 'toggle':
                    await updateFantasyCarouselSlide(action.slide.id, { is_active: !action.slide.is_active });
                    toast.success(action.slide.is_active ? 'Slide hidden from the Fantasy page' : 'Slide is showing on the Fantasy page');
                    break;
                case 'move': {
                    const index = sortedSlides.findIndex((s) => s.id === action.slide.id);
                    const swapIndex = action.direction === 'up' ? index - 1 : index + 1;
                    if (swapIndex < 0 || swapIndex >= sortedSlides.length) break;
                    const reordered = [...sortedSlides];
                    [reordered[index], reordered[swapIndex]] = [reordered[swapIndex], reordered[index]];
                    // Renumber every slide to its position, as Hero Slides does,
                    // so a duplicated order can never turn a move into a no-op.
                    await Promise.all(
                        reordered.map((s, i) =>
                            s.display_order === i ? null : updateFantasyCarouselSlide(s.id, { display_order: i }),
                        ),
                    );
                    toast.success('Slide order updated');
                    break;
                }
                case 'remove':
                    await removeFantasyCarouselSlide(action.slide.id);
                    toast.success('Removed from the carousel. The article is still on the news site.');
                    break;
            }
            refresh();
        } catch (err) {
            toast.error(getApiErrorMessage(err, FAILURE[action.kind]));
        } finally {
            setBusy(false);
            setPendingAction(null);
        }
    };

    const dialog = (() => {
        switch (pendingAction?.kind) {
            case 'add': {
                const { article } = pendingAction;
                return {
                    title: 'Add this article to the Fantasy carousel?',
                    description: 'It goes in after the last slide and shows on the Fantasy page straight away.',
                    confirmLabel: 'Add to Carousel',
                    tone: 'info' as const,
                    icon: PlusIcon,
                    body: <ConfirmSummary rows={[['Article', article.title], ['Category', article.category || 'General']]} />,
                };
            }
            case 'toggle': {
                const { slide, position } = pendingAction;
                return {
                    title: slide.is_active ? 'Hide this slide?' : 'Show this slide?',
                    description: slide.is_active
                        ? 'It stays in the list but disappears from the Fantasy page.'
                        : 'It appears on the Fantasy page again.',
                    confirmLabel: slide.is_active ? 'Hide Slide' : 'Show Slide',
                    tone: 'info' as const,
                    icon: slide.is_active ? EyeSlashIcon : EyeIcon,
                    body: <ConfirmSummary rows={[['Slide', `#${position}`], ['Article', slide.article.title]]} />,
                };
            }
            case 'move': {
                const { slide, position, direction } = pendingAction;
                return {
                    title: `Move this slide ${direction}?`,
                    description: 'It swaps places with its neighbour in the carousel.',
                    confirmLabel: direction === 'up' ? 'Move Up' : 'Move Down',
                    tone: 'info' as const,
                    icon: direction === 'up' ? ArrowUpIcon : ArrowDownIcon,
                    body: (
                        <ConfirmSummary rows={[
                            ['Article', slide.article.title],
                            ['From', `#${position}`],
                            ['To', `#${direction === 'up' ? position - 1 : position + 1}`],
                        ]} />
                    ),
                };
            }
            case 'remove': {
                const { slide, position } = pendingAction;
                return {
                    title: 'Remove this slide from the carousel?',
                    description: 'The article itself stays on the news site. You can add it back at any time.',
                    confirmLabel: 'Remove Slide',
                    tone: 'warning' as const,
                    icon: TrashIcon,
                    body: <ConfirmSummary rows={[['Slide', `#${position}`], ['Article', slide.article.title]]} />,
                };
            }
            default:
                return {
                    title: 'Publish this article and add it to the carousel?',
                    description: 'It goes live on the news site and at the top of the Fantasy page.',
                    confirmLabel: 'Publish & Add',
                    tone: 'success' as const,
                    icon: PaperAirplaneIcon,
                    body: (
                        <ConfirmSummary rows={[
                            ['Title', quick.title.trim()],
                            ['Category', quick.category],
                            ['Featured image', quick.featured_image ? 'Uploaded' : 'None (the Showtime logo is shown)'],
                            ['Excerpt', quick.excerpt.trim() || 'None (the start of the article is shown)'],
                        ]} />
                    ),
                };
        }
    })();

    return (
        <div className="space-y-8">
            <DashboardPageHeader
                title="Fantasy Carousel"
                subtitle={
                    <>
                        {sortedSlides.length} of {FANTASY_CAROUSEL_MAX} slides, in the order visitors see them at the top
                        of the Fantasy page. Each slide is a news article and links to it.
                    </>
                }
                actions={
                    <Button
                        icon={PlusIcon}
                        onClick={() => { setSearchInput(''); setSearch(''); setShowPicker(true); }}
                        disabled={isFull}
                        title={isFull ? `The carousel holds up to ${FANTASY_CAROUSEL_MAX}. Remove a slide first.` : undefined}
                        className="w-full sm:w-auto"
                    >
                        Add Existing Article
                    </Button>
                }
            />

            {isFull && (
                <p className="rounded-xl border border-amber-200 dark:border-amber-900/50 bg-amber-50 dark:bg-amber-950/30 px-4 py-3 text-sm text-amber-900 dark:text-amber-200">
                    The carousel is full at {FANTASY_CAROUSEL_MAX} slides. Remove one before adding or quick-adding another.
                </p>
            )}

            <section aria-labelledby="fc-slides" className="space-y-4">
                <h2 id="fc-slides" className="text-lg font-black text-sffl-navy dark:text-white">Slides</h2>
                {isLoading ? (
                    <Loader />
                ) : sortedSlides.length === 0 ? (
                    <div className="text-center py-12 sm:py-16 px-4 bg-gray-50 dark:bg-gray-800/50 rounded-2xl border border-dashed border-gray-300 dark:border-gray-700">
                        <FilmIcon className="w-14 h-14 mx-auto mb-4 text-gray-300 dark:text-gray-600" aria-hidden="true" />
                        <p className="font-bold text-gray-700 dark:text-gray-300">The Fantasy carousel is empty.</p>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                            Add an article that's already published, or write one with quick add below. Until then the
                            carousel doesn't show on the Fantasy page.
                        </p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                        {sortedSlides.map((slide, idx) => {
                            const image = articleImage(slide.article);
                            return (
                                <div
                                    key={slide.id}
                                    className={`bg-white dark:bg-gray-800 rounded-xl shadow-md overflow-hidden border ${slide.is_active ? 'border-gray-100 dark:border-gray-700' : 'border-yellow-300 dark:border-yellow-700'} flex flex-col`}
                                >
                                    <div className="relative aspect-video bg-gray-100 dark:bg-gray-900">
                                        {image ? (
                                            <img src={image} alt="" className="absolute inset-0 w-full h-full object-cover" />
                                        ) : (
                                            <img
                                                src="/images/branding/showtime-logo.webp"
                                                alt=""
                                                className="absolute inset-0 m-auto max-h-1/2 max-w-1/2 object-contain opacity-60"
                                            />
                                        )}
                                        <div className="absolute top-2 left-2 flex flex-wrap items-center gap-2">
                                            <span className="bg-sffl-navy/90 text-white text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded">
                                                #{idx + 1}
                                            </span>
                                            {!slide.is_active && (
                                                <span className="bg-yellow-500/90 text-yellow-950 text-[10px] font-black uppercase tracking-wider px-2 py-1 rounded">
                                                    Hidden
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="p-4 space-y-3 flex-1 flex flex-col">
                                        <div className="min-w-0">
                                            <p className="text-[10px] font-black uppercase tracking-wider text-sffl-red">
                                                {slide.article.category || 'General'}
                                                {shortDate(slide.article.published_at) && ` · ${shortDate(slide.article.published_at)}`}
                                            </p>
                                            <Link
                                                to={`/news/${slide.article.slug}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="mt-1 inline-flex items-start gap-1 font-bold text-gray-900 dark:text-white hover:underline"
                                            >
                                                <span className="line-clamp-2 break-words">{slide.article.title}</span>
                                                <ArrowTopRightOnSquareIcon className="w-4 h-4 shrink-0 mt-0.5 text-gray-400" aria-hidden="true" />
                                                <span className="sr-only">(opens in a new tab)</span>
                                            </Link>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Button variant="secondary" icon={ArrowUpIcon} onClick={() => requestMove(slide, 'up')} disabled={idx === 0} className="flex-1">
                                                Up
                                            </Button>
                                            <Button variant="secondary" icon={ArrowDownIcon} onClick={() => requestMove(slide, 'down')} disabled={idx === sortedSlides.length - 1} className="flex-1">
                                                Down
                                            </Button>
                                        </div>
                                        <div className="flex flex-wrap items-center gap-2 mt-auto">
                                            <Button
                                                variant="secondary"
                                                icon={slide.is_active ? EyeIcon : EyeSlashIcon}
                                                onClick={() => setPendingAction({ kind: 'toggle', slide, position: idx + 1 })}
                                                className="flex-1"
                                            >
                                                {slide.is_active ? 'Showing' : 'Hidden'}
                                            </Button>
                                            <Button
                                                variant="danger"
                                                icon={TrashIcon}
                                                onClick={() => setPendingAction({ kind: 'remove', slide, position: idx + 1 })}
                                            >
                                                Remove
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </section>

            {/* Quick add, just beneath the slides */}
            <section
                aria-labelledby="fc-quick-add"
                className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm"
            >
                <div className="p-4 sm:p-6 border-b border-gray-100 dark:border-gray-700">
                    <h2 id="fc-quick-add" className="text-lg font-black text-sffl-navy dark:text-white">
                        Quick add an article
                    </h2>
                    <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
                        Write a Fantasy article here and it's published to the news site and added to the end of the
                        carousel in one step. You can edit it later from{' '}
                        <Link to="/admin/news" className="font-bold text-sffl-red underline">News</Link>.
                    </p>
                </div>
                <div key={quickKey} className="p-4 sm:p-6 space-y-4">
                    <Field label="Title *" htmlFor="fc-title">
                        <Input id="fc-title" value={quick.title} onChange={(e) => setQ('title', e.target.value)} placeholder="Headline" />
                    </Field>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <Field label="Category" htmlFor="fc-category">
                            <Select id="fc-category" value={quick.category} onChange={(e) => setQ('category', e.target.value)}>
                                {FANTASY_NEWS_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                            </Select>
                        </Field>
                        <Field label="Author" htmlFor="fc-author">
                            <Input id="fc-author" value={quick.author} onChange={(e) => setQ('author', e.target.value)} placeholder="Author name" />
                        </Field>
                    </div>
                    <ImageUploadField
                        label="Featured image"
                        value={quick.featured_image}
                        onChange={(url) => setQ('featured_image', url)}
                        folder="news"
                        maxSizeMB={10}
                        compression={{ maxSizeMB: 2, maxWidthOrHeight: 2560 }}
                        helperText="Shown on the slide and the article. JPG, PNG or WEBP, up to 10MB (compressed on upload)."
                        isCommitted={busy}
                    />
                    <Field label="Excerpt" htmlFor="fc-excerpt" hint="One or two lines shown on the slide under the headline.">
                        <Textarea id="fc-excerpt" value={quick.excerpt} onChange={(e) => setQ('excerpt', e.target.value)} rows={2} placeholder="Short summary" />
                    </Field>
                    <Field label="Article *" htmlFor="fc-content">
                        <RichTextEditor id="fc-content" value={quick.content} onChange={(v) => setQ('content', v)} />
                    </Field>
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-end gap-3">
                        {isFull && (
                            <p className="text-xs text-amber-700 dark:text-amber-300 sm:mr-auto">
                                The carousel is full. Remove a slide to publish here.
                            </p>
                        )}
                        <Button
                            icon={PaperAirplaneIcon}
                            onClick={requestQuickAdd}
                            disabled={isFull || busy}
                            className="w-full sm:w-auto"
                        >
                            Publish &amp; Add to Carousel
                        </Button>
                    </div>
                </div>
            </section>

            {/* Add an existing article */}
            <Modal
                open={showPicker}
                onClose={() => setShowPicker(false)}
                title="Add an existing article"
                subtitle="Search every published article. Any category can go on the Fantasy carousel."
                maxWidth="2xl"
            >
                <form
                    className="flex flex-col sm:flex-row gap-2"
                    onSubmit={(e) => { e.preventDefault(); setSearch(searchInput.trim()); }}
                >
                    <Input
                        aria-label="Search articles"
                        value={searchInput}
                        onChange={(e) => setSearchInput(e.target.value)}
                        placeholder="Search by title, author or category"
                        className="flex-1"
                    />
                    <Button type="submit" variant="secondary" icon={MagnifyingGlassIcon}>Search</Button>
                </form>
                <div className="mt-4 divide-y divide-gray-100 dark:divide-gray-700">
                    {searching && pickerArticles.length === 0 ? (
                        <Loader />
                    ) : pickerArticles.length === 0 ? (
                        <p className="py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                            {search ? `No articles match "${search}".` : 'No articles published yet.'}
                        </p>
                    ) : (
                        pickerArticles.map((a) => {
                            const already = onCarousel.has(a.id);
                            const image = articleImage(a);
                            return (
                                <div key={a.id} className="flex items-center gap-3 py-3">
                                    <div className="w-20 aspect-video shrink-0 rounded bg-gray-100 dark:bg-gray-900 overflow-hidden">
                                        {image && <img src={image} alt="" className="w-full h-full object-cover" />}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <p className="text-sm font-bold text-gray-900 dark:text-white line-clamp-2 break-words">{a.title}</p>
                                        <p className="text-[11px] text-gray-500 dark:text-gray-400">
                                            {a.category || 'General'}{shortDate(a.published_at) && ` · ${shortDate(a.published_at)}`}
                                        </p>
                                    </div>
                                    <Button
                                        size="sm"
                                        variant={already ? 'secondary' : 'primary'}
                                        icon={already ? undefined : PlusIcon}
                                        disabled={already || isFull}
                                        title={already ? 'Already on the carousel' : isFull ? 'The carousel is full' : undefined}
                                        onClick={() => setPendingAction({ kind: 'add', article: a })}
                                        className="shrink-0"
                                    >
                                        {already ? 'On carousel' : 'Add'}
                                    </Button>
                                </div>
                            );
                        })
                    )}
                </div>
            </Modal>

            <ConfirmDialog
                open={!!pendingAction}
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
