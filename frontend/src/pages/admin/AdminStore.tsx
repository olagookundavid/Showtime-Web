import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
    getAdminStoreProducts,
    createAdminStoreProduct,
    updateAdminStoreProduct,
    deleteAdminStoreProduct,
    saveAdminProductVariants,
    saveAdminProductImages,
    getAdminOrders,
    updateOrderFulfillment,
    verifyAdminStoreOrder,
    type StoreProduct,
    type ProductVariant,
    type ProductImage,
    type Order,
} from '../../services/api';
import { Loader } from '../../components/ui/Loader';
import { ImageUploadField } from '../../components/ui/ImageUploadField';

type Tab = 'PRODUCTS' | 'ORDERS';
type MediaTab = 'VARIANTS' | 'IMAGES';

type ProductFormData = {
    name: string;
    sku: string;
    description: string;
    price: number;
    quantity: number;
    threshold: number;
    is_active: boolean;
};

const emptyProductForm: ProductFormData = {
    name: '',
    sku: '',
    description: '',
    price: 0,
    quantity: 0,
    threshold: 5,
    is_active: true,
};

type VariantDraft = Omit<ProductVariant, 'id'>;
type ImageDraft = Omit<ProductImage, 'id'>;

const emptyVariantDraft: VariantDraft = {
    variant_name: '',
    variant_value: '',
    sku: '',
    price: 0,
    quantity: 0,
};

