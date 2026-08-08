import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
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
    type SalesReportResponse,
    type PaymentMethod
} from '../../services/api';
import { Loader } from '../../components/ui/Loader';

type Tab = 'PRODUCTS' | 'SALES' | 'REPORTS' | 'SETTINGS';

export const AdminInventory = () => {
    const queryClient = useQueryClient();
    const [activeTab, setActiveTab] = useState<Tab>('PRODUCTS');

    // -- Products State --
    const [productPage, setProductPage] = useState(1);
    const [productSearch, setProductSearch] = useState('');
    const [isEditing, setIsEditing] = useState<InventoryProduct | null>(null);
    const [isAdding, setIsAdding] = useState(false);
    const [formData, setFormData] = useState({
        name: '', description: '', price: 0, quantity: 0, threshold: 10, is_active: true
    });

    // -- Sales State --
    const [salesPage, setSalesPage] = useState(1);
    const [salesFromDate, setSalesFromDate] = useState('');
    const [salesToDate, setSalesToDate] = useState('');
    const [appliedSalesFrom, setAppliedSalesFrom] = useState('');
    const [appliedSalesTo, setAppliedSalesTo] = useState('');
    const [expandedSaleId, setExpandedSaleId] = useState<string | null>(null);
    const toggleSaleRow = (id: string) => setExpandedSaleId(prev => prev === id ? null : id);

    // -- Reports State --
    const [reportPeriod, setReportPeriod] = useState<'daily' | 'weekly' | 'monthly' | 'custom'>('daily');
    const [reportFromDate, setReportFromDate] = useState('');
    const [reportToDate, setReportToDate] = useState('');
    const [appliedReportFrom, setAppliedReportFrom] = useState('');
    const [appliedReportTo, setAppliedReportTo] = useState('');

    const handleApplySalesFilter = () => {
        if ((salesFromDate && !salesToDate) || (!salesFromDate && salesToDate)) {
            alert('Please select both From and To dates for filtering, or leave both empty.');
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
            alert('Please select both From and To dates for filtering, or leave both empty.');
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
        queryFn: () => getAdminProducts(productPage, 20, productSearch),
    });

    const { data: lowStockData } = useQuery({
        queryKey: ['adminLowStock'],
        queryFn: () => getAdminLowStockAlerts(),
    });

    const { data: salesData, isLoading: loadingSales } = useQuery({
        queryKey: ['adminSales', { page: salesPage, appliedSalesFrom, appliedSalesTo }],
        queryFn: () => getAdminSales(salesPage, 30, undefined, undefined, appliedSalesFrom, appliedSalesTo),
    });

    const { data: reportData, isLoading: loadingReport } = useQuery({
        queryKey: ['adminReport', reportPeriod, appliedReportFrom, appliedReportTo],
        queryFn: () => getAdminSalesReport(reportPeriod, appliedReportFrom, appliedReportTo),
    });

    const { data: pmData, isLoading: loadingPMs } = useQuery({
        queryKey: ['adminPaymentMethods'],
        queryFn: () => getAdminPaymentMethods(),
    });

    const [newPaymentMethod, setNewPaymentMethod] = useState('');
    const [submittingPM, setSubmittingPM] = useState(false);

    const handleCreatePM = async () => {
        if (!newPaymentMethod.trim()) return;
        setSubmittingPM(true);
        try {
            await createAdminPaymentMethod(newPaymentMethod.trim());
            setNewPaymentMethod('');
            queryClient.invalidateQueries({ queryKey: ['adminPaymentMethods'] });
        } catch (err: any) {
            alert(err.response?.data?.error || 'Failed to create payment method');
        } finally {
            setSubmittingPM(false);
        }
    };

    const handleTogglePM = async (id: string, currentStatus: boolean) => {
        try {
            await toggleAdminPaymentMethod(id, !currentStatus);
            queryClient.invalidateQueries({ queryKey: ['adminPaymentMethods'] });
        } catch (err: any) {
            alert(err.response?.data?.error || 'Failed to toggle payment method');
        }
    };

    const paymentMethods = pmData || [];
    const products = productsData?.data || [];
    const lowStock = lowStockData || [];
    const sales: InventorySale[] = salesData?.data || [];
    const report: SalesReportResponse | null = reportData as any;

    const handleOpenEdit = (p: InventoryProduct) => {
        setFormData({
            name: p.name, description: p.description || '', price: p.price, quantity: p.quantity, threshold: p.threshold, is_active: p.is_active
        });
        setIsEditing(p);
        setIsAdding(false);
    };

    const handleOpenAdd = () => {
        setFormData({ name: '', description: '', price: 0, quantity: 0, threshold: 10, is_active: true });
        setIsAdding(true);
        setIsEditing(null);
    };

    const handleCloseForm = () => {
        setIsAdding(false);
        setIsEditing(null);
    };

    const handleSaveProduct = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            if (isEditing) {
                await updateAdminProduct(isEditing.id, formData);
                alert('Product updated successfully!');
            } else {
                await createAdminProduct(formData);
                alert('Product created successfully!');
            }

            queryClient.invalidateQueries({ queryKey: ['adminProducts'] });
            queryClient.invalidateQueries({ queryKey: ['adminLowStock'] });
            handleCloseForm();
        } catch (err: any) {
            alert(err.response?.data?.error || 'Failed to save product');
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this product?')) return;
        try {
            await deleteAdminProduct(id);
            queryClient.invalidateQueries({ queryKey: ['adminProducts'] });
            queryClient.invalidateQueries({ queryKey: ['adminLowStock'] });
        } catch (err: any) {
            alert(err.response?.data?.error || 'Failed to delete product');
        }
    };

    return (
        <div className="space-y-6 relative">
            <h1 className="text-3xl font-black text-sffl-navy dark:text-white">Physical Warehouse Inventory</h1>

            {lowStock.length > 0 && (
                <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-r-lg shadow-sm">
                    <div className="flex items-center">
                        <div className="flex-shrink-0">
                            <span className="text-red-500 font-bold text-xl">⚠️</span>
                        </div>
                        <div className="ml-3">
                            <h3 className="text-sm font-bold text-red-800">Low Stock Alert</h3>
                            <div className="mt-2 text-sm text-red-700">
                                <ul className="list-disc pl-5 space-y-1">
                                    {lowStock.map(p => (
                                        <li key={p.id}>{p.name} ({p.quantity} left, threshold: {p.threshold})</li>
                                    ))}
                                </ul>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Tabs */}
            <div className="flex gap-2 overflow-x-auto whitespace-nowrap border-b dark:border-gray-700 pb-2 scrollbar-hide">
                {(['PRODUCTS', 'SALES', 'REPORTS', 'SETTINGS'] as Tab[]).map((tab) => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`px-4 py-2 text-sm font-bold rounded-t-lg transition-colors ${
                            activeTab === tab
                                ? 'bg-sffl-navy text-white'
                                : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                        }`}
                    >
                        {tab === 'PRODUCTS' && '📦 Products'}
                        {tab === 'SALES' && '💰 Sales Log'}
                        {tab === 'REPORTS' && '📊 Reports'}
                        {tab === 'SETTINGS' && '⚙️ Settings'}
                    </button>
                ))}
            </div>

            {/* Products Tab */}
            {activeTab === 'PRODUCTS' && (
                <div className="space-y-4">
                    <div className="flex flex-col sm:flex-row gap-4 justify-between items-center bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 border border-gray-100 dark:border-gray-700">
                        <div className="flex gap-2 w-full sm:w-auto">
                            <input
                                type="text"
                                placeholder="Search physical stock..."
                                value={productSearch}
                                onChange={(e) => {
                                    setProductSearch(e.target.value);
                                    setProductPage(1);
                                }}
                                className="w-full sm:w-64 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm focus:ring-2 focus:ring-blue-500 outline-none text-gray-900 dark:text-white"
                            />
                        </div>
                        <button
                            onClick={handleOpenAdd}
                            className="w-full sm:w-auto bg-sffl-navy text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-blue-900 transition-colors shadow-sm"
                        >
                            + Add Product
                        </button>
                    </div>

                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-100 dark:border-gray-700 overflow-hidden">
                        {loadingProducts ? <Loader /> : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead className="bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-300 uppercase text-xs">
                                        <tr>
                                            <th className="px-4 py-3 text-left">Product</th>
                                            <th className="px-4 py-3 text-right">Price</th>
                                            <th className="px-4 py-3 text-center">Stock</th>
                                            <th className="px-4 py-3 text-center">Threshold</th>
                                            <th className="px-4 py-3 text-center">Status</th>
                                            <th className="px-4 py-3 text-center">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                        {products.length > 0 ? products.map(p => (
                                            <tr key={p.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                                                <td className="px-4 py-3 font-semibold dark:text-white">{p.name}</td>
                                                <td className="px-4 py-3 text-right font-medium dark:text-white">₦{p.price.toLocaleString()}</td>
                                                <td className="px-4 py-3 text-center">
                                                    <span className={`px-2 py-1 rounded-full font-bold text-xs ${p.quantity <= p.threshold ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400' : 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400'}`}>
                                                        {p.quantity}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 text-center text-gray-500 dark:text-gray-400">{p.threshold}</td>
                                                <td className="px-4 py-3 text-center">
                                                    {p.is_active ? 
                                                        <span className="text-green-600 font-bold text-xs">Active</span> : 
                                                        <span className="text-gray-400 font-bold text-xs">Inactive</span>
                                                    }
                                                </td>
                                                <td className="px-4 py-3 text-center space-x-2">
                                                    <button onClick={() => handleOpenEdit(p)} className="text-blue-600 hover:text-blue-800 font-bold">Edit</button>
                                                    <button onClick={() => handleDelete(p.id)} className="text-red-600 hover:text-red-800 font-bold">Delete</button>
                                                </td>
                                            </tr>
                                        )) : (
                                            <tr>
                                                <td colSpan={6} className="px-4 py-8 text-center text-gray-500">No products found.</td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        )}
                        {(productsData?.total_pages ?? 0) > 1 && (
                            <div className="flex justify-between items-center p-4 border-t dark:border-gray-700 text-sm">
                                <button
                                    onClick={() => setProductPage(prev => Math.max(1, prev - 1))}
                                    disabled={productPage === 1}
                                    className="px-3 py-1 bg-gray-100 dark:bg-gray-700 rounded disabled:opacity-50 dark:text-white"
                                >
                                    Previous
                                </button>
                                <span className="dark:text-gray-300">Page {productPage} of {productsData?.total_pages}</span>
                                <button
                                    onClick={() => setProductPage(prev => Math.min(productsData?.total_pages || 1, prev + 1))}
                                    disabled={productPage === productsData?.total_pages}
                                    className="px-3 py-1 bg-gray-100 dark:bg-gray-700 rounded disabled:opacity-50 dark:text-white"
                                >
                                    Next
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Sales Tab */}
            {activeTab === 'SALES' && (
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-100 dark:border-gray-700 overflow-hidden">
                    <div className="p-4 border-b dark:border-gray-700 flex flex-wrap gap-4 items-center justify-between bg-gray-50 dark:bg-gray-800/50">
                        <div className="flex flex-wrap gap-4 items-center">
                            <div className="flex items-center gap-2">
                                <label className="text-sm font-bold dark:text-gray-300">From:</label>
                                <input type="date" value={salesFromDate} onChange={e => { setSalesFromDate(e.target.value); }} className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white outline-none focus:ring-2 focus:ring-blue-500" />
                            </div>
                            <div className="flex items-center gap-2">
                                <label className="text-sm font-bold dark:text-gray-300">To:</label>
                                <input type="date" value={salesToDate} onChange={e => { setSalesToDate(e.target.value); }} className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white outline-none focus:ring-2 focus:ring-blue-500" />
                            </div>
                            <button onClick={handleApplySalesFilter} className="px-4 py-1.5 bg-sffl-navy text-white text-sm font-bold rounded-lg hover:bg-blue-900 transition-colors shadow-sm">
                                Apply Filter
                            </button>
                        </div>
                    </div>
                    {loadingSales ? <Loader /> : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-300 uppercase text-xs">
                                    <tr>
                                        <th className="px-4 py-3 text-left">Date (Short)</th>
                                        <th className="px-4 py-3 text-left">Product</th>
                                        <th className="px-4 py-3 text-left">Seller</th>
                                        <th className="px-4 py-3 text-center">Qty</th>
                                        <th className="px-4 py-3 text-right">Total</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                    {sales.length > 0 ? sales.map(s => (
                                        <React.Fragment key={s.id}>
                                            <tr 
                                                onClick={() => toggleSaleRow(s.id)}
                                                className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors cursor-pointer"
                                            >
                                                <td className="px-4 py-3 dark:text-gray-300">{new Date(s.sold_at).toLocaleDateString()}</td>
                                                <td className="px-4 py-3 font-semibold dark:text-white flex items-center gap-2">
                                                    <span className={`transform transition-transform ${expandedSaleId === s.id ? 'rotate-90' : ''}`}>▶</span>
                                                    {s.product_name}
                                                </td>
                                                <td className="px-4 py-3 dark:text-gray-300">{s.seller_name}</td>
                                                <td className="px-4 py-3 text-center font-bold dark:text-white">{s.quantity_sold}</td>
                                                <td className="px-4 py-3 text-right font-bold text-green-600 dark:text-green-400">₦{s.total_amount.toLocaleString()}</td>
                                            </tr>
                                            {expandedSaleId === s.id && (
                                                <tr className="bg-gray-50/50 dark:bg-gray-800 border-t-0">
                                                    <td colSpan={5} className="px-4 py-3">
                                                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
                                                            <div>
                                                                <span className="font-bold text-gray-500 dark:text-gray-400 block uppercase">Exact Time</span>
                                                                <span className="dark:text-gray-300">{new Date(s.sold_at).toLocaleTimeString()}</span>
                                                            </div>
                                                            <div>
                                                                <span className="font-bold text-gray-500 dark:text-gray-400 block uppercase">Unit Price</span>
                                                                <span className="dark:text-gray-300">₦{s.unit_price.toLocaleString()}</span>
                                                            </div>
                                                            <div>
                                                                <span className="font-bold text-gray-500 dark:text-gray-400 block uppercase">Payment Method</span>
                                                                <span className="font-semibold text-blue-600 dark:text-blue-400">{s.payment_method || 'Cash'}</span>
                                                            </div>
                                                            <div>
                                                                <span className="font-bold text-gray-500 dark:text-gray-400 block uppercase">Notes</span>
                                                                <span className="dark:text-gray-300">{s.notes || '-'}</span>
                                                            </div>
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}
                                        </React.Fragment>
                                    )) : (
                                        <tr>
                                            <td colSpan={5} className="px-4 py-8 text-center text-gray-500">No sales recorded yet.</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}
                    {(salesData?.total_pages ?? 0) > 1 && (
                        <div className="flex justify-between items-center p-4 border-t dark:border-gray-700 text-sm">
                            <button
                                onClick={() => setSalesPage(prev => Math.max(1, prev - 1))}
                                disabled={salesPage === 1}
                                className="px-3 py-1 bg-gray-100 dark:bg-gray-700 rounded disabled:opacity-50 dark:text-white"
                            >
                                Previous
                                </button>
                            <span className="dark:text-gray-300">Page {salesPage} of {salesData?.total_pages}</span>
                            <button
                                onClick={() => setSalesPage(prev => Math.min(salesData?.total_pages || 1, prev + 1))}
                                disabled={salesPage === salesData?.total_pages}
                                className="px-3 py-1 bg-gray-100 dark:bg-gray-700 rounded disabled:opacity-50 dark:text-white"
                            >
                                Next
                            </button>
                        </div>
                    )}
                </div>
            )}

            {/* Reports Tab */}
            {activeTab === 'REPORTS' && (
                <div className="space-y-4">
                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 border border-gray-100 dark:border-gray-700 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
                        <div className="flex flex-wrap items-center gap-4">
                            <span className="font-bold text-gray-700 dark:text-gray-200">Report Period:</span>
                            <select
                                value={reportPeriod}
                                onChange={(e) => setReportPeriod(e.target.value as any)}
                                className="w-full sm:w-auto px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm focus:ring-2 focus:ring-blue-500 outline-none text-gray-900 dark:text-white"
                            >
                                <option value="daily">Daily</option>
                                <option value="weekly">Weekly</option>
                                <option value="monthly">Monthly</option>
                                <option value="custom">Custom Date Range</option>
                            </select>
                            
                            {reportPeriod === 'custom' && (
                                <div className="flex flex-wrap items-center gap-2">
                                    <input type="date" value={reportFromDate} onChange={e => setReportFromDate(e.target.value)} className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white outline-none focus:ring-2 focus:ring-blue-500" />
                                    <span className="dark:text-gray-300">to</span>
                                    <input type="date" value={reportToDate} onChange={e => setReportToDate(e.target.value)} className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white outline-none focus:ring-2 focus:ring-blue-500" />
                                    <button onClick={handleApplyReportFilter} className="px-4 py-1.5 bg-sffl-navy text-white text-sm font-bold rounded-lg hover:bg-blue-900 transition-colors shadow-sm ml-2">
                                        Apply Filter
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>

                    {loadingReport ? <Loader /> : report && (
                        <div className="space-y-6">
                            {/* Summary Cards */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="bg-gradient-to-br from-blue-500 to-blue-700 rounded-xl shadow-lg p-6 text-white">
                                    <h3 className="text-blue-100 text-sm font-bold uppercase tracking-wider">Total Revenue</h3>
                                    <p className="text-3xl font-black mt-2">₦{report.total_revenue.toLocaleString()}</p>
                                    <p className="text-xs text-blue-200 mt-2">from {new Date(report.from_date).toLocaleDateString()} to {new Date(report.to_date).toLocaleDateString()}</p>
                                </div>
                                <div className="bg-gradient-to-br from-green-500 to-green-700 rounded-xl shadow-lg p-6 text-white">
                                    <h3 className="text-green-100 text-sm font-bold uppercase tracking-wider">Units Sold</h3>
                                    <p className="text-3xl font-black mt-2">{report.total_units}</p>
                                    <p className="text-xs text-green-200 mt-2">Total items sold across all products</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                {/* By Payment Method */}
                                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 border border-gray-100 dark:border-gray-700 lg:col-span-2">
                                    <h3 className="text-lg font-bold text-sffl-navy dark:text-white mb-4">Sales by Payment Method</h3>
                                    {report.by_payment_method?.length > 0 ? (
                                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                                            {report.by_payment_method.map(p => (
                                                <div key={p.payment_method} className="flex justify-between items-center p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg border-l-4 border-blue-500">
                                                    <span className="font-semibold text-gray-900 dark:text-white">{p.payment_method}</span>
                                                    <span className="font-black text-green-600 dark:text-green-400">₦{p.revenue.toLocaleString()}</span>
                                                </div>
                                            ))}
                                        </div>
                                    ) : <p className="text-sm text-gray-500">No data available.</p>}
                                </div>

                                {/* By Product */}
                                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 border border-gray-100 dark:border-gray-700">
                                    <h3 className="text-lg font-bold text-sffl-navy dark:text-white mb-4">Sales by Product</h3>
                                    {report.by_product?.length > 0 ? (
                                        <div className="space-y-3">
                                            {report.by_product.map(p => (
                                                <div key={p.product_id} className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                                                    <div>
                                                        <p className="font-semibold text-gray-900 dark:text-white">{p.product_name}</p>
                                                        <p className="text-xs text-gray-500 dark:text-gray-400">{p.units_sold} units sold</p>
                                                    </div>
                                                    <div className="text-right">
                                                        <p className="font-bold text-green-600 dark:text-green-400">₦{p.revenue.toLocaleString()}</p>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : <p className="text-sm text-gray-500">No data available.</p>}
                                </div>

                                {/* By Seller */}
                                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 border border-gray-100 dark:border-gray-700">
                                    <h3 className="text-lg font-bold text-sffl-navy dark:text-white mb-4">Sales by Seller</h3>
                                    {report.by_seller?.length > 0 ? (
                                        <div className="space-y-3">
                                            {report.by_seller.map(s => (
                                                <div key={s.seller_id} className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                                                    <div>
                                                        <p className="font-semibold text-gray-900 dark:text-white">{s.seller_name}</p>
                                                        <p className="text-xs text-gray-500 dark:text-gray-400">{s.units_sold} units sold</p>
                                                    </div>
                                                    <div className="text-right">
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
                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 border border-gray-100 dark:border-gray-700">
                        <h2 className="text-xl font-bold text-sffl-navy dark:text-white mb-6">Payment Methods Configuration</h2>
                        <div className="flex gap-4 mb-6">
                            <input
                                type="text"
                                value={newPaymentMethod}
                                onChange={(e) => setNewPaymentMethod(e.target.value)}
                                placeholder="Add new payment method (e.g., POS, Transfer, Cash)"
                                className="flex-1 px-4 py-2 bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all dark:text-white"
                                onKeyDown={(e) => {
                                    if(e.key === 'Enter') handleCreatePM();
                                }}
                            />
                            <button
                                onClick={handleCreatePM}
                                disabled={submittingPM || !newPaymentMethod.trim()}
                                className="px-6 py-2 bg-sffl-navy text-white rounded-lg font-bold hover:bg-blue-900 transition-colors shadow-sm disabled:opacity-50"
                            >
                                {submittingPM ? 'Saving...' : 'Add Method'}
                            </button>
                        </div>

                        {loadingPMs ? <Loader /> : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {paymentMethods.map((pm: PaymentMethod) => (
                                    <div key={pm.id} className="flex justify-between items-center bg-gray-50 dark:bg-gray-700/50 p-4 rounded-xl border border-gray-100 dark:border-gray-600">
                                        <span className="font-semibold text-gray-800 dark:text-white">{pm.name}</span>
                                        <button
                                            onClick={() => handleTogglePM(pm.id, pm.is_active)}
                                            className={`px-3 py-1 rounded-full text-xs font-bold ${
                                                pm.is_active 
                                                    ? 'bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-400' 
                                                    : 'bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400'
                                            } transition-colors`}
                                        >
                                            {pm.is_active ? 'Active' : 'Disabled'}
                                        </button>
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
                <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/60 backdrop-blur-sm" onClick={handleCloseForm}>
                    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full max-h-[90vh] md:max-h-[85vh] flex flex-col overflow-hidden border border-gray-200 dark:border-gray-700" onClick={e => e.stopPropagation()}>
                        <div className="px-6 py-4 bg-gray-50 dark:bg-gray-700/50 border-b dark:border-gray-700 flex-shrink-0 flex justify-between items-center">
                            <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                                {isEditing ? 'Edit Physical Product' : 'Add Physical Product'}
                            </h2>
                            <button onClick={handleCloseForm} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                                <span className="text-xl">✕</span>
                            </button>
                        </div>

                        <form onSubmit={handleSaveProduct} className="flex flex-col flex-1 overflow-hidden">
                            <div className="p-6 space-y-4 overflow-y-auto flex-1">
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-gray-600 dark:text-gray-400 uppercase tracking-wider">Product Name</label>
                                    <input
                                        required
                                        type="text"
                                        placeholder="Official Match Ball, Training Bibs..."
                                        value={formData.name}
                                        onChange={e => setFormData({ ...formData, name: e.target.value })}
                                        className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all dark:text-white"
                                    />
                                </div>

                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-gray-600 dark:text-gray-400 uppercase tracking-wider">Description</label>
                                    <textarea
                                        value={formData.description}
                                        onChange={e => setFormData({ ...formData, description: e.target.value })}
                                        rows={2}
                                        className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all dark:text-white resize-none"
                                    />
                                </div>

                                <div className="grid grid-cols-3 gap-3">
                                    <div className="space-y-1">
                                        <label className="text-xs font-bold text-gray-600 dark:text-gray-400 uppercase tracking-wider">Price (₦)</label>
                                        <input
                                            required
                                            type="number"
                                            min="0"
                                            value={formData.price}
                                            onChange={e => setFormData({ ...formData, price: Number(e.target.value) })}
                                            className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all dark:text-white"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-xs font-bold text-gray-600 dark:text-gray-400 uppercase tracking-wider">Quantity</label>
                                        <input
                                            required
                                            type="number"
                                            min="0"
                                            value={formData.quantity}
                                            onChange={e => setFormData({ ...formData, quantity: Number(e.target.value) })}
                                            className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all dark:text-white"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-xs font-bold text-gray-600 dark:text-gray-400 uppercase tracking-wider">Threshold</label>
                                        <input
                                            required
                                            type="number"
                                            min="0"
                                            value={formData.threshold}
                                            onChange={e => setFormData({ ...formData, threshold: Number(e.target.value) })}
                                            className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all dark:text-white"
                                        />
                                    </div>
                                </div>

                                <div className="flex items-center gap-2 pt-2">
                                    <input
                                        type="checkbox"
                                        id="is_active"
                                        checked={formData.is_active}
                                        onChange={e => setFormData({ ...formData, is_active: e.target.checked })}
                                        className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                                    />
                                    <label htmlFor="is_active" className="text-sm font-medium text-gray-900 dark:text-gray-300 select-none cursor-pointer">
                                        Active Stock Item
                                    </label>
                                </div>
                            </div>

                            <div className="p-4 border-t dark:border-gray-700 flex-shrink-0 flex gap-3 bg-gray-50/50 dark:bg-gray-800">
                                <button
                                    type="button"
                                    onClick={handleCloseForm}
                                    className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300 rounded-lg font-bold hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors min-h-[44px]"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 px-4 py-2 bg-sffl-navy text-white rounded-lg font-bold hover:bg-blue-900 transition-colors shadow-sm min-h-[44px]"
                                >
                                    {isEditing ? 'Save Changes' : 'Create Product'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};
