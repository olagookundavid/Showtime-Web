import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { MagnifyingGlassIcon, ShoppingCartIcon } from '@heroicons/react/24/outline';
import { sellerGetProducts, sellerLogSale, sellerGetPaymentMethods } from '../../services/api';
import type { InventoryProduct, PaymentMethod } from '../../types';
import { DashboardPageHeader, Button, Field, Input, Select, Textarea, ConfirmDialog, ConfirmSummary, Spinner } from '../../components';
import { getApiErrorMessage } from '../../utils';

const cardClass = 'bg-white dark:bg-gray-800 rounded-xl shadow-lg p-4 sm:p-6 border border-gray-100 dark:border-gray-700';

const naira = (n: number) => `₦${n.toLocaleString()}`;

export const SellerLogSale = () => {
    const queryClient = useQueryClient();

    // -- Products Data --
    const [productSearch, setProductSearch] = useState('');
    const { data: productsData, isLoading: loadingProducts } = useQuery({
        queryKey: ['sellerProducts', { search: productSearch }],
        queryFn: () => sellerGetProducts(1, 100, productSearch),
    });
    const products: InventoryProduct[] = productsData?.data || [];

    const { data: pmData } = useQuery({
        queryKey: ['sellerPaymentMethods'],
        queryFn: () => sellerGetPaymentMethods(),
    });
    const paymentMethods: PaymentMethod[] = pmData || [];

    // -- Sale Form --
    // The picked product is kept whole, so searching for another one doesn't empty the form.
    // Its stock is read from the latest list when it's still in it.
    const [selected, setSelected] = useState<InventoryProduct | null>(null);
    const [quantity, setQuantity] = useState(1);
    const [paymentMethod, setPaymentMethod] = useState('');
    const [notes, setNotes] = useState('');

    // The sale waits here for the confirm dialog.
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [busy, setBusy] = useState(false);

    const targetProduct = products.find(p => p.id === selected?.id) ?? selected;
    const totalPrice = targetProduct ? targetProduct.price * quantity : 0;
    const overStock = !!targetProduct && quantity > targetProduct.quantity;
    const canSubmit = !!targetProduct && quantity > 0 && !overStock;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (canSubmit) setConfirmOpen(true);
    };

    const logSale = async () => {
        if (!targetProduct) return;
        setBusy(true);
        try {
            await sellerLogSale({ product_id: targetProduct.id, quantity_sold: quantity, payment_method: paymentMethod, notes });
            toast.success('Sale logged');
            setSelected(null);
            setQuantity(1);
            setPaymentMethod('');
            setNotes('');
            queryClient.invalidateQueries({ queryKey: ['sellerProducts'] });
            queryClient.invalidateQueries({ queryKey: ['sellerSales'] });
        } catch (err) {
            toast.error(getApiErrorMessage(err, 'Failed to log sale'));
        } finally {
            setBusy(false);
            setConfirmOpen(false);
        }
    };

    return (
        <div className="space-y-6">
            <DashboardPageHeader
                title="Log Sale"
                subtitle="Pick a product, then record what you sold and how it was paid for."
            />

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8 items-start">
                {/* Catalog */}
                <section className={cardClass}>
                    <h2 className="text-lg font-bold text-sffl-navy dark:text-white mb-4">Select Product</h2>
                    <Input
                        type="search"
                        aria-label="Search products"
                        icon={MagnifyingGlassIcon}
                        placeholder="Search products"
                        value={productSearch}
                        onChange={(e) => setProductSearch(e.target.value)}
                        className="mb-4"
                    />
                    {loadingProducts ? <Spinner label="Loading products" /> : (
                        <div className="space-y-3 max-h-96 lg:max-h-125 overflow-y-auto pr-1">
                            {products.length > 0 ? products.map(p => (
                                <button
                                    key={p.id}
                                    type="button"
                                    onClick={() => setSelected(p)}
                                    aria-pressed={selected?.id === p.id}
                                    className={`w-full text-left p-3 rounded-lg border-2 transition-colors ${
                                        selected?.id === p.id
                                            ? 'border-sffl-navy bg-blue-50 dark:bg-gray-700/50 dark:border-blue-500'
                                            : 'border-transparent bg-gray-50 dark:bg-gray-700/30 hover:bg-gray-100 dark:hover:bg-gray-700'
                                    }`}
                                >
                                    <div className="flex justify-between items-start gap-3">
                                        <div className="min-w-0">
                                            <p className="font-bold text-gray-900 dark:text-white wrap-break-word">{p.name}</p>
                                            <p className="text-xs text-gray-500 dark:text-gray-400 font-mono break-all">SKU: {p.sku}</p>
                                        </div>
                                        <p className="font-semibold text-sffl-navy dark:text-gray-300 whitespace-nowrap">{naira(p.price)}</p>
                                    </div>
                                    <div className="mt-2 text-xs font-semibold">
                                        {p.quantity > 0 ? (
                                            <span className="text-green-600 dark:text-green-400">{p.quantity} in stock</span>
                                        ) : (
                                            <span className="text-red-500">Out of stock</span>
                                        )}
                                    </div>
                                </button>
                            )) : <p className="text-sm text-gray-500 dark:text-gray-400">No products available.</p>}
                        </div>
                    )}
                </section>

                {/* Form. Sticky beside the catalog on wide screens; the shell scrolls only <main>. */}
                <section className={`${cardClass} lg:sticky lg:top-0`}>
                    <h2 className="text-lg font-bold text-sffl-navy dark:text-white mb-4">Sale Details</h2>
                    {targetProduct ? (
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                                <p className="font-bold text-gray-900 dark:text-white wrap-break-word">{targetProduct.name}</p>
                                <p className="text-sm text-gray-500 dark:text-gray-400">{naira(targetProduct.price)} per unit</p>
                            </div>
                            <Field
                                label="Quantity Sold"
                                htmlFor="sale-quantity"
                                error={overStock ? `Cannot sell more than in stock (${targetProduct.quantity})` : undefined}
                            >
                                <Input
                                    id="sale-quantity"
                                    type="number"
                                    min="1"
                                    max={targetProduct.quantity}
                                    value={quantity}
                                    onChange={(e) => setQuantity(Number(e.target.value))}
                                    invalid={overStock}
                                    required
                                />
                            </Field>
                            <Field label="Payment Method" htmlFor="sale-payment">
                                <Select
                                    id="sale-payment"
                                    value={paymentMethod}
                                    onChange={(e) => setPaymentMethod(e.target.value)}
                                    required
                                >
                                    <option value="" disabled>Select Payment Method</option>
                                    {paymentMethods.map(pm => (
                                        <option key={pm.id} value={pm.name}>{pm.name}</option>
                                    ))}
                                </Select>
                            </Field>
                            <Field label="Notes (Optional)" htmlFor="sale-notes">
                                <Textarea
                                    id="sale-notes"
                                    value={notes}
                                    onChange={(e) => setNotes(e.target.value)}
                                    rows={2}
                                />
                            </Field>
                            <div className="pt-4 border-t border-gray-200 dark:border-gray-700 flex flex-wrap justify-between items-center gap-2">
                                <span className="font-bold text-gray-700 dark:text-gray-300">Total Price</span>
                                <span className="text-2xl font-black text-green-600 dark:text-green-400">{naira(totalPrice)}</span>
                            </div>
                            <Button type="submit" variant="navy" size="lg" fullWidth icon={ShoppingCartIcon} disabled={!canSubmit}>
                                Log Sale
                            </Button>
                        </form>
                    ) : (
                        <div className="flex items-center justify-center h-48 p-4 text-center border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-lg">
                            <p className="text-gray-400 font-medium">Select a product to log a sale</p>
                        </div>
                    )}
                </section>
            </div>

            <ConfirmDialog
                open={confirmOpen}
                title="Log this sale?"
                description="Stock goes down by the quantity sold."
                body={targetProduct ? (
                    <ConfirmSummary rows={[
                        ['Product', targetProduct.name],
                        ['Quantity', String(quantity)],
                        ['Unit price', naira(targetProduct.price)],
                        ['Payment', paymentMethod],
                        ['Total', naira(totalPrice)],
                    ]} />
                ) : undefined}
                confirmLabel="Log Sale"
                tone="info"
                icon={ShoppingCartIcon}
                pending={busy}
                onConfirm={logSale}
                onCancel={() => setConfirmOpen(false)}
            />
        </div>
    );
};
