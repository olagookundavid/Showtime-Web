import { useEffect, useMemo, useRef, useState, type ComponentType, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
    ArchiveBoxArrowDownIcon,
    ArchiveBoxIcon,
    ArrowUturnLeftIcon,
    CheckIcon,
    ExclamationTriangleIcon,
    EyeIcon,
    PencilSquareIcon,
    PlusIcon,
    ShoppingCartIcon,
    TagIcon,
    TrashIcon,
    XMarkIcon,
} from '@heroicons/react/24/outline';
import {
    getAdminStoreProducts,
    createAdminStoreProduct,
    updateAdminStoreProduct,
    deleteAdminStoreProduct,
    saveAdminProductVariants,
    saveAdminProductImages,
    getAdminOrders,
} from '../../services/api';
import type { Order, StoreProduct, ProductImage, ProductOption } from '../../types/store';
import { Loader } from '../../components/ui/Loader';
import { ImageUploadField } from '../../components/ui/ImageUploadField';
import { DataTable, type Column } from '../../components/ui/DataTable';
import { RowActions } from '../../components/ui/RowActions';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { ConfirmSummary } from '../../components/ui/ConfirmSummary';
import { Button, Checkbox, Field, IconButton, Input, Modal, Select, Textarea } from '../../components/ui';
import { DiscountCodesPanel } from '../../components/admin/DiscountCodesPanel';
import { useImageUpload } from '../../hooks/useImageUpload';
import { getApiErrorMessage } from '../../utils/apiError';
import { DashboardPageHeader } from '../../components/dashboard/DashboardPageHeader';
import { STANDARD_PRODUCT_TAGS } from '../../constants';

type Tab = 'PRODUCTS' | 'ORDERS' | 'DISCOUNTS';

const TABS: { key: Tab; label: string; icon: ComponentType<{ className?: string }> }[] = [
    { key: 'PRODUCTS', label: 'Catalog Products', icon: ShoppingCartIcon },
    { key: 'ORDERS', label: 'Online Orders', icon: ArchiveBoxIcon },
    { key: 'DISCOUNTS', label: 'Discount Codes', icon: TagIcon },
];

type ProductStatusFilter = 'active' | 'draft' | 'all';

const PRODUCT_STATUS_FILTERS: { key: ProductStatusFilter; label: string }[] = [
    { key: 'active', label: 'Active' },
    { key: 'draft', label: 'Draft' },
    { key: 'all', label: 'All' },
];

const ORDERS_PAGE_SIZE = 20;
const NO_ORDERS: Order[] = [];

type ProductFormData = {
    name: string;
    description: string;
    price: number;
    quantity: number;
    threshold: number;
    is_active: boolean;
    tags: string[];
};

const emptyProductForm: ProductFormData = {
    name: '',
    description: '',
    price: 0,
    quantity: 0,
    threshold: 5,
    is_active: true,
    tags: [],
};

// VariantDraft mirrors the new ProductVariant shape (combination row) minus
// server-managed fields. `sku` is auto-generated server-side when empty.
type VariantDraft = {
    option1_value: string;
    option2_value: string;
    option3_value: string;
    sku: string;
    quantity: number;
    image_url: string;
};
type ImageDraft = Omit<ProductImage, 'id'>;

// One option being built/edited in the admin modal. Same shape as the API's
// ProductOption — re-aliased here so the rest of the file reads cleanly.
type OptionDraft = ProductOption;

const emptyOption = (): OptionDraft => ({ name: '', drives_price: false, values: [] });

type EditorMode = { kind: 'create' } | { kind: 'edit'; product: StoreProduct };

type PendingAction = { kind: 'save' } | { kind: 'archive'; product: StoreProduct } | { kind: 'reactivate'; product: StoreProduct };

const MAX_OPTIONS = 3;

// Stable key for a combination row — used to preserve user-entered stock /
// image across re-generations when an option value is added/removed elsewhere.
const variantKey = (opt1: string, opt2: string, opt3: string) =>
    `${opt1}|${opt2}|${opt3}`;

// Compose the cartesian product of all option values into a fresh variant
// array, carrying over `quantity`/`image_url`/`sku` from previous rows whose
// tuple still matches. New combinations seed their stock from `defaultStock`
// (typically the product's base quantity) so the admin's intent doesn't get
// silently zeroed out the moment they add an option.
const regenerateVariantGrid = (opts: OptionDraft[], prev: VariantDraft[], defaultStock: number): VariantDraft[] => {
    const valueLists = opts
        .map(o => o.values.map(v => v.value).filter(Boolean))
        .filter(list => list.length > 0);
    if (valueLists.length === 0) return [];

    // Compute combinations. Each combo is an array of values, padded to 3.
    let combos: string[][] = [[]];
    for (const list of valueLists) {
        const next: string[][] = [];
        for (const combo of combos) {
            for (const v of list) next.push([...combo, v]);
        }
        combos = next;
    }

    const prevByKey = new Map(prev.map(v => [variantKey(v.option1_value, v.option2_value, v.option3_value), v]));

    return combos.map(combo => {
        const [o1 = '', o2 = '', o3 = ''] = combo;
        const existing = prevByKey.get(variantKey(o1, o2, o3));
        return {
            option1_value: o1,
            option2_value: o2,
            option3_value: o3,
            sku: existing?.sku || '',
            quantity: existing ? existing.quantity : Math.max(0, defaultStock),
            image_url: existing?.image_url || '',
        };
    });
};

const paymentPill = (status: Order['payment_status']) =>
    status === 'paid'
        ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
        : status === 'failed'
            ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
            : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400';

const fulfillmentPill = (status: Order['fulfillment_status']) =>
    status === 'cancelled'
        ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
        : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';

