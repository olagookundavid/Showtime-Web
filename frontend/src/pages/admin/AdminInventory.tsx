import { useMemo, useState, type ComponentType, type FormEvent } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
    BanknotesIcon,
    ChartBarIcon,
    Cog6ToothIcon,
    CubeIcon,
    ExclamationTriangleIcon,
    PencilSquareIcon,
    PlusIcon,
    TrashIcon,
} from '@heroicons/react/24/outline';
import {
    getAdminProducts,
    getAdminLowStockAlerts,
    createAdminProduct,
    updateAdminProduct,
    deleteAdminProduct,
    getAdminSales,
    getAdminSalesReport,
    getAdminPaymentMethods,
    createAdminPaymentMethod,
    toggleAdminPaymentMethod,
    type InventoryProduct,
    type InventorySale,
    type PaymentMethod
} from '../../services/api';
import { Loader } from '../../components/ui/Loader';
import { DataTable, type Column } from '../../components/ui/DataTable';
import { RowActions } from '../../components/ui/RowActions';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { ConfirmSummary } from '../../components/ui/ConfirmSummary';
import { Button, Checkbox, Field, Input, Modal, Select, Textarea } from '../../components/ui';
import { getApiErrorMessage } from '../../utils/apiError';
import { DashboardPageHeader } from '../../components/dashboard/DashboardPageHeader';

type Tab = 'PRODUCTS' | 'SALES' | 'REPORTS' | 'SETTINGS';

const TABS: { key: Tab; label: string; icon: ComponentType<{ className?: string }> }[] = [
    { key: 'PRODUCTS', label: 'Products', icon: CubeIcon },
    { key: 'SALES', label: 'Sales Log', icon: BanknotesIcon },
    { key: 'REPORTS', label: 'Reports', icon: ChartBarIcon },
    { key: 'SETTINGS', label: 'Settings', icon: Cog6ToothIcon },
];

const NO_PRODUCTS: InventoryProduct[] = [];
const NO_SALES: InventorySale[] = [];
const NO_METHODS: PaymentMethod[] = [];

const PRODUCT_PAGE_SIZE = 20;
const SALES_PAGE_SIZE = 30;

type ProductForm = { name: string; description: string; price: number; quantity: number; threshold: number; is_active: boolean };

const emptyProductForm: ProductForm = { name: '', description: '', price: 0, quantity: 0, threshold: 10, is_active: true };

type PendingAction =
    | { kind: 'saveProduct' }
    | { kind: 'deleteProduct'; product: InventoryProduct }
    | { kind: 'addMethod' }
    | { kind: 'toggleMethod'; method: PaymentMethod };

const FAILURE: Record<PendingAction['kind'], string> = {
    saveProduct: 'Failed to save product',
    deleteProduct: 'Failed to delete product',
    addMethod: 'Failed to create payment method',
    toggleMethod: 'Failed to toggle payment method',
};

