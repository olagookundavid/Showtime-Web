import { Loader, Button, Field, Input, Modal, Select, ConfirmDialog, ConfirmSummary, DashboardPageHeader } from '../../components';
import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
    ArrowLeftIcon, ArrowRightIcon, CheckCircleIcon, FolderIcon, PencilSquareIcon, PlusIcon, TrashIcon,
} from '@heroicons/react/24/outline';
import {
    getGallery, createGallery, updateGallery, deleteGallery, getCompetitions,
} from '../../services/api';
import type { Gallery, CreateGalleryPayload, Competition } from '../../types';

interface FormData {
    competition_id: string;
    game_week: string;
    date: string;
    players_photo_url: string;
    fans_photo_url: string;
}

// Saves and deletes go through the confirm dialog first.
type PendingAction = { kind: 'save' } | { kind: 'delete'; gallery: Gallery };

const emptyForm: FormData = { competition_id: '', game_week: '', date: '', players_photo_url: '', fans_photo_url: '' };
const PAGE_SIZE = 9;
const ALL = 'ALL';

export const AdminGallery = () => {
    const queryClient = useQueryClient();
    const [page, setPage] = useState(1);
    const [filterComp, setFilterComp] = useState<string>(ALL);

    const { data: compsData } = useQuery({
        queryKey: ['adminCompetitions'],
        queryFn: () => getCompetitions(1, 100),
    });
    const competitions: Competition[] = (compsData?.data || []).filter(c => c.status !== 'inactive');

    const competitionFilter = filterComp === ALL ? undefined : filterComp;

    const { data: galleryData, isLoading: loading } = useQuery({
        queryKey: ['adminGalleries', page, filterComp],
        queryFn: () => getGallery(page, PAGE_SIZE, competitionFilter),
    });

    const galleries: Gallery[] = galleryData?.data || [];
    const totalPages = galleryData?.total_pages || 1;

    const [showModal, setShowModal] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [form, setForm] = useState<FormData>(emptyForm);
    const [saving, setSaving] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);

    useEffect(() => { setPage(1); }, [filterComp]);

    const openCreate = () => {
        setEditingId(null);
        setForm({ ...emptyForm, competition_id: filterComp !== ALL ? filterComp : (competitions[0]?.id || '') });
        setShowModal(true);
    };
    const openEdit = (g: Gallery) => {
        setEditingId(g.id);
        setForm({
            competition_id: g.competition_id || '',
            game_week: g.game_week,
            date: g.date,
            players_photo_url: g.players_photo_url || '',
            fans_photo_url: g.fans_photo_url || '',
        });
        setShowModal(true);
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const payload: CreateGalleryPayload = {
                competition_id: form.competition_id || null,
                game_week: form.game_week,
                date: form.date,
                players_photo_url: form.players_photo_url,
                fans_photo_url: form.fans_photo_url,
            };
            if (editingId) await updateGallery(editingId, payload);
            else await createGallery(payload);
            toast.success(editingId ? 'Gallery updated' : 'Gallery created');
            queryClient.invalidateQueries({ queryKey: ['adminGalleries'] });
            setShowModal(false);
        } catch (err) {
            console.error(err);
            toast.error('Failed to save gallery');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id: string) => {
        setDeleting(true);
        try {
            await deleteGallery(id);
            toast.success('Gallery deleted');
            queryClient.invalidateQueries({ queryKey: ['adminGalleries'] });
        } catch (err) {
            console.error(err);
            toast.error('Failed to delete gallery');
        } finally {
            setDeleting(false);
        }
    };

    // The handlers report their own errors, so the dialog always closes afterwards.
    const confirmPendingAction = async () => {
        if (!pendingAction) return;
        if (pendingAction.kind === 'save') await handleSave();
        else await handleDelete(pendingAction.gallery.id);
        setPendingAction(null);
    };

    const set = (field: keyof FormData, value: string) => setForm(p => ({ ...p, [field]: value }));

    const competitionName = (id: string) => competitions.find(c => c.id === id)?.name || 'None';

    const dialog = pendingAction?.kind === 'delete'
        ? {
            title: 'Delete this gallery?',
            description: 'This action cannot be undone.',
            confirmLabel: 'Delete Gallery',
            tone: 'warning' as const,
            icon: TrashIcon,
            body: (
                <ConfirmSummary rows={[
                    ['Game week', pendingAction.gallery.game_week],
                    ['Date', pendingAction.gallery.date],
                    ['Competition', pendingAction.gallery.competition?.name || 'None'],
                ]} />
            ),
        }
        : {
            title: editingId ? 'Save changes to this gallery?' : 'Create this gallery?',
            description: undefined,
            confirmLabel: editingId ? 'Save Changes' : 'Create Gallery',
            tone: 'info' as const,
            icon: editingId ? PencilSquareIcon : CheckCircleIcon,
            body: (
                <ConfirmSummary rows={[
                    ['Competition', competitionName(form.competition_id)],
                    ['Game week', form.game_week],
                    ['Date', form.date],
                    ['Players folder', form.players_photo_url],
                    ['Fans folder', form.fans_photo_url],
                ]} />
            ),
        };

    return (
        <div className="space-y-6">
            <DashboardPageHeader
                title="Gallery"
                subtitle="Photo folders for each game week, linked to their competition."
                actions={
                    <Button icon={PlusIcon} onClick={openCreate} className="w-full sm:w-auto">
                        Add Gallery
                    </Button>
                }
            />

            <div>
                <Select
                    aria-label="Filter by competition"
                    value={filterComp}
                    onChange={(e) => setFilterComp(e.target.value)}
                    className="w-full sm:w-72"
                >
                    <option value={ALL}>All competitions</option>
                    {competitions.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </Select>
            </div>

            {loading ? (
                <Loader />
            ) : (
                <>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {galleries.map(g => (
                            <div key={g.id} className="bg-white dark:bg-gray-800 rounded-xl shadow-md overflow-hidden border border-gray-100 dark:border-gray-700 flex flex-col">
                                <div className="p-5 flex-1">
                                    <div className="flex items-center justify-between mb-4 pb-4 border-b border-gray-100 dark:border-gray-700">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-lg bg-sffl-navy/10 flex items-center justify-center text-sffl-navy dark:text-white">
                                                <FolderIcon className="w-5 h-5" aria-hidden="true" />
                                            </div>
                                            <div>
                                                <h3 className="font-bold text-lg text-sffl-navy dark:text-white leading-tight">{g.game_week}</h3>
                                                <span className="text-xs font-medium text-gray-500 dark:text-gray-400">{g.date}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="space-y-3 mb-6">
                                        <div>
                                            <span className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Competition</span>
                                            {g.competition?.name ? (
                                                <span className="text-sm font-medium text-sffl-navy dark:text-white">{g.competition.name}</span>
                                            ) : (
                                                <span className="text-sm text-gray-400 italic">Not set</span>
                                            )}
                                        </div>
                                        <div>
                                            <span className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Players Folder</span>
                                            {g.players_photo_url ? (
                                                <a href={g.players_photo_url} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline truncate block">
                                                    {g.players_photo_url}
                                                </a>
                                            ) : (
                                                <span className="text-sm text-gray-400 italic">Not set</span>
                                            )}
                                        </div>
                                        <div>
                                            <span className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Fans Folder</span>
                                            {g.fans_photo_url ? (
                                                <a href={g.fans_photo_url} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline truncate block">
                                                    {g.fans_photo_url}
                                                </a>
                                            ) : (
                                                <span className="text-sm text-gray-400 italic">Not set</span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                <div className="p-4 bg-gray-50 dark:bg-gray-800/50 border-t border-gray-100 dark:border-gray-700">
                                    <div className="flex gap-2">
                                        <Button variant="secondary" onClick={() => openEdit(g)} className="flex-1">Edit</Button>
                                        <Button variant="danger" onClick={() => setPendingAction({ kind: 'delete', gallery: g })} className="flex-1">Delete</Button>
                                    </div>
                                </div>
                            </div>
                        ))}
                        {galleries.length === 0 && (
                            <div className="col-span-full text-center py-20 text-gray-400">
                                <FolderIcon className="w-12 h-12 mx-auto mb-4" aria-hidden="true" />
                                <p className="font-medium">No galleries yet. Click "Add Gallery" to create one.</p>
                            </div>
                        )}
                    </div>
                    {totalPages > 1 && (
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <p className="text-sm text-gray-500 dark:text-gray-400">Page {page} of {totalPages}</p>
                            <div className="flex flex-wrap gap-2">
                                <Button variant="secondary" icon={ArrowLeftIcon} onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}>
                                    Prev
                                </Button>
                                {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => { const s = Math.max(1, Math.min(page - 2, totalPages - 4)); const p = s + i; if (p > totalPages) return null; return (
                                    <Button key={p} variant={p === page ? 'primary' : 'secondary'} onClick={() => setPage(p)} aria-current={p === page ? 'page' : undefined}>
                                        {p}
                                    </Button>
                                ); })}
                                <Button variant="secondary" icon={ArrowRightIcon} iconPosition="right" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages}>
                                    Next
                                </Button>
                            </div>
                        </div>
                    )}
                </>
            )}

            {showModal && (
                <Modal
                    open
                    onClose={() => setShowModal(false)}
                    title={editingId ? 'Edit Gallery' : 'New Gallery'}
                    maxWidth="lg"
                    footer={
                        <>
                            <Button variant="secondary" onClick={() => setShowModal(false)}>Cancel</Button>
                            <Button onClick={() => setPendingAction({ kind: 'save' })} disabled={saving} loading={saving}>
                                {editingId ? 'Update Gallery' : 'Create Gallery'}
                            </Button>
                        </>
                    }
                >
                    <div className="space-y-4">
                            <Field label="Competition" htmlFor="gallery-competition">
                                <Select id="gallery-competition" value={form.competition_id} onChange={e => set('competition_id', e.target.value)}>
                                    <option value="">None</option>
                                    {competitions.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </Select>
                            </Field>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <Field label="Game Week *" htmlFor="gallery-game-week">
                                    <Input id="gallery-game-week" type="text" value={form.game_week} onChange={e => set('game_week', e.target.value)} placeholder="e.g. Week 5 or Custom Day" />
                                </Field>
                                <Field label="Date *" htmlFor="gallery-date">
                                    <Input id="gallery-date" type="date" value={form.date} onChange={e => set('date', e.target.value)} />
                                </Field>
                            </div>
                            <Field label="Players Folder Link *" htmlFor="gallery-players-url">
                                <Input id="gallery-players-url" type="url" value={form.players_photo_url} onChange={e => set('players_photo_url', e.target.value)} placeholder="https://drive.google.com/..." />
                            </Field>
                            <Field label="Fans Folder Link *" htmlFor="gallery-fans-url">
                                <Input id="gallery-fans-url" type="url" value={form.fans_photo_url} onChange={e => set('fans_photo_url', e.target.value)} placeholder="https://drive.google.com/..." />
                            </Field>
                        </div>
                </Modal>
            )}

            <ConfirmDialog
                open={pendingAction !== null}
                title={dialog.title}
                description={dialog.description}
                body={dialog.body}
                confirmLabel={dialog.confirmLabel}
                tone={dialog.tone}
                icon={dialog.icon}
                pending={saving || deleting}
                onConfirm={confirmPendingAction}
                onCancel={() => setPendingAction(null)}
            />
        </div>
    );
};