export const AdminStore = () => {
    const queryClient = useQueryClient();

    const [activeTab, setActiveTab] = useState<Tab>('PRODUCTS');

    // Unified product editor state (covers create + edit, with options +
    // auto-generated variant grid + product image gallery)
    const [editor, setEditor] = useState<EditorMode | null>(null);
    const [formData, setFormData] = useState<ProductFormData>(emptyProductForm);
    const [options, setOptions] = useState<OptionDraft[]>([]);
    // Variants are derived from `options`; we hold them in state so per-row
    // stock + image picks survive option edits. Regenerated whenever options change.
    const [variants, setVariants] = useState<VariantDraft[]>([]);
    const [images, setImages] = useState<ImageDraft[]>([]);
    // Buffer for typing the next option value before it's added to a chip list.
    const [newOptionValue, setNewOptionValue] = useState<string[]>(['', '', '']);
    const [uploadTempImageUrl, setUploadTempImageUrl] = useState('');
    // Every write waits here for the confirm dialog
    const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
    const [busy, setBusy] = useState(false);
    // URLs uploaded in this editor session but not yet persisted to the DB. If
    // the admin removes one before saving (or closes the modal without saving)
    // we fire DELETE /upload immediately so R2 doesn't accumulate orphans.
    // Cleared on successful save (everything is now durable on the server).
    const sessionUploadedUrlsRef = useRef<Set<string>>(new Set());
    const { deleteImage } = useImageUpload();
    const [customTagInput, setCustomTagInput] = useState('');

    const handleAddCustomTag = () => {
        const tag = customTagInput.trim();
        if (!tag) return;
        setFormData(d => ({
            ...d,
            tags: d.tags.includes(tag) ? d.tags : [...d.tags, tag],
        }));
        setCustomTagInput('');
    };

    // Orders state
    const [ordersPage, setOrdersPage] = useState(1);
    const [paymentFilter, setPaymentFilter] = useState('');
    const [fulfillmentFilter, setFulfillmentFilter] = useState('');
    const navigate = useNavigate();

    // Products state
    const [productStatusFilter, setProductStatusFilter] = useState<ProductStatusFilter>('active');

    // Queries
    const { data: products, isLoading: loadingProducts } = useQuery({
        queryKey: ['adminStoreProducts'],
        queryFn: getAdminStoreProducts,
    });

    const productCounts = useMemo(() => {
        const all = products?.length ?? 0;
        const active = products?.filter(p => p.is_active).length ?? 0;
        return { active, draft: all - active, all };
    }, [products]);

    const visibleProducts = useMemo(() => {
        if (!products) return undefined;
        if (productStatusFilter === 'all') return products;
        return products.filter(p => productStatusFilter === 'active' ? p.is_active : !p.is_active);
    }, [products, productStatusFilter]);

    const { data: ordersData, isLoading: loadingOrders } = useQuery({
        queryKey: ['adminOrders', ordersPage, paymentFilter, fulfillmentFilter],
        queryFn: () => getAdminOrders(ordersPage, ORDERS_PAGE_SIZE, paymentFilter || undefined, fulfillmentFilter || undefined),
        enabled: activeTab === 'ORDERS',
        placeholderData: (prev) => prev,
    });

    // ─── Unified Product Editor (product + options + variants + images) ────
    const resetEditorState = () => {
        setFormData(emptyProductForm);
        setOptions([]);
        setVariants([]);
        setImages([]);
        setNewOptionValue(['', '', '']);
        setUploadTempImageUrl('');
        sessionUploadedUrlsRef.current = new Set();
    };

    const handleOpenCreate = () => {
        resetEditorState();
        setEditor({ kind: 'create' });
    };

    const handleOpenEdit = (p: StoreProduct) => {
        setFormData({
            name: p.name,
            description: p.description || '',
            price: p.price,
            quantity: p.quantity,
            threshold: p.threshold,
            is_active: p.is_active,
            tags: p.tags || [],
        });
        setOptions((p.options || []).map(o => ({
            name: o.name,
            drives_price: o.drives_price,
            values: o.values.map(v => ({ value: v.value, price: v.price })),
        })));
        setVariants((p.variants || []).map(v => ({
            option1_value: v.option1_value || '',
            option2_value: v.option2_value || '',
            option3_value: v.option3_value || '',
            sku: v.sku,
            quantity: v.quantity,
            image_url: v.image_url || '',
        })));
        setImages((p.images || []).map(img => ({
            image_url: img.image_url,
            is_primary: img.is_primary,
            display_order: img.display_order,
        })));
        setNewOptionValue(['', '', '']);
        setUploadTempImageUrl('');
        sessionUploadedUrlsRef.current = new Set();
        setEditor({ kind: 'edit', product: p });
    };

    const handleCloseEditor = () => {
        // Any image uploaded in this session that was never saved is now an
        // orphan in R2 — async-delete each before tearing down state.
        const orphans = Array.from(sessionUploadedUrlsRef.current);
        orphans.forEach(url => { deleteImage(url); });
        setEditor(null);
        resetEditorState();
    };

    // ─── Options management ────────────────────────────────────────────────
    const handleAddOption = () => {
        if (options.length >= MAX_OPTIONS) return;
        setOptions(prev => [...prev, emptyOption()]);
    };

    const handleRemoveOption = (idx: number) => {
        setOptions(prev => prev.filter((_, i) => i !== idx));
        setNewOptionValue(prev => {
            const next = [...prev];
            next.splice(idx, 1);
            next.push('');
            return next;
        });
    };

    const handleOptionNameChange = (idx: number, name: string) => {
        setOptions(prev => prev.map((o, i) => i === idx ? { ...o, name } : o));
    };

    // Only ONE option may drive price at a time — radio behaviour.
    const handleDrivesPriceToggle = (idx: number) => {
        setOptions(prev => prev.map((o, i) => ({
            ...o,
            drives_price: i === idx ? !o.drives_price : false,
            // When un-marking, strip stale prices so the JSON stays clean.
            values: i === idx
                ? o.values.map(v => ({ ...v, price: o.drives_price ? undefined : v.price }))
                : o.values.map(v => ({ ...v, price: undefined })),
        })));
    };

    const handleAddOptionValue = (idx: number) => {
        const raw = newOptionValue[idx]?.trim();
        if (!raw) return;
        setOptions(prev => prev.map((o, i) => {
            if (i !== idx) return o;
            if (o.values.some(v => v.value === raw)) return o; // dedupe
            return { ...o, values: [...o.values, { value: raw }] };
        }));
        setNewOptionValue(prev => {
            const next = [...prev];
            next[idx] = '';
            return next;
        });
    };

    const handleRemoveOptionValue = (optIdx: number, valIdx: number) => {
        setOptions(prev => prev.map((o, i) => {
            if (i !== optIdx) return o;
            return { ...o, values: o.values.filter((_, j) => j !== valIdx) };
        }));
    };

    const handleOptionValuePrice = (optIdx: number, valIdx: number, price: number) => {
        setOptions(prev => prev.map((o, i) => {
            if (i !== optIdx) return o;
            return {
                ...o,
                values: o.values.map((v, j) => j === valIdx ? { ...v, price: price > 0 ? price : undefined } : v),
            };
        }));
    };

    // ─── Variant grid auto-generation ──────────────────────────────────────
    // Whenever the option definitions change, regenerate the cartesian
    // product of values into the variants array. Stock & image picks for
    // matching combinations are preserved; newly-created combinations seed
    // their stock from the product's base quantity so the admin doesn't have
    // to re-enter the same number for every row.
    useEffect(() => {
        if (!editor) return;
        setVariants(prev => regenerateVariantGrid(options, prev, Number(formData.quantity) || 0));
    }, [options, editor, formData.quantity]);

    const handleImageUploaded = (url: string) => {
        if (!url) return;
        setImages(prev => {
            if (prev.some(img => img.image_url === url)) return prev;
            return [...prev, {
                image_url: url,
                is_primary: prev.length === 0,
                display_order: prev.length,
            }];
        });
        sessionUploadedUrlsRef.current.add(url);
        setUploadTempImageUrl('');
    };

    const handleSetPrimaryImage = (index: number) => {
        setImages(prev => prev.map((img, i) => ({ ...img, is_primary: i === index })));
    };

    const handleRemoveImage = (index: number) => {
        const removed = images[index];
        if (!removed) return;
        // Drop the line.
        setImages(prev => prev.filter((_, i) => i !== index));
        // If any variant was pinned to this image, unpin it so we don't ship a
        // dangling URL on save.
        setVariants(prev => prev.map(v => (v.image_url === removed.image_url ? { ...v, image_url: '' } : v)));
        // If the image was uploaded in THIS session (not yet on the server),
        // delete the R2 object immediately so it doesn't become an orphan.
        // Images that came from the DB are left alone here — the backend will
        // delete them from R2 when the product is saved.
        if (sessionUploadedUrlsRef.current.has(removed.image_url)) {
            sessionUploadedUrlsRef.current.delete(removed.image_url);
            deleteImage(removed.image_url);
        }
    };

    // Form submit validates, then waits for the confirm dialog before anything is saved.
    const requestSaveEditor = (e: FormEvent) => {
        e.preventDefault();
        if (!editor) return;
        if (!formData.tags || formData.tags.length === 0) {
            toast.error('At least one product tag is required.');
            return;
        }
        setPendingAction({ kind: 'save' });
    };

    // Saves product + variants + images in one go. On create, we POST the
    // product first to get an ID, then post variants and images against it.
    // If a step after the product POST fails, the product still exists — the
    // admin can reopen the editor and retry; we surface a clear error.
    const saveEditor = async () => {
        if (!editor) return;
        // SKU is auto-generated server-side; omit from payload.
        // Strip out empty options + values so we don't ship junk.
        const cleanOptions = options
            .map(o => ({
                name: o.name.trim(),
                drives_price: o.drives_price,
                values: o.values
                    .filter(v => v.value.trim())
                    .map(v => ({
                        value: v.value.trim(),
                        price: o.drives_price && v.price && v.price > 0 ? v.price : undefined,
                    })),
            }))
            .filter(o => o.name && o.values.length > 0);

        const payload = {
            name: formData.name,
            sku: '',
            description: formData.description,
            price: Number(formData.price),
            quantity: Number(formData.quantity),
            threshold: Number(formData.threshold),
            is_active: formData.is_active,
            tags: formData.tags || [],
            options: cleanOptions,
        };

        let productId: string;
        if (editor.kind === 'edit') {
            await updateAdminStoreProduct(editor.product.id, payload);
            productId = editor.product.id;
        } else {
            const created = await createAdminStoreProduct(payload);
            productId = created.id;
        }

        // Build the variant payload from the auto-generated grid, dropping
        // empty option slots so unused dimensions round-trip as NULL.
        const variantPayload = variants.map(v => ({
            option1_value: v.option1_value || undefined,
            option2_value: v.option2_value || undefined,
            option3_value: v.option3_value || undefined,
            sku: v.sku || undefined,
            quantity: Number(v.quantity) || 0,
            image_url: v.image_url || undefined,
        }));

        await saveAdminProductVariants(productId, variantPayload);
        await saveAdminProductImages(productId, images);

        // Everything is durable on the server now — don't let the
        // close-handler treat these as orphans.
        sessionUploadedUrlsRef.current = new Set();
        queryClient.invalidateQueries({ queryKey: ['adminStoreProducts'] });
        toast.success(editor.kind === 'edit' ? 'Product updated.' : 'Product created.');
        handleCloseEditor();
    };

    const confirmPendingAction = async () => {
        const action = pendingAction;
        if (!action) return;
        setBusy(true);
        try {
            if (action.kind === 'save') {
                await saveEditor();
            } else if (action.kind === 'archive') {
                await deleteAdminStoreProduct(action.product.id);
                queryClient.invalidateQueries({ queryKey: ['adminStoreProducts'] });
                toast.success('Product archived.');
            } else {
                const p = action.product;
                await updateAdminStoreProduct(p.id, {
                    name: p.name,
                    description: p.description,
                    price: p.price,
                    quantity: p.quantity,
                    threshold: p.threshold,
                    is_active: true,
                    tags: p.tags || [],
                    options: p.options,
                });
                queryClient.invalidateQueries({ queryKey: ['adminStoreProducts'] });
                toast.success('Product reactivated.');
            }
        } catch (err) {
            toast.error(getApiErrorMessage(
                err,
                err instanceof Error && err.message ? err.message : action.kind === 'save' ? 'Failed to save product' : action.kind === 'archive' ? 'Failed to archive product' : 'Failed to reactivate product',
            ));
        } finally {
            setBusy(false);
            setPendingAction(null);
        }
    };

    // Order actions live on the dedicated detail page (AdminOrderDetail).
    const orderColumns = useMemo<Column<Order>[]>(() => [
        {
            header: 'Order',
            sortable: true,
            sortValue: (o) => o.order_reference,
            cell: (o) => (
                <Link
                    to={`/admin/store/orders/${o.id}`}
                    className="font-black text-sm text-sffl-red hover:underline whitespace-nowrap"
                >
                    {o.order_reference}
                </Link>
            ),
        },
        {
            header: 'Payment',
            sortable: true,
            sortValue: (o) => o.payment_status,
            cell: (o) => (
                <span className={`text-[10px] font-black px-2 py-0.5 rounded-full uppercase ${paymentPill(o.payment_status)}`}>
                    {o.payment_status}
                </span>
            ),
        },
        {
            header: 'Fulfillment',
            sortable: true,
            sortValue: (o) => o.fulfillment_status,
            cell: (o) => (
                <span className={`text-[10px] font-black px-2 py-0.5 rounded-full uppercase ${fulfillmentPill(o.fulfillment_status)}`}>
                    {o.fulfillment_status}
                </span>
            ),
        },
        {
            header: 'Customer',
            sortable: true,
            sortValue: (o) => o.customer_name,
            cell: (o) => <span className="text-gray-700 dark:text-gray-300 wrap-break-word">{o.customer_name}</span>,
        },
        {
            header: 'Phone',
            cell: (o) => <span className="whitespace-nowrap text-gray-500 dark:text-gray-400">{o.customer_phone}</span>,
        },
        {
            header: 'Total',
            align: 'right',
            sortable: true,
            sortValue: (o) => o.total_amount,
            cell: (o) => <span className="font-black dark:text-white whitespace-nowrap">₦{o.total_amount.toLocaleString()}</span>,
        },
        {
            header: 'Date',
            sortable: true,
            sortValue: (o) => o.created_at,
            cell: (o) => <span className="whitespace-nowrap text-gray-500 dark:text-gray-400">{new Date(o.created_at).toLocaleDateString()}</span>,
        },
        {
            header: 'Actions',
            align: 'right',
            cell: (o) => (
                <RowActions
                    label={`Actions for order ${o.order_reference}`}
                    actions={[{ label: 'View order', icon: EyeIcon, onSelect: () => navigate(`/admin/store/orders/${o.id}`) }]}
                />
            ),
        },
    ], [navigate]);

    const dialog = pendingAction?.kind === 'archive'
        ? {
            title: 'Archive this product?',
            description: "It's hidden from the storefront and marked Draft — not deleted, so past orders keep their product details. You can bring it back anytime with Reactivate.",
            confirmLabel: 'Archive Product',
            tone: 'warning' as const,
            icon: ArchiveBoxArrowDownIcon,
            body: (
                <ConfirmSummary rows={[
                    ['Product', pendingAction.product.name],
                    ['Price', `₦${pendingAction.product.price.toLocaleString()}`],
                    ['Stock', String(pendingAction.product.quantity)],
                    ['Variants', String(pendingAction.product.variants?.length || 0)],
                ]} />
            ),
        }
        : pendingAction?.kind === 'reactivate'
        ? {
            title: 'Reactivate this product?',
            description: 'It becomes visible in the storefront again, with its existing price, stock and variants.',
            confirmLabel: 'Reactivate Product',
            tone: 'success' as const,
            icon: ArrowUturnLeftIcon,
            body: (
                <ConfirmSummary rows={[
                    ['Product', pendingAction.product.name],
                    ['Price', `₦${pendingAction.product.price.toLocaleString()}`],
                    ['Stock', String(pendingAction.product.quantity)],
                    ['Variants', String(pendingAction.product.variants?.length || 0)],
                ]} />
            ),
        }
        : {
            title: editor?.kind === 'edit' ? 'Save changes to this product?' : 'Create this product?',
            description: undefined,
            confirmLabel: editor?.kind === 'edit' ? 'Save Changes' : 'Create Product',
            tone: 'info' as const,
            icon: editor?.kind === 'edit' ? PencilSquareIcon : PlusIcon,
            body: (
                <ConfirmSummary rows={[
                    ['Product', formData.name],
                    ['Price', `₦${(Number(formData.price) || 0).toLocaleString()}`],
                    ['Variants', String(variants.length)],
                    ['Images', String(images.length)],
                    ['Tags', formData.tags.join(', ')],
                    ['Visibility', formData.is_active ? 'Active (visible in storefront)' : 'Draft'],
                ]} />
            ),
        };

    return (
        <div className="space-y-6 pb-36 md:pb-12">
            <DashboardPageHeader
                title="Online Store"
                subtitle="Manage e-commerce products, variants, image assets, and order fulfillment."
                actions={
                    activeTab === 'PRODUCTS' && (
                        <Button icon={PlusIcon} onClick={handleOpenCreate} className="w-full sm:w-auto">
                            Create Product
                        </Button>
                    )
                }
            />

            {/* Tabs */}
            <div className="flex flex-wrap gap-2 border-b border-gray-200 dark:border-gray-700 pb-3">
                {TABS.map(({ key, label, icon }) => (
                    <Button
                        key={key}
                        variant={activeTab === key ? 'navy' : 'secondary'}
                        icon={icon}
                        onClick={() => setActiveTab(key)}
                        aria-pressed={activeTab === key}
                    >
                        {label}
                    </Button>
                ))}
            </div>

            {/* PRODUCTS TAB */}
            {activeTab === 'PRODUCTS' && (
                <>
                    {loadingProducts ? (
                        <div className="flex justify-center py-12"><Loader /></div>
                    ) : !products || products.length === 0 ? (
                        <div className="bg-white dark:bg-gray-800 p-8 sm:p-12 rounded-2xl text-center border border-gray-200 dark:border-gray-700">
                            <p className="text-gray-500 font-bold">No products yet. Click "Create Product" to add your first item.</p>
                        </div>
                    ) : (
                        <div className="space-y-5">
                            <div role="group" aria-label="Filter by product status" className="flex flex-wrap items-center gap-2">
                                <span className="text-xs font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400">Status</span>
                                {PRODUCT_STATUS_FILTERS.map(({ key, label }) => (
                                    <Button
                                        key={key}
                                        size="sm"
                                        variant={productStatusFilter === key ? 'navy' : 'secondary'}
                                        aria-pressed={productStatusFilter === key}
                                        onClick={() => setProductStatusFilter(key)}
                                    >
                                        {label} ({productCounts[key]})
                                    </Button>
                                ))}
                            </div>

                            {!visibleProducts || visibleProducts.length === 0 ? (
                                <div className="bg-white dark:bg-gray-800 p-8 sm:p-12 rounded-2xl text-center border border-gray-200 dark:border-gray-700">
                                    <p className="text-gray-500 font-bold">
                                        {productStatusFilter === 'draft'
                                            ? 'No draft products. Products you archive will show up here.'
                                            : 'No active products. Check the Draft or All filter.'}
                                    </p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                    {visibleProducts.map(p => {
                                        const primaryImg = p.images?.find(i => i.is_primary)?.image_url || p.images?.[0]?.image_url || '';
                                        return (
                                            <div key={p.id} className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-4 sm:p-5 shadow-lg flex flex-col justify-between">
                                                <div className="space-y-4">
                                                    <div className="h-48 w-full bg-gray-100 dark:bg-gray-900 rounded-xl overflow-hidden relative flex items-center justify-center border border-gray-100 dark:border-gray-700">
                                                        {primaryImg ? (
                                                            <img src={primaryImg} alt={p.name} className="w-full h-full object-cover" />
                                                        ) : (
                                                            <div className="text-gray-400 text-xs italic">No image</div>
                                                        )}
                                                        <div className="absolute top-3 right-3 bg-sffl-navy/90 text-white text-[10px] font-black uppercase px-2.5 py-1 rounded-full">
                                                            ₦{p.price.toLocaleString()}
                                                        </div>
                                                    </div>

                                                    <div>
                                                        <div className="flex items-center justify-between gap-2">
                                                            <h3 className="font-black text-lg truncate min-w-0 dark:text-white">{p.name}</h3>
                                                            <span className={`text-[9px] font-black px-2 py-0.5 rounded-full shrink-0 ${p.is_active ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'}`}>
                                                                {p.is_active ? 'ACTIVE' : 'DRAFT'}
                                                            </span>
                                                        </div>
                                                        {p.tags && p.tags.length > 0 && (
                                                            <div className="flex flex-wrap gap-1 mt-1.5">
                                                                {p.tags.map(t => (
                                                                    <span key={t} className="inline-flex items-center gap-1 bg-sffl-red/10 text-sffl-red text-[10px] font-bold px-2 py-0.5 rounded-full">
                                                                        <TagIcon className="w-3 h-3" aria-hidden="true" />
                                                                        {t}
                                                                    </span>
                                                                ))}
                                                            </div>
                                                        )}
                                                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-2 min-h-8">
                                                            {p.description || 'No description provided.'}
                                                        </p>

                                                        <div className="grid grid-cols-3 gap-2 mt-4 text-[10px] bg-gray-50 dark:bg-gray-900/40 p-2 rounded-xl border border-gray-100 dark:border-gray-700 text-center">
                                                            <div>
                                                                <div className="text-gray-400 font-bold uppercase">Stock</div>
                                                                <div className={`font-black mt-0.5 ${p.quantity <= p.threshold ? 'text-red-500' : 'text-sffl-navy dark:text-white'}`}>
                                                                    {p.quantity}
                                                                </div>
                                                            </div>
                                                            <div>
                                                                <div className="text-gray-400 font-bold uppercase">Variants</div>
                                                                <div className="font-black mt-0.5 text-sffl-navy dark:text-white">{p.variants?.length || 0}</div>
                                                            </div>
                                                            <div>
                                                                <div className="text-gray-400 font-bold uppercase">Images</div>
                                                                <div className="font-black mt-0.5 text-sffl-navy dark:text-white">{p.images?.length || 0}</div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="grid grid-cols-1 min-[380px]:grid-cols-2 gap-2 mt-6 pt-4 border-t border-gray-100 dark:border-gray-700">
                                                    <Button variant="navy" icon={PencilSquareIcon} onClick={() => handleOpenEdit(p)}>
                                                        Edit Product
                                                    </Button>
                                                    {p.is_active ? (
                                                        <Button variant="warning" icon={ArchiveBoxArrowDownIcon} onClick={() => setPendingAction({ kind: 'archive', product: p })}>
                                                            Archive
                                                        </Button>
                                                    ) : (
                                                        <Button variant="success" icon={ArrowUturnLeftIcon} onClick={() => setPendingAction({ kind: 'reactivate', product: p })}>
                                                            Reactivate
                                                        </Button>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    )}
                </>
            )}

            {/* ORDERS TAB — the order reference (or the row menu) opens its detail page. */}
            {activeTab === 'ORDERS' && (
                <DataTable
                    data={ordersData?.data ?? NO_ORDERS}
                    columns={orderColumns}
                    getRowId={(o) => o.id}
                    loading={loadingOrders}
                    searchable={false}
                    serverPage={ordersPage}
                    totalServerPages={ordersData?.total_pages || 1}
                    onPageChange={setOrdersPage}
                    itemsPerPage={ORDERS_PAGE_SIZE}
                    emptyMessage="No orders found."
                    headerActions={
                        <>
                            <Select
                                value={paymentFilter}
                                onChange={(e) => { setPaymentFilter(e.target.value); setOrdersPage(1); }}
                                aria-label="Filter by payment status"
                                className="w-full sm:w-44"
                            >
                                <option value="">All Payments</option>
                                <option value="pending">Pending</option>
                                <option value="paid">Paid</option>
                                <option value="failed">Failed</option>
                            </Select>
                            <Select
                                value={fulfillmentFilter}
                                onChange={(e) => { setFulfillmentFilter(e.target.value); setOrdersPage(1); }}
                                aria-label="Filter by fulfillment status"
                                className="w-full sm:w-48"
                            >
                                <option value="">All Fulfillments</option>
                                <option value="pending">Pending</option>
                                <option value="shipped">Shipped</option>
                                <option value="delivered">Delivered</option>
                                <option value="cancelled">Cancelled</option>
                            </Select>
                        </>
                    }
                />
            )}

            {/* DISCOUNT CODES TAB */}
            {activeTab === 'DISCOUNTS' && <DiscountCodesPanel />}

            {/* Unified Product Editor (create + edit) */}
            {editor && (
                <Modal
                    open
                    onClose={handleCloseEditor}
                    title={editor.kind === 'edit' ? 'Edit Product' : 'Create Product'}
                    subtitle={editor.kind === 'edit' ? editor.product.name : undefined}
                    maxWidth="3xl"
                    footer={
                        <>
                            <Button variant="secondary" onClick={handleCloseEditor} disabled={busy}>
                                Cancel
                            </Button>
                            <Button type="submit" form="store-product-form" disabled={busy}>
                                {editor.kind === 'edit' ? 'Save Changes' : 'Create Product'}
                            </Button>
                        </>
                    }
                >
                        <form id="store-product-form" onSubmit={requestSaveEditor}>
                            <div className="space-y-6">
                            {/* ── Product details ─────────────────────────────── */}
                            <section className="space-y-4">
                                <h3 className="text-[10px] uppercase font-black tracking-widest text-sffl-red">Product Details</h3>

                                <Field label="Product name" htmlFor="store-product-name">
                                    <Input
                                        id="store-product-name"
                                        required
                                        type="text"
                                        placeholder="Team Jersey, Snapback Cap"
                                        value={formData.name}
                                        onChange={e => setFormData(d => ({ ...d, name: e.target.value }))}
                                    />
                                </Field>

                                <Field
                                    label="Description"
                                    htmlFor="store-product-description"
                                    hint="Tip: leave a blank line between paragraphs to render with spacing on the product page."
                                >
                                    <Textarea
                                        id="store-product-description"
                                        rows={8}
                                        value={formData.description}
                                        onChange={e => setFormData(d => ({ ...d, description: e.target.value }))}
                                        placeholder={'Describe the product. Leave a blank line between paragraphs.\n\nFabric · Fit · Care · What\'s in the box — anything a buyer wants to know.'}
                                        className="leading-relaxed"
                                    />
                                </Field>

                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                    <Field label="Price (₦)" htmlFor="store-product-price">
                                        <Input
                                            id="store-product-price"
                                            required
                                            type="number"
                                            min="0"
                                            value={formData.price}
                                            onChange={e => setFormData(d => ({ ...d, price: Number(e.target.value) }))}
                                        />
                                    </Field>
                                    <Field label="Quantity" htmlFor="store-product-quantity" hint="Base stock — ignored if variants exist.">
                                        <Input
                                            id="store-product-quantity"
                                            required
                                            type="number"
                                            min="0"
                                            value={formData.quantity}
                                            onChange={e => setFormData(d => ({ ...d, quantity: Number(e.target.value) }))}
                                        />
                                    </Field>
                                    <Field label="Threshold" htmlFor="store-product-threshold">
                                        <Input
                                            id="store-product-threshold"
                                            required
                                            type="number"
                                            min="0"
                                            value={formData.threshold}
                                            onChange={e => setFormData(d => ({ ...d, threshold: Number(e.target.value) }))}
                                        />
                                    </Field>
                                </div>

                                <Checkbox
                                    id="is_active"
                                    label="Active (visible in storefront)"
                                    checked={formData.is_active}
                                    onChange={e => setFormData(d => ({ ...d, is_active: e.target.checked }))}
                                />

                                {/* ── Product Tags ── */}
                                <div className="space-y-2 pt-2 border-t border-gray-100 dark:border-gray-700">
                                    <span className="block text-sm font-bold text-gray-700 dark:text-gray-300">
                                        Product tags <span className="text-sffl-red">* (Required)</span>
                                    </span>
                                    <div className="flex flex-wrap gap-2 items-center">
                                        {STANDARD_PRODUCT_TAGS.map(t => {
                                            const selected = formData.tags.includes(t);
                                            return (
                                                <Button
                                                    key={t}
                                                    variant={selected ? 'primary' : 'secondary'}
                                                    size="sm"
                                                    icon={selected ? CheckIcon : PlusIcon}
                                                    aria-pressed={selected}
                                                    className="rounded-full"
                                                    onClick={() => {
                                                        setFormData(d => ({
                                                            ...d,
                                                            tags: selected ? d.tags.filter(tag => tag !== t) : [...d.tags, t],
                                                        }));
                                                    }}
                                                >
                                                    {t}
                                                </Button>
                                            );
                                        })}

                                        {formData.tags.filter(t => !STANDARD_PRODUCT_TAGS.includes(t)).map(customTag => (
                                            <Button
                                                key={customTag}
                                                variant="navy"
                                                size="sm"
                                                icon={CheckIcon}
                                                className="rounded-full"
                                                aria-label={`Remove tag ${customTag}`}
                                                onClick={() => setFormData(d => ({ ...d, tags: d.tags.filter(tag => tag !== customTag) }))}
                                            >
                                                {customTag}
                                                <XMarkIcon className="w-3.5 h-3.5 opacity-70" aria-hidden="true" />
                                            </Button>
                                        ))}
                                    </div>

                                    <div className="flex items-center gap-2 pt-1">
                                        <Input
                                            type="text"
                                            placeholder="Add custom tag (e.g. Footwear, Caps)"
                                            aria-label="Custom tag"
                                            value={customTagInput}
                                            onChange={e => setCustomTagInput(e.target.value)}
                                            onKeyDown={e => {
                                                if (e.key === 'Enter') {
                                                    e.preventDefault();
                                                    handleAddCustomTag();
                                                }
                                            }}
                                            className="flex-1 min-w-0"
                                        />
                                        <Button variant="secondary" onClick={handleAddCustomTag} className="shrink-0">
                                            Add Tag
                                        </Button>
                                    </div>
                                </div>
                            </section>

                            {/* ── Options builder (defines variant dimensions) ── */}
                            <section className="space-y-3 pt-2 border-t border-gray-100 dark:border-gray-700">
                                <h3 className="text-[10px] uppercase font-black tracking-widest text-sffl-red">
                                    Options <span className="text-gray-400 normal-case font-bold ml-1">(up to {MAX_OPTIONS} — e.g. Size, Color, Age Group)</span>
                                </h3>

                                {options.length === 0 ? (
                                    <p className="text-sm text-gray-500 italic py-2">No options. Product is sold as a single SKU using base price + base quantity.</p>
                                ) : (
                                    <div className="space-y-3">
                                        {options.map((opt, optIdx) => (
                                            <div key={optIdx} className="bg-gray-50 dark:bg-gray-900/40 border border-gray-100 dark:border-gray-700 rounded-xl p-3 sm:p-4 space-y-3">
                                                <div className="flex flex-wrap items-end gap-3">
                                                    <Field label="Option name" htmlFor={`option-name-${optIdx}`} className="flex-1 min-w-40">
                                                        <Input
                                                            id={`option-name-${optIdx}`}
                                                            type="text"
                                                            placeholder="Size"
                                                            value={opt.name}
                                                            onChange={e => handleOptionNameChange(optIdx, e.target.value)}
                                                        />
                                                    </Field>
                                                    <Checkbox
                                                        label="Drives price"
                                                        checked={opt.drives_price}
                                                        onChange={() => handleDrivesPriceToggle(optIdx)}
                                                    />
                                                    <Button variant="danger" size="sm" icon={TrashIcon} onClick={() => handleRemoveOption(optIdx)}>
                                                        Remove
                                                    </Button>
                                                </div>

                                                <div className="space-y-2">
                                                    <span className="block text-sm font-bold text-gray-700 dark:text-gray-300">Values</span>
                                                    {opt.values.length > 0 && (
                                                        <div className="space-y-2">
                                                            {opt.values.map((val, valIdx) => (
                                                                <div key={valIdx} className="flex flex-wrap items-center gap-2 bg-white dark:bg-gray-700/40 border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-1">
                                                                    <span className="font-bold text-sm dark:text-white flex-1 min-w-20 wrap-break-word">{val.value}</span>
                                                                    {opt.drives_price && (
                                                                        <div className="flex items-center gap-1">
                                                                            <span className="text-[10px] font-bold text-gray-500 uppercase">₦</span>
                                                                            <Input
                                                                                type="number"
                                                                                min="0"
                                                                                placeholder="Price"
                                                                                aria-label={`Price for ${val.value}`}
                                                                                value={val.price ?? ''}
                                                                                onChange={e => handleOptionValuePrice(optIdx, valIdx, Number(e.target.value))}
                                                                                className="w-28"
                                                                            />
                                                                        </div>
                                                                    )}
                                                                    <IconButton
                                                                        icon={XMarkIcon}
                                                                        variant="danger"
                                                                        label={`Remove ${val.value}`}
                                                                        onClick={() => handleRemoveOptionValue(optIdx, valIdx)}
                                                                    />
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                    <div className="flex gap-2">
                                                        <Input
                                                            type="text"
                                                            placeholder={`Add ${opt.name || 'value'} (e.g. M, Navy)`}
                                                            aria-label={`Add ${opt.name || 'value'}`}
                                                            value={newOptionValue[optIdx] || ''}
                                                            onChange={e => setNewOptionValue(prev => {
                                                                const next = [...prev];
                                                                next[optIdx] = e.target.value;
                                                                return next;
                                                            })}
                                                            onKeyDown={e => {
                                                                if (e.key === 'Enter') {
                                                                    e.preventDefault();
                                                                    handleAddOptionValue(optIdx);
                                                                }
                                                            }}
                                                            className="flex-1 min-w-0"
                                                        />
                                                        <Button variant="navy" size="sm" icon={PlusIcon} onClick={() => handleAddOptionValue(optIdx)} className="shrink-0">
                                                            Add value
                                                        </Button>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {options.length < MAX_OPTIONS && (
                                    <Button variant="link" icon={PlusIcon} onClick={handleAddOption}>
                                        Add option
                                    </Button>
                                )}
                            </section>

                            {/* ── Variant grid (auto-generated combinations) ──── */}
                            {variants.length > 0 && (
                                <section className="space-y-3 pt-2 border-t border-gray-100 dark:border-gray-700">
                                    <h3 className="text-[10px] uppercase font-black tracking-widest text-sffl-red">
                                        Variants <span className="text-gray-400 normal-case font-bold ml-1">(auto-generated · {variants.length} {variants.length === 1 ? 'combo' : 'combos'})</span>
                                    </h3>
                                    <p className="text-[11px] text-gray-500">Set stock per combination. Optionally pin one of the product images so the gallery jumps to it when this variant is selected.</p>

                                    {variants.some(v => (Number(v.quantity) || 0) === 0) && (
                                        <div className="flex items-start gap-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-900 text-amber-800 dark:text-amber-300 text-xs font-bold px-4 py-2.5 rounded-xl">
                                            <ExclamationTriangleIcon className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
                                            <span>One or more variants have <strong>0 stock</strong>. The storefront will show those as sold out — including the whole product if every variant is at 0.</span>
                                        </div>
                                    )}

                                    <div className="space-y-2 max-h-[40vh] overflow-y-auto">
                                        {variants.map((v, index) => {
                                            const tuple = [v.option1_value, v.option2_value, v.option3_value].filter(Boolean).join(' · ');
                                            return (
                                                <div key={variantKey(v.option1_value, v.option2_value, v.option3_value)} className="grid grid-cols-12 gap-3 items-center bg-gray-50 dark:bg-gray-900/40 border border-gray-100 dark:border-gray-700 p-3 rounded-xl">
                                                    <div className="col-span-12 sm:col-span-5">
                                                        <div className="font-bold text-sm dark:text-white wrap-break-word">{tuple}</div>
                                                    </div>
                                                    <div className="col-span-6 sm:col-span-3">
                                                        <Field label="Stock" htmlFor={`variant-stock-${index}`}>
                                                            <Input
                                                                id={`variant-stock-${index}`}
                                                                type="number"
                                                                min="0"
                                                                value={v.quantity}
                                                                onChange={e => {
                                                                    const qty = Number(e.target.value) || 0;
                                                                    setVariants(prev => prev.map((x, i) => i === index ? { ...x, quantity: qty } : x));
                                                                }}
                                                            />
                                                        </Field>
                                                    </div>
                                                    <div className="col-span-6 sm:col-span-4 min-w-0">
                                                        <Field label="Image (optional)" htmlFor={`variant-image-${index}`}>
                                                            <Select
                                                                id={`variant-image-${index}`}
                                                                value={v.image_url}
                                                                onChange={e => {
                                                                    const url = e.target.value;
                                                                    setVariants(prev => prev.map((x, i) => i === index ? { ...x, image_url: url } : x));
                                                                }}
                                                                disabled={images.length === 0}
                                                            >
                                                                <option value="">{images.length === 0 ? 'Upload images first' : 'None'}</option>
                                                                {images.map((img, i) => (
                                                                    <option key={img.image_url} value={img.image_url}>
                                                                        Image {i + 1}{img.is_primary ? ' (primary)' : ''}
                                                                    </option>
                                                                ))}
                                                            </Select>
                                                        </Field>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </section>
                            )}

                            {/* ── Images ──────────────────────────────────────── */}
                            <section className="space-y-3 pt-2 border-t border-gray-100 dark:border-gray-700">
                                <h3 className="text-[10px] uppercase font-black tracking-widest text-sffl-red">Images <span className="text-gray-400 normal-case font-bold ml-1">(up to 5 — first is primary)</span></h3>

                                {images.length < 5 ? (
                                    <ImageUploadField
                                        label="Add Product Image"
                                        value={uploadTempImageUrl}
                                        onChange={handleImageUploaded}
                                        folder="news"
                                        mode="picker"
                                        helperText="Max 5 images. The first uploaded image is primary by default — change it below."
                                    />
                                ) : (
                                    <div className="bg-amber-50 border border-amber-200 text-amber-700 px-4 py-3 rounded-xl text-center font-bold text-xs">
                                        Maximum of 5 images reached. Remove one to add more.
                                    </div>
                                )}

                                {images.length === 0 ? (
                                    <p className="text-sm text-gray-500 italic py-2 text-center">No images added yet.</p>
                                ) : (
                                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                        {images.map((img, index) => (
                                            <div key={index} className="bg-gray-50 dark:bg-gray-900/40 border border-gray-100 dark:border-gray-700 rounded-xl p-2 space-y-2">
                                                <div className="h-24 bg-gray-100 dark:bg-gray-900 rounded-lg overflow-hidden">
                                                    <img src={img.image_url} alt="" className="w-full h-full object-cover" />
                                                </div>
                                                <div className="flex flex-wrap items-center justify-between gap-x-2 text-[10px]">
                                                    <label className="flex items-center gap-1 min-h-11 cursor-pointer dark:text-gray-300">
                                                        <input
                                                            type="radio"
                                                            checked={img.is_primary}
                                                            onChange={() => handleSetPrimaryImage(index)}
                                                            className="w-3 h-3 accent-sffl-red"
                                                        />
                                                        Primary
                                                    </label>
                                                    <Button variant="link" size="sm" onClick={() => handleRemoveImage(index)}>
                                                        Remove
                                                    </Button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </section>

                            </div>

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