export const AdminStore = () => {
    const queryClient = useQueryClient();

    const [activeTab, setActiveTab] = useState<Tab>('PRODUCTS');

    // Product form state
    const [isAdding, setIsAdding] = useState(false);
    const [isEditing, setIsEditing] = useState<StoreProduct | null>(null);
    const [formData, setFormData] = useState<ProductFormData>(emptyProductForm);

    // Media manager state (variants + images for a product)
    const [activeProductForMedia, setActiveProductForMedia] = useState<StoreProduct | null>(null);
    const [mediaTab, setMediaTab] = useState<MediaTab>('VARIANTS');
    const [variants, setVariants] = useState<VariantDraft[]>([]);
    const [images, setImages] = useState<ImageDraft[]>([]);
    const [newVariant, setNewVariant] = useState<VariantDraft>(emptyVariantDraft);
    const [uploadTempImageUrl, setUploadTempImageUrl] = useState('');

    // Orders state
    const [ordersPage, setOrdersPage] = useState(1);
    const [paymentFilter, setPaymentFilter] = useState('');
    const [fulfillmentFilter, setFulfillmentFilter] = useState('');
    const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
    const [updatingOrderFulfillmentId, setUpdatingOrderFulfillmentId] = useState<string | null>(null);
    const [verifyingOrderId, setVerifyingOrderId] = useState<string | null>(null);

    // Queries
    const { data: products, isLoading: loadingProducts } = useQuery({
        queryKey: ['adminStoreProducts'],
        queryFn: getAdminStoreProducts,
    });

    const { data: ordersData, isLoading: loadingOrders } = useQuery({
        queryKey: ['adminOrders', ordersPage, paymentFilter, fulfillmentFilter],
        queryFn: () => getAdminOrders(ordersPage, 20, paymentFilter || undefined, fulfillmentFilter || undefined),
        enabled: activeTab === 'ORDERS',
    });

    // ─── Product CRUD ─────────────────────────────────────────────────────
    const handleOpenAdd = () => {
        setFormData(emptyProductForm);
        setIsEditing(null);
        setIsAdding(true);
    };

    const handleOpenEdit = (p: StoreProduct) => {
        setFormData({
            name: p.name,
            sku: p.sku || '',
            description: p.description || '',
            price: p.price,
            quantity: p.quantity,
            threshold: p.threshold,
            is_active: p.is_active,
        });
        setIsAdding(false);
        setIsEditing(p);
    };

    const handleCloseForm = () => {
        setIsAdding(false);
        setIsEditing(null);
    };

    const handleSubmitProduct = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const payload = {
                name: formData.name,
                sku: formData.sku,
                description: formData.description,
                price: Number(formData.price),
                quantity: Number(formData.quantity),
                threshold: Number(formData.threshold),
                is_active: formData.is_active,
            };

            if (isEditing) {
                await updateAdminStoreProduct(isEditing.id, payload);
                alert('Product updated successfully.');
            } else {
                await createAdminStoreProduct(payload);
                alert('Product created. Click "Options & Media" to add variants and images.');
            }
            queryClient.invalidateQueries({ queryKey: ['adminStoreProducts'] });
            handleCloseForm();
        } catch (err: any) {
            alert(err.response?.data?.error || err.message || 'Failed to save product');
        }
    };

    const handleDeleteProduct = async (id: string) => {
        if (!confirm('Are you sure you want to delete this product?')) return;
        try {
            await deleteAdminStoreProduct(id);
            queryClient.invalidateQueries({ queryKey: ['adminStoreProducts'] });
            alert('Product deleted.');
        } catch (err: any) {
            alert(err.response?.data?.error || err.message || 'Failed to delete product');
        }
    };

    // ─── Media Manager (variants + images) ────────────────────────────────
    const handleOpenMediaManager = (product: StoreProduct) => {
        setActiveProductForMedia(product);
        setMediaTab('VARIANTS');
        setVariants((product.variants || []).map(v => ({
            variant_name: v.variant_name,
            variant_value: v.variant_value,
            sku: v.sku,
            price: v.price,
            quantity: v.quantity,
        })));
        setImages((product.images || []).map(img => ({
            image_url: img.image_url,
            is_primary: img.is_primary,
            display_order: img.display_order,
        })));
        setNewVariant(emptyVariantDraft);
        setUploadTempImageUrl('');
    };

    const handleCloseMediaManager = () => {
        setActiveProductForMedia(null);
    };

    const handleAddVariant = () => {
        if (!newVariant.variant_name.trim() || !newVariant.variant_value.trim()) {
            alert('Option name (e.g. Size) and value (e.g. M) are required.');
            return;
        }
        setVariants(prev => [...prev, {
            variant_name: newVariant.variant_name.trim(),
            variant_value: newVariant.variant_value.trim(),
            sku: newVariant.sku.trim(),
            price: Number(newVariant.price) || 0,
            quantity: Number(newVariant.quantity) || 0,
        }]);
        setNewVariant(emptyVariantDraft);
    };

    const handleRemoveVariant = (index: number) => {
        setVariants(prev => prev.filter((_, i) => i !== index));
    };

    const handleSaveVariants = async () => {
        if (!activeProductForMedia) return;
        try {
            await saveAdminProductVariants(activeProductForMedia.id, variants);
            queryClient.invalidateQueries({ queryKey: ['adminStoreProducts'] });
            alert('Variants saved.');
        } catch (err: any) {
            alert(err.response?.data?.error || err.message || 'Failed to save variants');
        }
    };

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
        setUploadTempImageUrl('');
    };

    const handleSetPrimaryImage = (index: number) => {
        setImages(prev => prev.map((img, i) => ({ ...img, is_primary: i === index })));
    };

    const handleRemoveImage = (index: number) => {
        setImages(prev => prev.filter((_, i) => i !== index));
    };

    const handleSaveImages = async () => {
        if (!activeProductForMedia) return;
        try {
            await saveAdminProductImages(activeProductForMedia.id, images);
            queryClient.invalidateQueries({ queryKey: ['adminStoreProducts'] });
            alert('Images saved.');
        } catch (err: any) {
            alert(err.response?.data?.error || err.message || 'Failed to save images');
        }
    };

    // ─── Orders ───────────────────────────────────────────────────────────
    const handleFulfillOrder = async (orderId: string, nextStatus: 'shipped' | 'delivered') => {
        setUpdatingOrderFulfillmentId(orderId);
        try {
            const updated = await updateOrderFulfillment(orderId, nextStatus);
            queryClient.invalidateQueries({ queryKey: ['adminOrders'] });
            if (selectedOrder?.id === orderId) setSelectedOrder(updated);
        } catch (err: any) {
            alert(err.response?.data?.error || err.message || 'Failed to update fulfillment');
        } finally {
            setUpdatingOrderFulfillmentId(null);
        }
    };

    const handleVerifyOrder = async (orderId: string) => {
        setVerifyingOrderId(orderId);
        try {
            const updated = await verifyAdminStoreOrder(orderId);
            queryClient.invalidateQueries({ queryKey: ['adminOrders'] });
            if (selectedOrder?.id === orderId) setSelectedOrder(updated);
            alert(`Payment status: ${updated.payment_status.toUpperCase()}`);
        } catch (err: any) {
            alert(err.response?.data?.error || err.message || 'Failed to verify payment');
        } finally {
            setVerifyingOrderId(null);
        }
    };

    return (
        <div className="space-y-6 pb-12">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black text-sffl-navy dark:text-white">Online Store Manager</h1>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                        Manage e-commerce products, variants, image assets, and order fulfillment.
                    </p>
                </div>
                {activeTab === 'PRODUCTS' && (
                    <button
                        onClick={handleOpenAdd}
                        className="bg-sffl-red hover:bg-red-700 text-white px-6 py-3 rounded-2xl font-black tracking-wider text-xs uppercase shadow-lg transition-all hover:scale-[1.02] active:scale-95"
                    >
                        + Create Product
                    </button>
                )}
            </div>

            {/* Tabs */}
            <div className="flex border-b border-gray-200 dark:border-gray-700 gap-2">
                {(['PRODUCTS', 'ORDERS'] as Tab[]).map(tab => (
                    <button
                        key={tab}
                        onClick={() => { setActiveTab(tab); setSelectedOrder(null); }}
                        className={`px-6 py-3 text-xs font-black uppercase tracking-wider border-b-2 transition-all ${
                            activeTab === tab
                                ? 'border-sffl-red text-sffl-red'
                                : 'border-transparent text-gray-500 hover:text-sffl-navy dark:hover:text-white'
                        }`}
                    >
                        {tab === 'PRODUCTS' ? '🛒 Catalog Products' : '📦 Online Orders'}
                    </button>
                ))}
            </div>

            {/* PRODUCTS TAB */}
            {activeTab === 'PRODUCTS' && (
                <>
                    {loadingProducts ? (
                        <div className="flex justify-center py-12"><Loader /></div>
                    ) : !products || products.length === 0 ? (
                        <div className="bg-white dark:bg-gray-800 p-12 rounded-2xl text-center border border-gray-200 dark:border-gray-700">
                            <p className="text-gray-500 font-bold">No products yet. Click "+ Create Product" to add your first item.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {products.map(p => {
                                const primaryImg = p.images?.find(i => i.is_primary)?.image_url || p.images?.[0]?.image_url || '';
                                return (
                                    <div key={p.id} className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 shadow-lg flex flex-col justify-between">
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
                                                    <h3 className="font-black text-lg truncate dark:text-white">{p.name}</h3>
                                                    <span className={`text-[9px] font-black px-2 py-0.5 rounded-full flex-shrink-0 ${p.is_active ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'}`}>
                                                        {p.is_active ? 'ACTIVE' : 'DRAFT'}
                                                    </span>
                                                </div>
                                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-2 min-h-[32px]">
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

                                        <div className="grid grid-cols-2 gap-2 mt-6 pt-4 border-t border-gray-100 dark:border-gray-700">
                                            <button
                                                onClick={() => handleOpenMediaManager(p)}
                                                className="bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-sffl-navy dark:text-white px-3 py-2.5 rounded-xl font-bold text-xs"
                                            >
                                                ⚙️ Options & Media
                                            </button>
                                            <button
                                                onClick={() => handleOpenEdit(p)}
                                                className="bg-sffl-navy hover:bg-slate-900 text-white px-3 py-2.5 rounded-xl font-bold text-xs"
                                            >
                                                ✏️ Edit Details
                                            </button>
                                            <button
                                                onClick={() => handleDeleteProduct(p.id)}
                                                className="col-span-2 bg-red-50 hover:bg-red-600 text-red-600 hover:text-white dark:bg-red-900/30 dark:text-red-400 dark:hover:bg-red-600 dark:hover:text-white py-2 rounded-xl font-bold text-xs"
                                            >
                                                🗑️ Delete Product
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </>
            )}

            {/* ORDERS TAB */}
            {activeTab === 'ORDERS' && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
                    {/* Orders list */}
                    <div className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 shadow-lg space-y-4">
                        <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center pb-4 border-b border-gray-100 dark:border-gray-700">
                            <h3 className="font-black text-xl dark:text-white">Order Logs</h3>
                            <div className="flex flex-wrap gap-2">
                                <select
                                    value={paymentFilter}
                                    onChange={(e) => { setPaymentFilter(e.target.value); setOrdersPage(1); }}
                                    className="bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-xs px-3 py-2 rounded-xl font-bold dark:text-white"
                                >
                                    <option value="">All Payments</option>
                                    <option value="pending">Pending</option>
                                    <option value="paid">Paid</option>
                                    <option value="failed">Failed</option>
                                </select>
                                <select
                                    value={fulfillmentFilter}
                                    onChange={(e) => { setFulfillmentFilter(e.target.value); setOrdersPage(1); }}
                                    className="bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-xs px-3 py-2 rounded-xl font-bold dark:text-white"
                                >
                                    <option value="">All Fulfillments</option>
                                    <option value="pending">Pending</option>
                                    <option value="shipped">Shipped</option>
                                    <option value="delivered">Delivered</option>
                                </select>
                            </div>
                        </div>

                        {loadingOrders ? (
                            <div className="flex justify-center py-12"><Loader /></div>
                        ) : !ordersData || ordersData.data.length === 0 ? (
                            <p className="text-gray-500 font-bold text-center py-6">No orders found.</p>
                        ) : (
                            <>
                                <div className="space-y-3">
                                    {ordersData.data.map(order => {
                                        const isSelected = selectedOrder?.id === order.id;
                                        return (
                                            <div
                                                key={order.id}
                                                onClick={() => setSelectedOrder(order)}
                                                className={`p-4 rounded-xl border cursor-pointer transition-all ${
                                                    isSelected
                                                        ? 'border-sffl-red bg-sffl-red/5'
                                                        : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                                                }`}
                                            >
                                                <div className="flex flex-col md:flex-row justify-between md:items-center gap-2">
                                                    <div>
                                                        <div className="flex items-center gap-2 flex-wrap">
                                                            <span className="font-black text-sm text-sffl-red">{order.order_reference}</span>
                                                            <span className={`text-[9px] font-black px-2 py-0.5 rounded-full uppercase ${
                                                                order.payment_status === 'paid'
                                                                    ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                                                                    : order.payment_status === 'failed'
                                                                        ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                                                                        : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                                                            }`}>
                                                                {order.payment_status}
                                                            </span>
                                                            <span className="text-[9px] font-black px-2 py-0.5 rounded-full uppercase bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                                                                {order.fulfillment_status}
                                                            </span>
                                                        </div>
                                                        <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                                            {order.customer_name} • {order.customer_phone}
                                                        </div>
                                                    </div>
                                                    <div className="text-right">
                                                        <div className="font-black text-sm dark:text-white">₦{order.total_amount.toLocaleString()}</div>
                                                        <div className="text-[10px] text-gray-400 mt-0.5">{new Date(order.created_at).toLocaleDateString()}</div>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>

                                {ordersData.total_pages > 1 && (
                                    <div className="flex justify-between items-center pt-4 border-t border-gray-100 dark:border-gray-700">
                                        <button
                                            disabled={ordersPage === 1}
                                            onClick={() => setOrdersPage(p => Math.max(1, p - 1))}
                                            className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-xs font-bold rounded-xl disabled:opacity-50 dark:text-white"
                                        >
                                            Previous
                                        </button>
                                        <span className="text-xs text-gray-500 font-bold">Page {ordersPage} of {ordersData.total_pages}</span>
                                        <button
                                            disabled={ordersPage >= ordersData.total_pages}
                                            onClick={() => setOrdersPage(p => p + 1)}
                                            className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-xs font-bold rounded-xl disabled:opacity-50 dark:text-white"
                                        >
                                            Next
                                        </button>
                                    </div>
                                )}
                            </>
                        )}
                    </div>

                    {/* Order Detail */}
                    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 shadow-lg space-y-5">
                        <h3 className="font-black text-xl dark:text-white pb-2 border-b border-gray-100 dark:border-gray-700">Order Details</h3>
                        {!selectedOrder ? (
                            <p className="text-sm text-gray-500 italic py-6 text-center">Select an order to see full details.</p>
                        ) : (
                            <div className="space-y-5 text-sm dark:text-gray-300">
                                <div className="space-y-1.5">
                                    <div className="flex justify-between">
                                        <span className="text-gray-400 font-bold">Reference</span>
                                        <span className="font-black text-sffl-red">{selectedOrder.order_reference}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-gray-400 font-bold">Date</span>
                                        <span className="font-bold">{new Date(selectedOrder.created_at).toLocaleString()}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-gray-400 font-bold">Payment</span>
                                        <span className={`font-black uppercase ${selectedOrder.payment_status === 'paid' ? 'text-green-600' : selectedOrder.payment_status === 'failed' ? 'text-red-600' : 'text-amber-600'}`}>
                                            {selectedOrder.payment_status}
                                        </span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-gray-400 font-bold">Fulfillment</span>
                                        <span className="font-black uppercase text-blue-600 dark:text-blue-400">{selectedOrder.fulfillment_status}</span>
                                    </div>
                                </div>

                                <div className="border-t border-gray-100 dark:border-gray-700 pt-4 space-y-1.5 text-xs">
                                    <h4 className="font-black uppercase text-[10px] tracking-wider text-gray-500 mb-2">Customer</h4>
                                    <div><strong>Name:</strong> {selectedOrder.customer_name}</div>
                                    <div><strong>Email:</strong> {selectedOrder.customer_email}</div>
                                    <div><strong>Phone:</strong> {selectedOrder.customer_phone}</div>
                                </div>

                                <div className="border-t border-gray-100 dark:border-gray-700 pt-4 text-xs space-y-1.5">
                                    <h4 className="font-black uppercase text-[10px] tracking-wider text-gray-500 mb-2">Shipping</h4>
                                    <div className="bg-gray-50 dark:bg-gray-900/40 p-3 rounded-xl border border-gray-100 dark:border-gray-700">
                                        <div>{selectedOrder.shipping_address}</div>
                                        <div>{selectedOrder.shipping_city}, {selectedOrder.shipping_state}</div>
                                        <div>{selectedOrder.shipping_country} {selectedOrder.shipping_postal_code}</div>
                                    </div>
                                </div>

                                <div className="border-t border-gray-100 dark:border-gray-700 pt-4 space-y-2">
                                    <h4 className="font-black uppercase text-[10px] tracking-wider text-gray-500">Items</h4>
                                    {selectedOrder.items?.map(item => (
                                        <div key={item.id} className="text-xs flex justify-between bg-gray-50 dark:bg-gray-900/40 p-2.5 rounded-xl border border-gray-100 dark:border-gray-700">
                                            <div>
                                                <div className="font-bold dark:text-white">{item.product_name}</div>
                                                {item.variant_name && (
                                                    <div className="text-[10px] text-gray-500 mt-0.5">
                                                        {item.variant_name}: {item.variant_value}
                                                    </div>
                                                )}
                                                <div className="text-[10px] text-gray-500 mt-0.5">Qty: {item.quantity}</div>
                                            </div>
                                            <div className="font-bold self-center dark:text-white">
                                                ₦{item.total_price.toLocaleString()}
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                <div className="border-t border-gray-100 dark:border-gray-700 pt-4 flex justify-between items-center">
                                    <span className="font-black uppercase text-xs">Total</span>
                                    <span className="font-black text-lg text-sffl-red">₦{selectedOrder.total_amount.toLocaleString()}</span>
                                </div>

                                {/* Actions */}
                                <div className="border-t border-gray-100 dark:border-gray-700 pt-4 space-y-2">
                                    {selectedOrder.payment_status !== 'paid' && (
                                        <button
                                            disabled={verifyingOrderId === selectedOrder.id}
                                            onClick={() => handleVerifyOrder(selectedOrder.id)}
                                            className="w-full bg-sffl-navy hover:bg-slate-900 text-white py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider disabled:opacity-50"
                                        >
                                            {verifyingOrderId === selectedOrder.id ? 'Verifying…' : '🔄 Re-verify Payment'}
                                        </button>
                                    )}
                                    {selectedOrder.payment_status === 'paid' && selectedOrder.fulfillment_status === 'pending' && (
                                        <button
                                            disabled={updatingOrderFulfillmentId === selectedOrder.id}
                                            onClick={() => handleFulfillOrder(selectedOrder.id, 'shipped')}
                                            className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider disabled:opacity-50"
                                        >
                                            🚢 Mark as Shipped
                                        </button>
                                    )}
                                    {selectedOrder.payment_status === 'paid' && selectedOrder.fulfillment_status === 'shipped' && (
                                        <button
                                            disabled={updatingOrderFulfillmentId === selectedOrder.id}
                                            onClick={() => handleFulfillOrder(selectedOrder.id, 'delivered')}
                                            className="w-full bg-green-600 hover:bg-green-700 text-white py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider disabled:opacity-50"
                                        >
                                            ✅ Mark as Delivered
                                        </button>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Create / Edit Product Modal */}
            {(isAdding || isEditing) && (
                <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl overflow-y-auto max-h-[90vh]">
                        <div className="flex justify-between items-center pb-4 border-b border-gray-100 dark:border-gray-700 mb-4">
                            <h2 className="text-xl font-black dark:text-white">
                                {isEditing ? 'Edit Product' : 'Create Product'}
                            </h2>
                            <button onClick={handleCloseForm} className="text-gray-400 hover:text-gray-600 dark:hover:text-white text-xl">✕</button>
                        </div>

                        <form onSubmit={handleSubmitProduct} className="space-y-4">
                            <div className="space-y-1">
                                <label className="text-xs font-bold uppercase text-gray-600 dark:text-gray-400 tracking-wider">Product Name</label>
                                <input
                                    required
                                    type="text"
                                    placeholder="Team Jersey, Snapback Cap…"
                                    value={formData.name}
                                    onChange={e => setFormData(d => ({ ...d, name: e.target.value }))}
                                    className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm dark:text-white outline-none focus:ring-2 focus:ring-sffl-red/40"
                                />
                            </div>

                            <div className="space-y-1">
                                <label className="text-xs font-bold uppercase text-gray-600 dark:text-gray-400 tracking-wider">SKU (Optional)</label>
                                <input
                                    type="text"
                                    placeholder="e.g. SFFL-JRSY-001"
                                    value={formData.sku}
                                    onChange={e => setFormData(d => ({ ...d, sku: e.target.value }))}
                                    className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm dark:text-white outline-none focus:ring-2 focus:ring-sffl-red/40"
                                />
                            </div>

                            <div className="space-y-1">
                                <label className="text-xs font-bold uppercase text-gray-600 dark:text-gray-400 tracking-wider">Description</label>
                                <textarea
                                    rows={3}
                                    value={formData.description}
                                    onChange={e => setFormData(d => ({ ...d, description: e.target.value }))}
                                    className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm dark:text-white outline-none focus:ring-2 focus:ring-sffl-red/40 resize-none"
                                />
                            </div>

                            <div className="grid grid-cols-3 gap-3">
                                <div className="space-y-1">
                                    <label className="text-xs font-bold uppercase text-gray-600 dark:text-gray-400 tracking-wider">Price (₦)</label>
                                    <input
                                        required
                                        type="number"
                                        min="0"
                                        value={formData.price}
                                        onChange={e => setFormData(d => ({ ...d, price: Number(e.target.value) }))}
                                        className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm dark:text-white outline-none focus:ring-2 focus:ring-sffl-red/40"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-bold uppercase text-gray-600 dark:text-gray-400 tracking-wider">Quantity</label>
                                    <input
                                        required
                                        type="number"
                                        min="0"
                                        value={formData.quantity}
                                        onChange={e => setFormData(d => ({ ...d, quantity: Number(e.target.value) }))}
                                        className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm dark:text-white outline-none focus:ring-2 focus:ring-sffl-red/40"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-bold uppercase text-gray-600 dark:text-gray-400 tracking-wider">Threshold</label>
                                    <input
                                        required
                                        type="number"
                                        min="0"
                                        value={formData.threshold}
                                        onChange={e => setFormData(d => ({ ...d, threshold: Number(e.target.value) }))}
                                        className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm dark:text-white outline-none focus:ring-2 focus:ring-sffl-red/40"
                                    />
                                </div>
                            </div>

                            <div className="flex items-center gap-2">
                                <input
                                    id="is_active"
                                    type="checkbox"
                                    checked={formData.is_active}
                                    onChange={e => setFormData(d => ({ ...d, is_active: e.target.checked }))}
                                    className="w-4 h-4 accent-sffl-red"
                                />
                                <label htmlFor="is_active" className="text-sm font-medium dark:text-gray-300 select-none cursor-pointer">
                                    Active (visible in storefront)
                                </label>
                            </div>

                            <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 dark:border-gray-700">
                                <button
                                    type="button"
                                    onClick={handleCloseForm}
                                    className="px-5 py-2.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl font-bold text-xs uppercase tracking-wider"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="px-6 py-2.5 bg-sffl-red hover:bg-red-700 text-white rounded-xl font-bold text-xs uppercase tracking-wider"
                                >
                                    {isEditing ? 'Save Changes' : 'Create Product'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Media Manager Modal */}
            {activeProductForMedia && (
                <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-3xl w-full p-6 shadow-2xl overflow-y-auto max-h-[90vh] space-y-6">
                        <div className="flex justify-between items-center pb-3 border-b border-gray-100 dark:border-gray-700">
                            <div>
                                <h3 className="text-xl font-black text-sffl-red uppercase">Options & Media</h3>
                                <p className="text-[11px] text-gray-500 mt-0.5">{activeProductForMedia.name}</p>
                            </div>
                            <button onClick={handleCloseMediaManager} className="text-gray-400 hover:text-gray-600 dark:hover:text-white text-xl">✕</button>
                        </div>

                        {/* Sub-tabs */}
                        <div className="flex gap-2 border-b border-gray-100 dark:border-gray-700">
                            <button
                                onClick={() => setMediaTab('VARIANTS')}
                                className={`px-4 py-2 text-xs font-black uppercase tracking-wider border-b-2 ${mediaTab === 'VARIANTS' ? 'border-sffl-red text-sffl-red' : 'border-transparent text-gray-500'}`}
                            >
                                👚 Variants
                            </button>
                            <button
                                onClick={() => setMediaTab('IMAGES')}
                                className={`px-4 py-2 text-xs font-black uppercase tracking-wider border-b-2 ${mediaTab === 'IMAGES' ? 'border-sffl-red text-sffl-red' : 'border-transparent text-gray-500'}`}
                            >
                                🖼️ Images
                            </button>
                        </div>

                        {/* Variants Tab */}
                        {mediaTab === 'VARIANTS' && (
                            <div className="space-y-5">
                                <div className="bg-gray-50 dark:bg-gray-900/40 p-4 rounded-xl border border-gray-100 dark:border-gray-700 space-y-3">
                                    <h4 className="text-[10px] uppercase font-black tracking-widest text-sffl-red">Add Variant</h4>
                                    <div className="grid grid-cols-2 md:grid-cols-5 gap-3 items-end text-xs">
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-bold text-gray-500 uppercase">Name</label>
                                            <input
                                                type="text"
                                                placeholder="Size"
                                                value={newVariant.variant_name}
                                                onChange={e => setNewVariant(v => ({ ...v, variant_name: e.target.value }))}
                                                className="w-full bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg px-2 py-2 dark:text-white"
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-bold text-gray-500 uppercase">Value</label>
                                            <input
                                                type="text"
                                                placeholder="M"
                                                value={newVariant.variant_value}
                                                onChange={e => setNewVariant(v => ({ ...v, variant_value: e.target.value }))}
                                                className="w-full bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg px-2 py-2 dark:text-white"
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-bold text-gray-500 uppercase">Price (₦)</label>
                                            <input
                                                type="number"
                                                min="0"
                                                placeholder="0"
                                                value={newVariant.price}
                                                onChange={e => setNewVariant(v => ({ ...v, price: Number(e.target.value) }))}
                                                className="w-full bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg px-2 py-2 dark:text-white"
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-bold text-gray-500 uppercase">Qty</label>
                                            <input
                                                type="number"
                                                min="0"
                                                value={newVariant.quantity}
                                                onChange={e => setNewVariant(v => ({ ...v, quantity: Number(e.target.value) }))}
                                                className="w-full bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg px-2 py-2 dark:text-white"
                                            />
                                        </div>
                                        <button
                                            type="button"
                                            onClick={handleAddVariant}
                                            className="bg-sffl-navy hover:bg-slate-900 text-white font-black py-2.5 rounded-lg uppercase tracking-wider text-[10px]"
                                        >
                                            + Add
                                        </button>
                                    </div>
                                </div>

                                {variants.length === 0 ? (
                                    <p className="text-sm text-gray-500 italic py-3 text-center">No variants yet. Product uses base price + base quantity.</p>
                                ) : (
                                    <div className="space-y-2 max-h-[30vh] overflow-y-auto">
                                        {variants.map((v, index) => (
                                            <div key={index} className="flex justify-between items-center bg-gray-50 dark:bg-gray-900/40 border border-gray-100 dark:border-gray-700 p-3 rounded-xl">
                                                <div>
                                                    <div className="font-bold text-sm dark:text-white">
                                                        {v.variant_name}: <span className="text-sffl-red">{v.variant_value}</span>
                                                    </div>
                                                    <div className="text-[10px] text-gray-500 mt-0.5">
                                                        {v.price > 0 ? `₦${v.price.toLocaleString()}` : 'Base price'} • Stock: {v.quantity}
                                                    </div>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => handleRemoveVariant(index)}
                                                    className="text-red-500 bg-red-50 dark:bg-red-900/20 px-3 py-1.5 rounded-lg text-[10px] font-bold"
                                                >
                                                    Remove
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                <div className="flex justify-end pt-4 border-t border-gray-100 dark:border-gray-700">
                                    <button
                                        type="button"
                                        onClick={handleSaveVariants}
                                        className="bg-sffl-red hover:bg-red-700 text-white px-6 py-3 rounded-xl font-bold text-xs uppercase tracking-wider"
                                    >
                                        💾 Save Variants
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Images Tab */}
                        {mediaTab === 'IMAGES' && (
                            <div className="space-y-5">
                                {images.length < 5 ? (
                                    <ImageUploadField
                                        label="Upload Product Image"
                                        value={uploadTempImageUrl}
                                        onChange={handleImageUploaded}
                                        folder="news"
                                        helperText="Max 5 images. First image becomes primary by default."
                                    />
                                ) : (
                                    <div className="bg-amber-50 border border-amber-200 text-amber-700 px-4 py-3 rounded-xl text-center font-bold text-xs">
                                        Maximum of 5 images reached. Remove one to add more.
                                    </div>
                                )}

                                {images.length === 0 ? (
                                    <p className="text-sm text-gray-500 italic py-3 text-center">No images added yet.</p>
                                ) : (
                                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                        {images.map((img, index) => (
                                            <div key={index} className="bg-gray-50 dark:bg-gray-900/40 border border-gray-100 dark:border-gray-700 rounded-xl p-2 space-y-2">
                                                <div className="h-24 bg-gray-100 dark:bg-gray-900 rounded-lg overflow-hidden">
                                                    <img src={img.image_url} alt="" className="w-full h-full object-cover" />
                                                </div>
                                                <div className="flex items-center justify-between text-[10px]">
                                                    <label className="flex items-center gap-1 cursor-pointer dark:text-gray-300">
                                                        <input
                                                            type="radio"
                                                            checked={img.is_primary}
                                                            onChange={() => handleSetPrimaryImage(index)}
                                                            className="w-3 h-3 accent-sffl-red"
                                                        />
                                                        Primary
                                                    </label>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleRemoveImage(index)}
                                                        className="text-red-500 font-bold"
                                                    >
                                                        Remove
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                <div className="flex justify-end pt-4 border-t border-gray-100 dark:border-gray-700">
                                    <button
                                        type="button"
                                        onClick={handleSaveImages}
                                        className="bg-sffl-red hover:bg-red-700 text-white px-6 py-3 rounded-xl font-bold text-xs uppercase tracking-wider"
                                    >
                                        💾 Save Images
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};