export const AdminInventory = () => {
    const queryClient = useQueryClient();
    const [activeTab, setActiveTab] = useState<Tab>('PRODUCTS');

    // Every write waits here for the confirm dialog
    const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
    const [busy, setBusy] = useState(false);

    // -- Products State --
    const [productPage, setProductPage] = useState(1);
    const [productSearch, setProductSearch] = useState('');
    const [isEditing, setIsEditing] = useState<InventoryProduct | null>(null);
    const [isAdding, setIsAdding] = useState(false);
    const [formData, setFormData] = useState<ProductForm>(emptyProductForm);

    // -- Sales State --
    const [salesPage, setSalesPage] = useState(1);
    const [salesFromDate, setSalesFromDate] = useState('');
    const [salesToDate, setSalesToDate] = useState('');
    const [appliedSalesFrom, setAppliedSalesFrom] = useState('');
    const [appliedSalesTo, setAppliedSalesTo] = useState('');

    // -- Reports State --
    const [reportPeriod, setReportPeriod] = useState<'daily' | 'weekly' | 'monthly' | 'custom'>('daily');
    const [reportFromDate, setReportFromDate] = useState('');
    const [reportToDate, setReportToDate] = useState('');
    const [appliedReportFrom, setAppliedReportFrom] = useState('');
    const [appliedReportTo, setAppliedReportTo] = useState('');

    const [newPaymentMethod, setNewPaymentMethod] = useState('');

    const handleApplySalesFilter = () => {
        if ((salesFromDate && !salesToDate) || (!salesFromDate && salesToDate)) {
            toast.error('Please select both From and To dates for filtering, or leave both empty.');
            return;
        }
        const startIso = salesFromDate ? new Date(`${salesFromDate}T00:00:00`).toISOString() : '';
        const endIso = salesToDate ? new Date(`${salesToDate}T23:59:59.999`).toISOString() : '';
        setAppliedSalesFrom(startIso);
        setAppliedSalesTo(endIso);
        setSalesPage(1);
    };

    const handleApplyReportFilter = () => {
        if ((reportFromDate && !reportToDate) || (!reportFromDate && reportToDate)) {
            toast.error('Please select both From and To dates for filtering, or leave both empty.');
            return;
        }
        const startIso = reportFromDate ? new Date(`${reportFromDate}T00:00:00`).toISOString() : '';
        const endIso = reportToDate ? new Date(`${reportToDate}T23:59:59.999`).toISOString() : '';
        setAppliedReportFrom(startIso);
        setAppliedReportTo(endIso);
    };

    // -- Queries --
    const { data: productsData, isLoading: loadingProducts } = useQuery({
        queryKey: ['adminProducts', { page: productPage, search: productSearch }],
        queryFn: () => getAdminProducts(productPage, PRODUCT_PAGE_SIZE, productSearch),
        placeholderData: (prev) => prev,
    });

    const { data: lowStockData } = useQuery({
        queryKey: ['adminLowStock'],
        queryFn: () => getAdminLowStockAlerts(),
    });

    const { data: salesData, isLoading: loadingSales } = useQuery({
        queryKey: ['adminSales', { page: salesPage, appliedSalesFrom, appliedSalesTo }],
        queryFn: () => getAdminSales(salesPage, SALES_PAGE_SIZE, undefined, undefined, appliedSalesFrom, appliedSalesTo),
        placeholderData: (prev) => prev,
    });

    const { data: report, isLoading: loadingReport } = useQuery({
        queryKey: ['adminReport', reportPeriod, appliedReportFrom, appliedReportTo],
        queryFn: () => getAdminSalesReport(reportPeriod, appliedReportFrom, appliedReportTo),
    });

    const { data: pmData, isLoading: loadingPMs } = useQuery({
        queryKey: ['adminPaymentMethods'],
        queryFn: () => getAdminPaymentMethods(),
    });

    const paymentMethods = pmData ?? NO_METHODS;
    const products = productsData?.data ?? NO_PRODUCTS;
    const lowStock = lowStockData || [];
    const sales = salesData?.data ?? NO_SALES;

    const handleOpenAdd = () => {
        setFormData(emptyProductForm);
        setIsAdding(true);
        setIsEditing(null);
    };

    const handleCloseForm = () => {
        setIsAdding(false);
        setIsEditing(null);
    };

    const requestSaveProduct = (e: FormEvent) => {
        e.preventDefault();
        setPendingAction({ kind: 'saveProduct' });
    };

    const requestAddMethod = () => {
        if (!newPaymentMethod.trim()) return;
        setPendingAction({ kind: 'addMethod' });
    };

    const confirmPendingAction = async () => {
        const action = pendingAction;
        if (!action) return;
        setBusy(true);
        try {
            switch (action.kind) {
                case 'saveProduct':
                    if (isEditing) {
                        await updateAdminProduct(isEditing.id, formData);
                        toast.success('Product updated successfully!');
                    } else {
                        await createAdminProduct(formData);
                        toast.success('Product created successfully!');
                    }
                    queryClient.invalidateQueries({ queryKey: ['adminProducts'] });
                    queryClient.invalidateQueries({ queryKey: ['adminLowStock'] });
                    handleCloseForm();
                    break;
                case 'deleteProduct':
                    await deleteAdminProduct(action.product.id);
                    toast.success('Product deleted');
                    queryClient.invalidateQueries({ queryKey: ['adminProducts'] });
                    queryClient.invalidateQueries({ queryKey: ['adminLowStock'] });
                    break;
                case 'addMethod':
                    await createAdminPaymentMethod(newPaymentMethod.trim());
                    setNewPaymentMethod('');
                    toast.success('Payment method added');
                    queryClient.invalidateQueries({ queryKey: ['adminPaymentMethods'] });
                    break;
                case 'toggleMethod':
                    await toggleAdminPaymentMethod(action.method.id, !action.method.is_active);
                    toast.success(action.method.is_active ? 'Payment method disabled' : 'Payment method enabled');
                    queryClient.invalidateQueries({ queryKey: ['adminPaymentMethods'] });
                    break;
            }
        } catch (err) {
            toast.error(getApiErrorMessage(err, FAILURE[action.kind]));
        } finally {
            setBusy(false);
            setPendingAction(null);
        }
    };

    const productColumns = useMemo<Column<InventoryProduct>[]>(() => [
        {
            header: 'Product',
            accessor: 'name',
            sortable: true,
            cell: (p) => <span className="font-semibold dark:text-white wrap-break-word">{p.name}</span>,
        },
        {
            header: 'Price',
            align: 'right',
            sortable: true,
            sortValue: (p) => p.price,
            cell: (p) => <span className="font-medium dark:text-white whitespace-nowrap">₦{p.price.toLocaleString()}</span>,
        },
        {
            header: 'Stock',
            align: 'center',
            sortable: true,
            sortValue: (p) => p.quantity,
            cell: (p) => (
                <span className={`px-2 py-1 rounded-full font-bold text-xs ${p.quantity <= p.threshold ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400' : 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400'}`}>
                    {p.quantity}
                </span>
            ),
        },
        {
            header: 'Threshold',
            accessor: 'threshold',
            align: 'center',
            sortable: true,
            cell: (p) => <span className="text-gray-500 dark:text-gray-400">{p.threshold}</span>,
        },
        {
            header: 'Status',
            align: 'center',
            cell: (p) => p.is_active
                ? <span className="text-green-600 font-bold text-xs">Active</span>
                : <span className="text-gray-400 font-bold text-xs">Inactive</span>,
        },
        {
            header: 'Actions',
            align: 'right',
            cell: (p) => (
                <RowActions
                    label={`Actions for ${p.name}`}
                    actions={[
                        {
                            label: 'Edit',
                            icon: PencilSquareIcon,
                            onSelect: () => {
                                setFormData({
                                    name: p.name, description: p.description || '', price: p.price, quantity: p.quantity, threshold: p.threshold, is_active: p.is_active,
                                });
                                setIsEditing(p);
                                setIsAdding(false);
                            },
                        },
                        { label: 'Delete', icon: TrashIcon, danger: true, onSelect: () => setPendingAction({ kind: 'deleteProduct', product: p }) },
                    ]}
                />
            ),
        },
    ], []);

    const salesColumns = useMemo<Column<InventorySale>[]>(() => [
        {
            header: 'Product',
            accessor: 'product_name',
            sortable: true,
            cell: (s) => <span className="font-semibold dark:text-white wrap-break-word">{s.product_name}</span>,
        },
        {
            header: 'Date',
            sortable: true,
            sortValue: (s) => s.sold_at,
            cell: (s) => <span className="whitespace-nowrap dark:text-gray-300">{new Date(s.sold_at).toLocaleDateString()}</span>,
        },
        {
            header: 'Time',
            cell: (s) => <span className="whitespace-nowrap dark:text-gray-300">{new Date(s.sold_at).toLocaleTimeString()}</span>,
        },
        {
            header: 'Seller',
            accessor: 'seller_name',
            sortable: true,
            cell: (s) => <span className="dark:text-gray-300">{s.seller_name}</span>,
        },
        {
            header: 'Qty',
            align: 'center',
            sortable: true,
            sortValue: (s) => s.quantity_sold,
            cell: (s) => <span className="font-bold dark:text-white">{s.quantity_sold}</span>,
        },
        {
            header: 'Unit Price',
            align: 'right',
            cell: (s) => <span className="whitespace-nowrap dark:text-gray-300">₦{s.unit_price.toLocaleString()}</span>,
        },
        {
            header: 'Payment',
            cell: (s) => <span className="font-semibold text-blue-600 dark:text-blue-400">{s.payment_method || 'Cash'}</span>,
        },
        {
            header: 'Notes',
            cell: (s) => <span className="block max-w-xs wrap-break-word text-xs dark:text-gray-300">{s.notes || '—'}</span>,
        },
        {
            header: 'Total',
            align: 'right',
            sortable: true,
            sortValue: (s) => s.total_amount,
            cell: (s) => <span className="font-bold text-green-600 dark:text-green-400 whitespace-nowrap">₦{s.total_amount.toLocaleString()}</span>,
        },
    ], []);

    const dialog = (() => {
        switch (pendingAction?.kind) {
            case 'deleteProduct':
                return {
                    title: 'Delete this product?',
                    description: undefined,
                    confirmLabel: 'Delete Product',
                    tone: 'warning' as const,
                    icon: TrashIcon,
                    body: (
                        <ConfirmSummary rows={[
                            ['Product', pendingAction.product.name],
                            ['Stock', String(pendingAction.product.quantity)],
                            ['Price', `₦${pendingAction.product.price.toLocaleString()}`],
                        ]} />
                    ),
                };
            case 'addMethod':
                return {
                    title: 'Add this payment method?',
                    description: undefined,
                    confirmLabel: 'Add Method',
                    tone: 'info' as const,
                    icon: PlusIcon,
                    body: <ConfirmSummary rows={[['Method', newPaymentMethod.trim()]]} />,
                };
            case 'toggleMethod':
                return {
                    title: pendingAction.method.is_active ? 'Disable this payment method?' : 'Enable this payment method?',
                    description: pendingAction.method.is_active
                        ? 'Sellers will no longer be able to choose it.'
                        : 'Sellers can choose it again.',
                    confirmLabel: pendingAction.method.is_active ? 'Disable' : 'Enable',
                    tone: 'info' as const,
                    icon: Cog6ToothIcon,
                    body: <ConfirmSummary rows={[['Method', pendingAction.method.name]]} />,
                };
            default:
                return {
                    title: isEditing ? 'Save changes to this product?' : 'Create this product?',
                    description: undefined,
                    confirmLabel: isEditing ? 'Save Changes' : 'Create Product',
                    tone: 'info' as const,
                    icon: isEditing ? PencilSquareIcon : PlusIcon,
                    body: (
                        <ConfirmSummary rows={[
                            ['Product', formData.name],
                            ['Price', `₦${formData.price.toLocaleString()}`],
                            ['Quantity', String(formData.quantity)],
                            ['Threshold', String(formData.threshold)],
                            ['Status', formData.is_active ? 'Active' : 'Inactive'],
                        ]} />
                    ),
                };
        }
    })();

    return (
        <div className="space-y-6 relative">
            <DashboardPageHeader
                title="Inventory"
                subtitle="Track warehouse stock, low-stock alerts and in-person sales."
            />

            {lowStock.length > 0 && (
                <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-r-lg shadow-sm">
                    <div className="flex items-start">
                        <ExclamationTriangleIcon className="w-6 h-6 text-red-500 shrink-0" aria-hidden="true" />
                        <div className="ml-3 min-w-0">
                            <h3 className="text-sm font-bold text-red-800">Low Stock Alert</h3>
                            <div className="mt-2 text-sm text-red-700">
                                <ul className="list-disc pl-5 space-y-1">
                                    {lowStock.map(p => (
                                        <li key={p.id} className="wrap-break-word">{p.name} ({p.quantity} left, threshold: {p.threshold})</li>
                                    ))}
                                </ul>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Tabs */}
            <div className="flex flex-wrap gap-2 border-b dark:border-gray-700 pb-3">
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

            {/* Products Tab */}
            {activeTab === 'PRODUCTS' && (
                <DataTable
                    data={products}
                    columns={productColumns}
                    getRowId={(p) => p.id}
                    loading={loadingProducts}
                    searchPlaceholder="Search physical stock"
                    onSearchSubmit={(q) => { setProductSearch(q.trim()); setProductPage(1); }}
                    serverPage={productPage}
                    totalServerPages={productsData?.total_pages || 1}
                    onPageChange={setProductPage}
                    itemsPerPage={PRODUCT_PAGE_SIZE}
                    emptyMessage="No products found."
                    headerActions={
                        <Button variant="navy" icon={PlusIcon} onClick={handleOpenAdd} className="w-full sm:w-auto">
                            Add Product
                        </Button>
                    }
                />
            )}

            {/* Sales Tab */}
            {activeTab === 'SALES' && (
                <DataTable
                    data={sales}
                    columns={salesColumns}
                    getRowId={(s) => s.id}
                    loading={loadingSales}
                    searchable={false}
                    serverPage={salesPage}
                    totalServerPages={salesData?.total_pages || 1}
                    onPageChange={setSalesPage}
                    itemsPerPage={SALES_PAGE_SIZE}
                    emptyMessage="No sales recorded yet."
                    headerActions={
                        <>
                            <Field label="From" htmlFor="sales-from">
                                <Input id="sales-from" type="date" value={salesFromDate} onChange={e => setSalesFromDate(e.target.value)} className="sm:w-44" />
                            </Field>
                            <Field label="To" htmlFor="sales-to">
                                <Input id="sales-to" type="date" value={salesToDate} onChange={e => setSalesToDate(e.target.value)} className="sm:w-44" />
                            </Field>
                            <Button variant="navy" onClick={handleApplySalesFilter} className="w-full sm:w-auto">
                                Apply Filter
                            </Button>
                        </>
                    }
                />
            )}

            {/* Reports Tab */}
            {activeTab === 'REPORTS' && (
                <div className="space-y-4">
                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 border border-gray-100 dark:border-gray-700 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
                        <div className="flex flex-wrap items-end gap-4 w-full">
                            <Field label="Report Period" htmlFor="report-period" className="w-full sm:w-56">
                                <Select
                                    id="report-period"
                                    value={reportPeriod}
                                    onChange={(e) => setReportPeriod(e.target.value as typeof reportPeriod)}
                                >
                                    <option value="daily">Daily</option>
                                    <option value="weekly">Weekly</option>
                                    <option value="monthly">Monthly</option>
                                    <option value="custom">Custom Date Range</option>
                                </Select>
                            </Field>

                            {reportPeriod === 'custom' && (
                                <div className="flex flex-wrap items-end gap-2">
                                    <Field label="From" htmlFor="report-from">
                                        <Input id="report-from" type="date" value={reportFromDate} onChange={e => setReportFromDate(e.target.value)} className="sm:w-44" />
                                    </Field>
                                    <Field label="To" htmlFor="report-to">
                                        <Input id="report-to" type="date" value={reportToDate} onChange={e => setReportToDate(e.target.value)} className="sm:w-44" />
                                    </Field>
                                    <Button variant="navy" onClick={handleApplyReportFilter}>
                                        Apply Filter
                                    </Button>
                                </div>
                            )}
                        </div>
                    </div>

                    {loadingReport ? <Loader /> : report && (
                        <div className="space-y-6">
                            {/* Summary Cards */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="bg-linear-to-br from-blue-500 to-blue-700 rounded-xl shadow-lg p-4 sm:p-6 text-white">
                                    <h3 className="text-blue-100 text-sm font-bold uppercase tracking-wider">Total Revenue</h3>
                                    <p className="text-2xl sm:text-3xl font-black mt-2 wrap-break-word">₦{report.total_revenue.toLocaleString()}</p>
                                    <p className="text-xs text-blue-200 mt-2">from {new Date(report.from_date).toLocaleDateString()} to {new Date(report.to_date).toLocaleDateString()}</p>
                                </div>
                                <div className="bg-linear-to-br from-green-500 to-green-700 rounded-xl shadow-lg p-4 sm:p-6 text-white">
                                    <h3 className="text-green-100 text-sm font-bold uppercase tracking-wider">Units Sold</h3>
                                    <p className="text-2xl sm:text-3xl font-black mt-2">{report.total_units}</p>
                                    <p className="text-xs text-green-200 mt-2">Total items sold across all products</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                {/* By Payment Method */}
                                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-4 sm:p-6 border border-gray-100 dark:border-gray-700 lg:col-span-2">
                                    <h3 className="text-lg font-bold text-sffl-navy dark:text-white mb-4">Sales by Payment Method</h3>
                                    {report.by_payment_method?.length > 0 ? (
                                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                                            {report.by_payment_method.map(p => (
                                                <div key={p.payment_method} className="flex justify-between items-center gap-3 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg border-l-4 border-blue-500">
                                                    <span className="font-semibold text-gray-900 dark:text-white min-w-0 wrap-break-word">{p.payment_method}</span>
                                                    <span className="font-black text-green-600 dark:text-green-400 shrink-0">₦{p.revenue.toLocaleString()}</span>
                                                </div>
                                            ))}
                                        </div>
                                    ) : <p className="text-sm text-gray-500">No data available.</p>}
                                </div>

                                {/* By Product */}
                                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-4 sm:p-6 border border-gray-100 dark:border-gray-700">
                                    <h3 className="text-lg font-bold text-sffl-navy dark:text-white mb-4">Sales by Product</h3>
                                    {report.by_product?.length > 0 ? (
                                        <div className="space-y-3">
                                            {report.by_product.map(p => (
                                                <div key={p.product_id} className="flex justify-between items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                                                    <div className="min-w-0">
                                                        <p className="font-semibold text-gray-900 dark:text-white wrap-break-word">{p.product_name}</p>
                                                        <p className="text-xs text-gray-500 dark:text-gray-400">{p.units_sold} units sold</p>
                                                    </div>
                                                    <div className="text-right shrink-0">
                                                        <p className="font-bold text-green-600 dark:text-green-400">₦{p.revenue.toLocaleString()}</p>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : <p className="text-sm text-gray-500">No data available.</p>}
                                </div>

                                {/* By Seller */}
                                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-4 sm:p-6 border border-gray-100 dark:border-gray-700">
                                    <h3 className="text-lg font-bold text-sffl-navy dark:text-white mb-4">Sales by Seller</h3>
                                    {report.by_seller?.length > 0 ? (
                                        <div className="space-y-3">
                                            {report.by_seller.map(s => (
                                                <div key={s.seller_id} className="flex justify-between items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                                                    <div className="min-w-0">
                                                        <p className="font-semibold text-gray-900 dark:text-white wrap-break-word">{s.seller_name}</p>
                                                        <p className="text-xs text-gray-500 dark:text-gray-400">{s.units_sold} units sold</p>
                                                    </div>
                                                    <div className="text-right shrink-0">
                                                        <p className="font-bold text-green-600 dark:text-green-400">₦{s.revenue.toLocaleString()}</p>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : <p className="text-sm text-gray-500">No data available.</p>}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Settings Tab */}
            {activeTab === 'SETTINGS' && (
                <div className="space-y-6">
                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-4 sm:p-6 border border-gray-100 dark:border-gray-700">
                        <h2 className="text-xl font-bold text-sffl-navy dark:text-white mb-6">Payment Methods Configuration</h2>
                        <div className="flex flex-col sm:flex-row gap-4 mb-6">
                            <Input
                                type="text"
                                value={newPaymentMethod}
                                onChange={(e) => setNewPaymentMethod(e.target.value)}
                                placeholder="Add new payment method (e.g., POS, Transfer, Cash)"
                                aria-label="New payment method"
                                className="flex-1"
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') requestAddMethod();
                                }}
                            />
                            <Button
                                variant="navy"
                                onClick={requestAddMethod}
                                disabled={busy || !newPaymentMethod.trim()}
                                className="shrink-0"
                            >
                                Add Method
                            </Button>
                        </div>

                        {loadingPMs ? <Loader /> : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {paymentMethods.map((pm: PaymentMethod) => (
                                    <div key={pm.id} className="flex justify-between items-center gap-3 bg-gray-50 dark:bg-gray-700/50 p-4 rounded-xl border border-gray-100 dark:border-gray-600">
                                        <span className="font-semibold text-gray-800 dark:text-white min-w-0 wrap-break-word">{pm.name}</span>
                                        <Button
                                            variant={pm.is_active ? 'success' : 'danger'}
                                            onClick={() => setPendingAction({ kind: 'toggleMethod', method: pm })}
                                            className="shrink-0 rounded-full"
                                        >
                                            {pm.is_active ? 'Active' : 'Disabled'}
                                        </Button>
                                    </div>
                                ))}
                                {paymentMethods.length === 0 && (
                                    <div className="col-span-full py-8 text-center text-gray-500 dark:text-gray-400">
                                        No payment methods configured yet.
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Add/Edit Product Modal */}
            {(isAdding || isEditing) && (
                <Modal
                    open
                    onClose={handleCloseForm}
                    title={isEditing ? 'Edit Physical Product' : 'Add Physical Product'}
                    maxWidth="md"
                    footer={
                        <>
                            <Button variant="secondary" onClick={handleCloseForm} className="flex-1">
                                Cancel
                            </Button>
                            <Button type="submit" form="inventory-product-form" disabled={busy} className="flex-1">
                                {isEditing ? 'Save Changes' : 'Create Product'}
                            </Button>
                        </>
                    }
                >
                        <form id="inventory-product-form" onSubmit={requestSaveProduct}>
                            <div className="space-y-4">
                                <Field label="Product Name" htmlFor="product-name">
                                    <Input
                                        id="product-name"
                                        required
                                        type="text"
                                        placeholder="Official Match Ball, Training Bibs"
                                        value={formData.name}
                                        onChange={e => setFormData({ ...formData, name: e.target.value })}
                                    />
                                </Field>

                                <Field label="Description" htmlFor="product-description">
                                    <Textarea
                                        id="product-description"
                                        value={formData.description}
                                        onChange={e => setFormData({ ...formData, description: e.target.value })}
                                        rows={2}
                                    />
                                </Field>

                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                    <Field label="Price (₦)" htmlFor="product-price">
                                        <Input
                                            id="product-price"
                                            required
                                            type="number"
                                            min="0"
                                            value={formData.price}
                                            onChange={e => setFormData({ ...formData, price: Number(e.target.value) })}
                                        />
                                    </Field>
                                    <Field label="Quantity" htmlFor="product-quantity">
                                        <Input
                                            id="product-quantity"
                                            required
                                            type="number"
                                            min="0"
                                            value={formData.quantity}
                                            onChange={e => setFormData({ ...formData, quantity: Number(e.target.value) })}
                                        />
                                    </Field>
                                    <Field label="Threshold" htmlFor="product-threshold">
                                        <Input
                                            id="product-threshold"
                                            required
                                            type="number"
                                            min="0"
                                            value={formData.threshold}
                                            onChange={e => setFormData({ ...formData, threshold: Number(e.target.value) })}
                                        />
                                    </Field>
                                </div>

                                <div className="pt-2">
                                    <Checkbox
                                        id="is_active"
                                        label="Active Stock Item"
                                        checked={formData.is_active}
                                        onChange={e => setFormData({ ...formData, is_active: e.target.checked })}
                                    />
                                </div>
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
