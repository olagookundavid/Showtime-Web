import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { sellerGetProducts, sellerLogSale, sellerGetSales, sellerGetPaymentMethods, type InventoryProduct, type InventorySale, type PaymentMethod } from '../../services/api';
import { Loader } from '../../components/ui/Loader';

type Tab = 'SELL' | 'HISTORY';

export const SellerPortal = () => {
    const queryClient = useQueryClient();
    const [activeTab, setActiveTab] = useState<Tab>('SELL');
    
    // -- Products Data --
    const [productSearch, setProductSearch] = useState('');
    const { data: productsData, isLoading: loadingProducts } = useQuery({
        queryKey: ['sellerProducts', { search: productSearch }],
        queryFn: () => sellerGetProducts(1, 100, productSearch),
    });
    const products: InventoryProduct[] = productsData?.data || [];

    // -- Sales History --
    const [salesPage, setSalesPage] = useState(1);
    const [fromDate, setFromDate] = useState('');
    const [toDate, setToDate] = useState('');
    const [appliedFromDate, setAppliedFromDate] = useState('');
    const [appliedToDate, setAppliedToDate] = useState('');

    const handleApplyFilter = () => {
        if ((fromDate && !toDate) || (!fromDate && toDate)) {
            alert('Please select both From and To dates for filtering, or leave both empty.');
            return;
        }
        const startIso = fromDate ? new Date(`${fromDate}T00:00:00`).toISOString() : '';
        const endIso = toDate ? new Date(`${toDate}T23:59:59.999`).toISOString() : '';
        setAppliedFromDate(startIso);
        setAppliedToDate(endIso);
        setSalesPage(1);
    };

    const { data: salesData, isLoading: loadingSales } = useQuery({
        queryKey: ['sellerSales', { page: salesPage, appliedFromDate, appliedToDate }],
        queryFn: () => sellerGetSales(salesPage, 30, appliedFromDate, appliedToDate),
    });
    const sales: InventorySale[] = salesData?.data || [];

    // -- Sale Form --
    const [selectedProduct, setSelectedProduct] = useState<string>('');
    const [quantity, setQuantity] = useState(1);
    const [paymentMethod, setPaymentMethod] = useState('');

    const { data: pmData } = useQuery({
        queryKey: ['sellerPaymentMethods'],
        queryFn: () => sellerGetPaymentMethods(),
    });
    const paymentMethods: PaymentMethod[] = pmData || [];
    const [notes, setNotes] = useState('');
    const [submitting, setSubmitting] = useState(false);

    // -- Expanded Row --
    const [expandedRowId, setExpandedRowId] = useState<string | null>(null);

    const toggleRow = (id: string) => setExpandedRowId(prev => prev === id ? null : id);

    const handleLogSale = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedProduct || quantity <= 0) return;
        setSubmitting(true);
        try {
            await sellerLogSale({ product_id: selectedProduct, quantity_sold: quantity, payment_method: paymentMethod, notes });
            alert('Sale logged successfully!');
            setSelectedProduct('');
            setQuantity(1);
            setPaymentMethod('');
            setNotes('');
            queryClient.invalidateQueries({ queryKey: ['sellerProducts'] });
            queryClient.invalidateQueries({ queryKey: ['sellerSales'] });
        } catch (err: any) {
            alert(err.response?.data?.error || 'Failed to log sale');
        } finally {
            setSubmitting(false);
        }
    };

    const targetProduct = products.find(p => p.id === selectedProduct);
    const totalPrice = targetProduct ? targetProduct.price * quantity : 0;

    return (
        <div className="space-y-6">
            <h1 className="text-3xl font-black text-sffl-navy dark:text-white">Store Sales</h1>

            {/* Tabs */}
            <div className="flex gap-2 overflow-x-auto whitespace-nowrap border-b dark:border-gray-700 pb-2 scrollbar-hide">
                {(['SELL', 'HISTORY'] as Tab[]).map((tab) => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`px-4 py-2 text-sm font-bold rounded-t-lg transition-colors ${
                            activeTab === tab
                                ? 'bg-sffl-navy text-white'
                                : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                        }`}
                    >
                        {tab === 'SELL' && '🛒 Log Sale'}
                        {tab === 'HISTORY' && '📜 Sales History'}
                    </button>
                ))}
            </div>

            {activeTab === 'SELL' && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Catalog */}
                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 border border-gray-100 dark:border-gray-700">
                        <h2 className="text-lg font-bold text-sffl-navy dark:text-white mb-4">Select Product</h2>
                        <input
                            type="text"
                            placeholder="Search products..."
                            value={productSearch}
                            onChange={(e) => setProductSearch(e.target.value)}
                            className="w-full mb-4 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm focus:ring-2 focus:ring-blue-500 outline-none text-gray-900 dark:text-white"
                        />
                        {loadingProducts ? <Loader /> : (
                            <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2">
                                {products.length > 0 ? products.map(p => (
                                    <button
                                        key={p.id}
                                        onClick={() => setSelectedProduct(p.id)}
                                        className={`w-full text-left p-3 rounded-lg border-2 transition-colors ${
                                            selectedProduct === p.id
                                                ? 'border-sffl-navy bg-blue-50 dark:bg-gray-700/50 dark:border-blue-500'
                                                : 'border-transparent bg-gray-50 dark:bg-gray-700/30 hover:bg-gray-100 dark:hover:bg-gray-700'
                                        }`}
                                    >
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <p className="font-bold text-gray-900 dark:text-white">{p.name}</p>
                                                <p className="text-xs text-gray-500 font-mono">SKU: {p.sku}</p>
                                            </div>
                                            <p className="font-semibold text-sffl-navy dark:text-gray-300">₦{p.price.toLocaleString()}</p>
                                        </div>
                                        <div className="mt-2 text-xs font-semibold">
                                            {p.quantity > 0 ? (
                                                <span className="text-green-600 dark:text-green-400">{p.quantity} in stock</span>
                                            ) : (
                                                <span className="text-red-500">Out of stock</span>
                                            )}
                                        </div>
                                    </button>
                                )) : <p className="text-sm text-gray-500">No products available.</p>}
                            </div>
                        )}
                    </div>

                    {/* Form */}
                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 border border-gray-100 dark:border-gray-700 h-fit sticky top-24">
                        <h2 className="text-lg font-bold text-sffl-navy dark:text-white mb-4">Log Sale</h2>
                        {selectedProduct ? (
                            <form onSubmit={handleLogSale} className="space-y-4">
                                <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                                    <p className="font-bold text-gray-900 dark:text-white">{targetProduct?.name}</p>
                                    <p className="text-sm text-gray-500 dark:text-gray-400">₦{targetProduct?.price.toLocaleString()} per unit</p>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-gray-600 dark:text-gray-400 uppercase tracking-wider">Quantity Sold</label>
                                    <input
                                        type="number"
                                        min="1"
                                        max={targetProduct?.quantity}
                                        value={quantity}
                                        onChange={(e) => setQuantity(Number(e.target.value))}
                                        className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all dark:text-white"
                                        required
                                    />
                                    {targetProduct && quantity > targetProduct.quantity && (
                                        <p className="text-red-500 text-xs mt-1 font-semibold">Cannot sell more than in stock ({targetProduct.quantity})</p>
                                    )}
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-gray-600 dark:text-gray-400 uppercase tracking-wider">Payment Method</label>
                                    <select
                                        value={paymentMethod}
                                        onChange={(e) => setPaymentMethod(e.target.value)}
                                        className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all dark:text-white"
                                        required
                                    >
                                        <option value="" disabled>Select Payment Method</option>
                                        {paymentMethods.map(pm => (
                                            <option key={pm.id} value={pm.name}>{pm.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-gray-600 dark:text-gray-400 uppercase tracking-wider">Notes (Optional)</label>
                                    <textarea
                                        value={notes}
                                        onChange={(e) => setNotes(e.target.value)}
                                        className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all dark:text-white"
                                        rows={2}
                                    />
                                </div>
                                <div className="pt-4 border-t dark:border-gray-700 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                                    <span className="font-bold text-gray-700 dark:text-gray-300">Total Price:</span>
                                    <span className="text-2xl font-black text-green-600 dark:text-green-400">₦{totalPrice.toLocaleString()}</span>
                                </div>
                                <button
                                    type="submit"
                                    disabled={submitting || !targetProduct || quantity > targetProduct.quantity || quantity <= 0}
                                    className="w-full py-3 bg-sffl-navy text-white rounded-lg font-bold hover:bg-blue-900 transition-colors shadow-sm disabled:opacity-50"
                                >
                                    {submitting ? 'Logging Sale...' : 'Confirm Sale'}
                                </button>
                            </form>
                        ) : (
                            <div className="flex items-center justify-center h-48 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-lg">
                                <p className="text-gray-400 font-medium">Select a product to log a sale</p>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {activeTab === 'HISTORY' && (
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-100 dark:border-gray-700 overflow-hidden">
                    <div className="p-4 border-b dark:border-gray-700 flex flex-wrap gap-4 items-center bg-gray-50 dark:bg-gray-800/50">
                        <div className="flex items-center gap-2">
                            <label className="text-sm font-bold dark:text-gray-300">From:</label>
                            <input type="date" value={fromDate} onChange={e => { setFromDate(e.target.value); }} className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white outline-none focus:ring-2 focus:ring-blue-500" />
                        </div>
                        <div className="flex items-center gap-2">
                            <label className="text-sm font-bold dark:text-gray-300">To:</label>
                            <input type="date" value={toDate} onChange={e => { setToDate(e.target.value); }} className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white outline-none focus:ring-2 focus:ring-blue-500" />
                        </div>
                        <button onClick={handleApplyFilter} className="px-4 py-1.5 bg-sffl-navy text-white text-sm font-bold rounded-lg hover:bg-blue-900 transition-colors shadow-sm">
                            Apply Filter
                        </button>
                    </div>
                    {loadingSales ? <Loader /> : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-300 uppercase text-xs">
                                    <tr>
                                        <th className="px-4 py-3 text-left">Date (Short)</th>
                                        <th className="px-4 py-3 text-left">Product</th>
                                        <th className="px-4 py-3 text-center">Qty</th>
                                        <th className="px-4 py-3 text-right">Total</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                    {sales.length > 0 ? sales.map(s => (
                                        <React.Fragment key={s.id}>
                                            <tr 
                                                onClick={() => toggleRow(s.id)}
                                                className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors cursor-pointer"
                                            >
                                                <td className="px-4 py-3 dark:text-gray-300">{new Date(s.sold_at).toLocaleDateString()}</td>
                                                <td className="px-4 py-3 font-semibold dark:text-white flex items-center gap-2">
                                                    <span className={`transform transition-transform ${expandedRowId === s.id ? 'rotate-90' : ''}`}>▶</span>
                                                    {s.product_name}
                                                </td>
                                                <td className="px-4 py-3 text-center font-bold dark:text-white">{s.quantity_sold}</td>
                                                <td className="px-4 py-3 text-right font-bold text-green-600 dark:text-green-400">₦{s.total_amount.toLocaleString()}</td>
                                            </tr>
                                            {expandedRowId === s.id && (
                                                <tr className="bg-gray-50/50 dark:bg-gray-800 border-t-0">
                                                    <td colSpan={4} className="px-4 py-3">
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
                                            <td colSpan={4} className="px-4 py-8 text-center text-gray-500">No sales recorded yet.</td>
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
        </div>
    );
};
