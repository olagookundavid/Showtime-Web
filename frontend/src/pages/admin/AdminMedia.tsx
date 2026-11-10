import { useMemo, useRef, useState, type DragEvent } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
    ArrowPathRoundedSquareIcon,
    ArrowTopRightOnSquareIcon,
    ArrowUpTrayIcon,
    CheckCircleIcon,
    ClipboardDocumentIcon,
    DocumentIcon,
    DocumentTextIcon,
    PencilSquareIcon,
    PhotoIcon,
    TrashIcon,
} from '@heroicons/react/24/outline';
import { deleteMediaFile, getMediaFiles, updateMediaFile } from '../../services';
import type { MediaFile } from '../../types';
import { Button, ConfirmDialog, ConfirmSummary, DashboardPageHeader, DataTable, Field, Input, Modal, RowActions, Select, type Column } from '../../components';
import { CDN_URL, MEDIA_ACCEPT, MEDIA_TYPES, MEDIA_TYPES_HINT, type MediaKind } from '../../constants';
import { fileExtension, mediaTypeForFile, useMediaUpload } from '../../hooks';
import { getApiErrorMessage } from '../../utils';

const NO_ROWS: MediaFile[] = [];
const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

type KindFilter = MediaKind | '';
type UploadMode = { mode: 'new' } | { mode: 'replace'; file: MediaFile };
type PendingAction = { kind: 'replace'; file: MediaFile } | { kind: 'delete'; file: MediaFile };

const kindOf = (f: MediaFile): MediaKind => MEDIA_TYPES[fileExtension(f.object_key)]?.kind ?? 'document';

const formatBytes = (n: number) => {
    if (n < 1024) return `${n} B`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
    return `${(n / (1024 * 1024)).toFixed(1)} MB`;
};

const formatDate = (iso: string) => new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

const baseName = (name: string) => name.replace(/\.[^.]+$/, '');

// "Showtime Rulebook 2026.pdf" -> "showtime-rulebook-2026"
const slugFromFilename = (name: string) =>
    baseName(name)
        .normalize('NFKD')
        .replace(/[̀-ͯ]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 80)
        .replace(/-+$/, '');

// "showtime_rulebook-2026.pdf" -> "showtime rulebook 2026"
const titleFromFilename = (name: string) => baseName(name).replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim();

const copyLink = (url: string) => {
    navigator.clipboard.writeText(url).then(
        () => toast.success('Link copied.'),
        () => toast.error("Couldn't copy the link. Select it and copy it yourself."),
    );
};

const FileIcon = ({ kind, className }: { kind: MediaKind; className: string }) => {
    const Icon = kind === 'image' ? PhotoIcon : kind === 'pdf' ? DocumentTextIcon : DocumentIcon;
    return <Icon className={className} aria-hidden="true" />;
};

interface DropZoneProps {
    file: File | null;
    accept: string;
    disabled: boolean;
    onPick: (file: File) => void;
}

