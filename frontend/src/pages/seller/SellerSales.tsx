import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { sellerGetSales, type InventorySale } from '../../services/api';
import { DashboardPageHeader } from '../../components/dashboard/DashboardPageHeader';
import { DataTable, type Column } from '../../components/ui/DataTable';

const SALES_PAGE_SIZE = 30;
const NO_ROWS: InventorySale[] = [];

const dateInputClass =
    'min-h-11 px-3 py-1.5 border border-gray-300 rounded-lg text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white outline-none focus:ring-2 focus:ring-sffl-red';

export const SellerSales = () => {
    const [salesPage, setSalesPage] = useState(1);
    const [fromDate, setFromDate] = useState('');
    const [toDate, setToDate] = useState('');
    const [appliedFromDate, setAppliedFromDate] = useState('');
    const [appliedToDate, setAppliedToDate] = useState('');

    const handleApplyFilter = () => {
        if ((fromDate && !toDate) || (!fromDate && toDate)) {
            toast.error('Please select both From and To dates for filtering, or leave both empty.');
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
        queryFn: () => sellerGetSales(salesPage, SALES_PAGE_SIZE, appliedFromDate, appliedToDate),
    });
    const sales = salesData?.data ?? NO_ROWS;

    // The same columns as the admin Inventory page's Sales tab. /seller/sales returns every
    // seller's sales, not only this seller's, so the Seller column stays.
    const columns = useMemo<Column<InventorySale>[]>(() => [
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

    return (
        <div className="space-y-6">
            <DashboardPageHeader
                title="Sales History"
                subtitle="Every sale logged at the store, filtered by date when you need a day's takings."
            />

            <DataTable
                data={sales}
                columns={columns}
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
                        <label className="flex items-center gap-2 text-sm font-bold dark:text-gray-300">
                            From
                            <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} className={dateInputClass} />
                        </label>
                        <label className="flex items-center gap-2 text-sm font-bold dark:text-gray-300">
                            To
                            <input type="date" value={toDate} onChange={e => setToDate(e.target.value)} className={dateInputClass} />
                        </label>
                        <button
                            type="button"
                            onClick={handleApplyFilter}
                            className="px-4 min-h-11 bg-sffl-navy text-white text-sm font-bold rounded-lg hover:bg-blue-900 transition-colors shadow-sm"
                        >
                            Apply Filter
                        </button>
                    </>
                }
            />
        </div>
    );
};
