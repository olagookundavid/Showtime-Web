import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { DataTable, Field, Select, type Column } from '../ui';
import { MetricCard } from './MetricCard';
import { getRepeatCustomerReport } from '../../services';
import { formatNaira, getApiErrorMessage } from '../../utils';
import type { RepeatCustomer, RepeatCustomerDay } from '../../types';

const NO_DAYS: RepeatCustomerDay[] = [];
const NO_CUSTOMERS: RepeatCustomer[] = [];

const dayLabel = (iso: string) =>
    new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });

const boughtLabel = (iso: string) =>
    new Intl.DateTimeFormat('en-GB', { timeZone: 'Africa/Lagos', day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(iso));

const percent = (part: number, whole: number) => (whole > 0 ? `${Math.round((part / whole) * 100)}%` : '—');

const WEEK_COLUMNS: Column<RepeatCustomerDay>[] = [
    {
        header: 'Match day',
        sortable: true,
        sortValue: (d) => d.date,
        cell: (d) => (
            <div>
                <p className="font-bold text-sffl-navy dark:text-white">{d.title || 'Match day'}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">{dayLabel(d.date)}</p>
            </div>
        ),
    },
    { header: 'Buyers', align: 'right', sortable: true, sortValue: (d) => d.buyers, cell: (d) => d.buyers },
    { header: 'Returning', align: 'right', sortable: true, sortValue: (d) => d.returning, cell: (d) => d.returning },
    {
        header: 'Returning share',
        align: 'right',
        sortable: true,
        sortValue: (d) => (d.buyers > 0 ? d.returning / d.buyers : 0),
        cell: (d) => <span className="font-bold text-green-700 dark:text-green-400">{percent(d.returning, d.buyers)}</span>,
    },
];

const CUSTOMER_COLUMNS: Column<RepeatCustomer>[] = [
    {
        header: 'Customer',
        sortable: true,
        sortValue: (c) => c.name || c.email,
        cell: (c) => (
            <div className="min-w-0">
                <p className="font-bold text-sffl-navy dark:text-white">{c.name || '—'}</p>
                <p className="break-all text-xs text-gray-500 dark:text-gray-400">{c.email}</p>
            </div>
        ),
    },
    { header: 'Phone', cell: (c) => c.phone || <span className="text-gray-400">—</span> },
    { header: 'Tickets', align: 'right', sortable: true, sortValue: (c) => c.tickets, cell: (c) => c.tickets },
    {
        header: 'Paid',
        align: 'right',
        sortable: true,
        sortValue: (c) => c.spent,
        cell: (c) => <span className="font-bold text-green-600">{formatNaira(c.spent)}</span>,
    },
    {
        header: 'Earlier purchases',
        align: 'right',
        sortable: true,
        sortValue: (c) => c.prior_purchases,
        cell: (c) => c.prior_purchases,
    },
    {
        header: 'First bought',
        sortable: true,
        sortValue: (c) => c.first_bought_at,
        cell: (c) => <span className="whitespace-nowrap text-sm">{boughtLabel(c.first_bought_at)}</span>,
    },
];

/**
 * The weekly look at returning customers: how many of each match day's buyers had
 * bought before, and who they are for the match day picked above.
 */
export const RepeatCustomersReport = () => {
    // Empty until a match day is picked; the server then opens on the next one.
    const [pickedDay, setPickedDay] = useState('');

    const { data, isLoading, error } = useQuery({
        queryKey: ['repeatCustomers', pickedDay],
        queryFn: async () => (await getRepeatCustomerReport(pickedDay)).data,
        placeholderData: (prev) => prev,
    });

    const days = data?.days ?? NO_DAYS;
    const customers = data?.customers ?? NO_CUSTOMERS;
    const selected = useMemo(() => days.find((d) => d.event_day_id === data?.event_day_id), [days, data?.event_day_id]);

    if (error) {
        return (
            <div className="rounded-lg bg-red-50 p-4 text-red-600 dark:bg-red-900/20 dark:text-red-400">
                {getApiErrorMessage(error, 'Failed to load the repeat customer report.')}
            </div>
        );
    }

    return (
        <div className="space-y-4 sm:space-y-6">
            <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-md dark:border-gray-700 dark:bg-gray-800 sm:p-6">
                <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                        <h2 className="text-xl font-black text-sffl-navy dark:text-white sm:text-2xl">Repeat Customers</h2>
                        <p className="mt-1 max-w-prose text-sm text-gray-500 dark:text-gray-400">
                            A buyer is returning when they paid for a ticket on an earlier day, matched by email or phone.
                            Gifts, free tickets and player tickets don&apos;t count.
                        </p>
                    </div>
                    <Field label="Game day" htmlFor="repeat-customers-day" className="sm:w-72">
                        <Select
                            id="repeat-customers-day"
                            value={data?.event_day_id ?? ''}
                            onChange={(e) => setPickedDay(e.target.value)}
                            disabled={days.length === 0}
                        >
                            {days.length === 0 && <option value="">No ticket sales yet</option>}
                            {days.map((d) => (
                                <option key={d.event_day_id} value={d.event_day_id}>
                                    {d.title || 'Match day'} · {dayLabel(d.date)}
                                </option>
                            ))}
                        </Select>
                    </Field>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    <MetricCard label="Buyers" value={(selected?.buyers ?? 0).toLocaleString()} hint="People who bought for this game day" />
                    <MetricCard label="Returning" value={(selected?.returning ?? 0).toLocaleString()} hint="Bought on an earlier day too" />
                    <MetricCard
                        tone="highlight"
                        label="Returning share"
                        value={percent(selected?.returning ?? 0, selected?.buyers ?? 0)}
                        hint="Returning ÷ buyers"
                    />
                </div>

                <h3 className="mb-3 mt-6 text-lg font-black text-sffl-navy dark:text-white">Returning customers</h3>
                <DataTable
                    data={customers}
                    columns={CUSTOMER_COLUMNS}
                    loading={isLoading}
                    getRowId={(c) => c.email}
                    searchPlaceholder="Search returning customers"
                    emptyMessage="No returning customers for this game day yet."
                />
            </div>

            <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-md dark:border-gray-700 dark:bg-gray-800 sm:p-6">
                <h3 className="text-lg font-black text-sffl-navy dark:text-white">Week by week</h3>
                <p className="mb-3 mt-1 text-sm text-gray-500 dark:text-gray-400">
                    Every game day that sold tickets. Select a row to see its returning customers above.
                </p>
                <DataTable
                    data={days}
                    columns={WEEK_COLUMNS}
                    loading={isLoading}
                    searchable={false}
                    itemsPerPage={8}
                    getRowId={(d) => d.event_day_id}
                    onRowClick={(d) => setPickedDay(d.event_day_id)}
                    rowClassName={(d) => (d.event_day_id === data?.event_day_id ? 'bg-red-50 dark:bg-red-900/20' : '')}
                    emptyMessage="No ticket sales yet."
                />
            </div>
        </div>
    );
};