/** Drag a file in, or pick one. Shows the chosen file once there is one. */
const DropZone = ({ file, accept, disabled, onPick }: DropZoneProps) => {
    const inputRef = useRef<HTMLInputElement>(null);
    const [dragging, setDragging] = useState(false);

    const onDrop = (e: DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        setDragging(false);
        const dropped = e.dataTransfer.files?.[0];
        if (dropped && !disabled) onPick(dropped);
    };

    const type = file ? mediaTypeForFile(file) : null;

    return (
        <div
            onDragOver={(e) => { e.preventDefault(); if (!disabled) setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            className={`rounded-xl border-2 border-dashed p-4 sm:p-6 transition-colors ${
                dragging
                    ? 'border-sffl-red bg-red-50 dark:bg-red-900/10'
                    : 'border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800/50'
            }`}
        >
            <input
                ref={inputRef}
                type="file"
                accept={accept}
                className="hidden"
                onChange={(e) => {
                    const picked = e.target.files?.[0];
                    if (picked) onPick(picked);
                    e.target.value = '';
                }}
            />
            {file ? (
                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                        <FileIcon kind={type?.kind ?? 'document'} className="w-8 h-8 shrink-0 text-gray-400" />
                        <div className="min-w-0">
                            <div className="text-sm font-semibold text-gray-900 dark:text-white truncate">{file.name}</div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">{formatBytes(file.size)}</div>
                        </div>
                    </div>
                    <Button variant="secondary" size="sm" icon={ArrowUpTrayIcon} disabled={disabled} onClick={() => inputRef.current?.click()}>
                        Choose Another
                    </Button>
                </div>
            ) : (
                <div className="flex flex-col items-center text-center gap-3">
                    <ArrowUpTrayIcon className="w-8 h-8 text-gray-400" aria-hidden="true" />
                    <p className="text-sm text-gray-600 dark:text-gray-300">Drag a file here, or</p>
                    <Button variant="secondary" icon={ArrowUpTrayIcon} disabled={disabled} onClick={() => inputRef.current?.click()}>
                        Choose File
                    </Button>
                </div>
            )}
        </div>
    );
};

export const AdminMedia = () => {
    const queryClient = useQueryClient();
    const { upload, isUploading, progress } = useMediaUpload();

    const { data, isLoading } = useQuery({ queryKey: ['adminMedia'], queryFn: getMediaFiles });
    const [kindFilter, setKindFilter] = useState<KindFilter>('');
    const rows = useMemo(() => {
        const all = data ?? NO_ROWS;
        return kindFilter ? all.filter((f) => kindOf(f) === kindFilter) : all;
    }, [data, kindFilter]);

    // Upload / replace dialog
    const [uploadMode, setUploadMode] = useState<UploadMode | null>(null);
    const [picked, setPicked] = useState<File | null>(null);
    const [title, setTitle] = useState('');
    const [slug, setSlug] = useState('');
    const [slugEdited, setSlugEdited] = useState(false);
    const [uploaded, setUploaded] = useState<MediaFile | null>(null);

    // Rename dialog
    const [renaming, setRenaming] = useState<MediaFile | null>(null);
    const [renameTitle, setRenameTitle] = useState('');
    const [savingTitle, setSavingTitle] = useState(false);

    const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
    const [busy, setBusy] = useState(false);

    const refresh = () => queryClient.invalidateQueries({ queryKey: ['adminMedia'] });

    const openUpload = (mode: UploadMode) => {
        setUploadMode(mode);
        setPicked(null);
        setTitle('');
        setSlug('');
        setSlugEdited(false);
        setUploaded(null);
    };
    const closeUpload = () => {
        if (isUploading) return;
        setUploadMode(null);
    };

    const replacingExt = uploadMode?.mode === 'replace' ? fileExtension(uploadMode.file.object_key) : '';
    // A replacement must keep the extension, so its link stays the same. JPG and JPEG share one.
    const accept = uploadMode?.mode === 'replace'
        ? Object.keys(MEDIA_TYPES).filter((ext) => MEDIA_TYPES[ext].contentType === MEDIA_TYPES[replacingExt]?.contentType).map((ext) => `.${ext}`).join(',')
        : MEDIA_ACCEPT;

    const pickFile = (file: File) => {
        const type = mediaTypeForFile(file);
        if (!type) {
            toast.error(`That file type isn't allowed. ${MEDIA_TYPES_HINT}`);
            return;
        }
        if (uploadMode?.mode === 'replace' && type.contentType !== MEDIA_TYPES[replacingExt]?.contentType) {
            toast.error(`Choose a ${replacingExt.toUpperCase()} file, so the link keeps working. To use a different kind of file, upload it as a new file.`);
            return;
        }
        if (file.size > type.maxBytes) {
            toast.error(`That file is too large. ${MEDIA_TYPES_HINT}`);
            return;
        }
        setPicked(file);
        if (uploadMode?.mode === 'new') {
            if (!title.trim()) setTitle(titleFromFilename(file.name));
            if (!slugEdited) setSlug(slugFromFilename(file.name));
        }
    };

    const pickedExt = picked ? (MEDIA_TYPES[fileExtension(picked.name)] ? fileExtension(picked.name) : '') : '';
    // The backend stores JPEGs as .jpg.
    const linkExt = pickedExt === 'jpeg' ? 'jpg' : pickedExt;
    const slugError = slug && !SLUG_RE.test(slug) ? 'Use lowercase letters, numbers and single dashes, e.g. rulebook-2026.' : undefined;

    const startNewUpload = async () => {
        if (!picked) return;
        if (!title.trim()) { toast.error('Give the file a title.'); return; }
        if (slug.length < 2 || !SLUG_RE.test(slug)) { toast.error('Choose a valid link name.'); return; }
        try {
            const file = await upload(picked, { slug, title: title.trim() });
            setUploaded(file);
            toast.success('File uploaded.');
            refresh();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'The upload failed. Try again.');
        }
    };

    const confirmPendingAction = async () => {
        if (!pendingAction) return;
        setBusy(true);
        try {
            if (pendingAction.kind === 'replace') {
                if (!picked) return;
                await upload(picked, { fileId: pendingAction.file.id });
                toast.success('File replaced. The link now serves the new file.');
                setUploadMode(null);
            } else {
                await deleteMediaFile(pendingAction.file.id);
                toast.success('File deleted.');
            }
            refresh();
        } catch (err) {
            const fallback = pendingAction.kind === 'delete' ? 'Failed to delete the file.' : 'Failed to replace the file.';
            toast.error(err instanceof Error && pendingAction.kind === 'replace' ? err.message : getApiErrorMessage(err, fallback));
        } finally {
            setPendingAction(null);
            setBusy(false);
        }
    };

    const saveTitle = async () => {
        if (!renaming) return;
        if (!renameTitle.trim()) { toast.error('Give the file a title.'); return; }
        setSavingTitle(true);
        try {
            await updateMediaFile(renaming.id, renameTitle.trim());
            toast.success('Title saved.');
            setRenaming(null);
            refresh();
        } catch (err) {
            toast.error(getApiErrorMessage(err, 'Failed to save the title.'));
        } finally {
            setSavingTitle(false);
        }
    };

    const columns = useMemo<Column<MediaFile>[]>(() => [
        {
            header: 'File',
            accessor: 'title',
            sortable: true,
            cell: (f) => {
                const kind = kindOf(f);
                return (
                    <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 shrink-0 rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
                            {kind === 'image'
                                ? <img src={f.url} alt="" loading="lazy" className="w-full h-full object-cover" />
                                : <FileIcon kind={kind} className="w-5 h-5 text-gray-500 dark:text-gray-400" />}
                        </div>
                        <div className="min-w-0">
                            <a
                                href={f.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="block font-semibold text-sm text-gray-900 dark:text-white hover:text-sffl-red hover:underline wrap-break-word"
                            >
                                {f.title}
                            </a>
                            <div className="text-xs text-gray-500 dark:text-gray-400 truncate">{f.original_filename || '—'}</div>
                        </div>
                    </div>
                );
            },
        },
        {
            header: 'Link',
            accessor: 'slug',
            cell: (f) => (
                <span className="block max-w-64 truncate font-mono text-xs text-gray-600 dark:text-gray-300" title={f.url}>
                    {f.object_key}
                </span>
            ),
        },
        {
            header: 'Type',
            sortable: true,
            sortValue: (f) => fileExtension(f.object_key),
            cell: (f) => (
                <span className="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-full text-xs font-bold whitespace-nowrap">
                    {fileExtension(f.object_key).toUpperCase()}
                </span>
            ),
        },
        {
            header: 'Size',
            accessor: 'size_bytes',
            sortable: true,
            align: 'right',
            cell: (f) => <span className="whitespace-nowrap">{formatBytes(f.size_bytes)}</span>,
        },
        {
            header: 'Updated',
            accessor: 'updated_at',
            sortable: true,
            cell: (f) => (
                <div className="whitespace-nowrap">
                    <div>{formatDate(f.updated_at)}</div>
                    {f.uploaded_by_name && <div className="text-xs text-gray-500 dark:text-gray-400">by {f.uploaded_by_name}</div>}
                </div>
            ),
        },
        {
            header: 'Actions',
            align: 'right',
            cell: (f) => (
                <RowActions
                    label={`Actions for ${f.title}`}
                    actions={[
                        { label: 'Copy link', icon: ClipboardDocumentIcon, onSelect: () => copyLink(f.url) },
                        { label: 'Open', icon: ArrowTopRightOnSquareIcon, href: f.url },
                        { label: 'Replace file', icon: ArrowPathRoundedSquareIcon, hint: 'Same link, new file', onSelect: () => openUpload({ mode: 'replace', file: f }) },
                        { label: 'Rename', icon: PencilSquareIcon, onSelect: () => { setRenaming(f); setRenameTitle(f.title); } },
                        { label: 'Delete', icon: TrashIcon, danger: true, onSelect: () => setPendingAction({ kind: 'delete', file: f }) },
                    ]}
                />
            ),
        },
    ], []);

    const dialog = pendingAction?.kind === 'delete'
        ? {
            title: 'Delete this file?',
            description: 'Its link will stop working everywhere it is used, on this site and elsewhere. This cannot be undone.',
            confirmLabel: 'Delete File',
            tone: 'danger' as const,
            icon: TrashIcon,
            body: (
                <ConfirmSummary rows={[
                    ['Title', pendingAction.file.title],
                    ['Link', pendingAction.file.url],
                    ['Size', formatBytes(pendingAction.file.size_bytes)],
                ]} />
            ),
        }
        : {
            title: 'Replace this file?',
            description: 'Everyone using the link will get the new file, within about five minutes. The old file is not kept.',
            confirmLabel: 'Replace File',
            tone: 'warning' as const,
            icon: ArrowPathRoundedSquareIcon,
            body: pendingAction ? (
                <ConfirmSummary rows={[
                    ['File', pendingAction.file.title],
                    ['Link', pendingAction.file.url],
                    ['New file', picked ? `${picked.name} (${formatBytes(picked.size)})` : undefined],
                ]} />
            ) : null,
        };

    const replacing = uploadMode?.mode === 'replace' ? uploadMode.file : null;
    const uploadLabel = isUploading ? `Uploading ${progress}%` : replacing ? 'Replace File' : 'Upload File';

    return (
        <div className="space-y-6">
            <DashboardPageHeader
                title="Media Library"
                subtitle="Upload PDFs, images and documents to get a permanent link you can use anywhere. Replacing a file keeps its link."
                actions={
                    <Button icon={ArrowUpTrayIcon} onClick={() => openUpload({ mode: 'new' })} className="w-full sm:w-auto">
                        Upload File
                    </Button>
                }
            />

            <DataTable
                data={rows}
                columns={columns}
                getRowId={(f) => f.id}
                loading={isLoading}
                searchPlaceholder="Search title, link or file name"
                emptyMessage={kindFilter
                    ? 'No files of this type yet.'
                    : 'No files yet. Use Upload File to add a PDF, image or document and get a link you can share.'}
                headerActions={
                    <Select
                        value={kindFilter}
                        onChange={(e) => setKindFilter(e.target.value as KindFilter)}
                        aria-label="Filter by type"
                        className="w-full sm:w-44"
                    >
                        <option value="">All files</option>
                        <option value="pdf">PDFs</option>
                        <option value="image">Images</option>
                        <option value="document">Documents</option>
                    </Select>
                }
            />

            {uploadMode && (
                <Modal
                    open
                    onClose={closeUpload}
                    title={uploaded ? 'File Uploaded' : replacing ? 'Replace File' : 'Upload File'}
                    subtitle={uploaded ? undefined : replacing ? `The link stays the same: ${replacing.url}` : MEDIA_TYPES_HINT}
                    maxWidth="lg"
                    footer={uploaded ? (
                        <>
                            <Button variant="secondary" onClick={() => openUpload({ mode: 'new' })}>Upload Another</Button>
                            <Button onClick={() => setUploadMode(null)}>Done</Button>
                        </>
                    ) : (
                        <>
                            <Button variant="secondary" onClick={closeUpload} disabled={isUploading}>Cancel</Button>
                            <Button
                                icon={replacing ? ArrowPathRoundedSquareIcon : ArrowUpTrayIcon}
                                loading={isUploading}
                                disabled={!picked || (!replacing && (!!slugError || slug.length < 2 || !title.trim()))}
                                onClick={() => (replacing ? setPendingAction({ kind: 'replace', file: replacing }) : startNewUpload())}
                            >
                                {uploadLabel}
                            </Button>
                        </>
                    )}
                >
                    {uploaded ? (
                        <div className="space-y-4">
                            <div className="flex items-start gap-3">
                                <CheckCircleIcon className="w-6 h-6 shrink-0 text-green-600" aria-hidden="true" />
                                <p className="text-sm text-gray-700 dark:text-gray-200">
                                    <span className="font-semibold">{uploaded.title}</span> is live. Use this link anywhere: it won&apos;t change, even if you replace the file later.
                                </p>
                            </div>
                            <Field label="Link" htmlFor="media-uploaded-link">
                                <div className="flex flex-col sm:flex-row gap-2">
                                    <Input id="media-uploaded-link" readOnly value={uploaded.url} onFocus={(e) => e.target.select()} className="min-w-0 flex-1 font-mono" />
                                    <Button variant="secondary" icon={ClipboardDocumentIcon} onClick={() => copyLink(uploaded.url)}>Copy Link</Button>
                                </div>
                            </Field>
                            <a
                                href={uploaded.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 text-sm font-semibold text-sffl-red hover:underline"
                            >
                                <ArrowTopRightOnSquareIcon className="w-4 h-4" aria-hidden="true" />
                                Open the file
                            </a>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <DropZone file={picked} accept={accept} disabled={isUploading} onPick={pickFile} />
                            {!replacing && (
                                <>
                                    <Field label="Title" htmlFor="media-title" hint="What the file is, so others can find it here.">
                                        <Input
                                            id="media-title"
                                            value={title}
                                            maxLength={160}
                                            onChange={(e) => setTitle(e.target.value)}
                                            placeholder="e.g. Official Rule Book 2026"
                                            disabled={isUploading}
                                        />
                                    </Field>
                                    <div className="space-y-1.5">
                                        <Field
                                            label="Link name"
                                            htmlFor="media-slug"
                                            error={slugError}
                                            hint="Part of the permanent link. It can't be changed later."
                                        >
                                            <Input
                                                id="media-slug"
                                                value={slug}
                                                maxLength={80}
                                                invalid={!!slugError}
                                                onChange={(e) => { setSlug(e.target.value.toLowerCase()); setSlugEdited(true); }}
                                                placeholder="rulebook-2026"
                                                disabled={isUploading}
                                            />
                                        </Field>
                                        <p className="text-xs text-gray-500 dark:text-gray-400 break-all">
                                            Link: <span className="font-mono text-gray-700 dark:text-gray-200">{CDN_URL}/files/{slug || 'link-name'}.{linkExt || 'pdf'}</span>
                                        </p>
                                    </div>
                                </>
                            )}
                            {isUploading && (
                                <div className="h-2 w-full rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100} aria-label="Upload progress">
                                    <div className="h-full bg-sffl-red transition-all duration-300" style={{ width: `${progress}%` }} />
                                </div>
                            )}
                        </div>
                    )}
                </Modal>
            )}

            {renaming && (
                <Modal
                    open
                    onClose={() => !savingTitle && setRenaming(null)}
                    title="Rename File"
                    subtitle="Changes the title shown here. The link stays the same."
                    maxWidth="md"
                    footer={
                        <>
                            <Button variant="secondary" onClick={() => setRenaming(null)} disabled={savingTitle}>Cancel</Button>
                            <Button type="submit" form="media-rename-form" loading={savingTitle}>Save Title</Button>
                        </>
                    }
                >
                    <form id="media-rename-form" onSubmit={(e) => { e.preventDefault(); saveTitle(); }}>
                        <Field label="Title" htmlFor="media-rename-title">
                            <Input id="media-rename-title" value={renameTitle} maxLength={160} onChange={(e) => setRenameTitle(e.target.value)} />
                        </Field>
                    </form>
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
                pending={busy}
                onConfirm={confirmPendingAction}
                onCancel={() => setPendingAction(null)}
            />
        </div>
    );
};
