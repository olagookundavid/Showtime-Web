import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
    ArchiveBoxIcon,
    CalendarDaysIcon,
    NewspaperIcon,
    ShoppingCartIcon,
} from '@heroicons/react/24/outline';
import {
    Loader,
    FootballIcon,
    DashboardPageHeader,
    SectionKicker,
    MetricCard,
    RankedBarList,
    DataTable,
    type Column,
} from '../../components';
import { getAdminAnalytics } from '../../services/api';
import { formatNaira } from '../../utils';
import type { TicketResponse, SiteBreakdownRow } from '../../types';

const QUICK_ACTIONS = [
    {
        to: '/admin/matches',
        title: 'Add Match',
        subtitle: 'Schedule game',
        icon: FootballIcon,
        iconClass: 'bg-red-50 dark:bg-red-900/30 text-sffl-red',
        hoverClass: 'hover:border-sffl-red dark:hover:border-sffl-red hover:bg-red-50',
    },
    {
        to: '/admin/news',
        title: 'Publish News',
        subtitle: 'Write article',
        icon: NewspaperIcon,
        iconClass: 'bg-blue-50 dark:bg-blue-900/30 text-sffl-navy dark:text-blue-400',
        hoverClass: 'hover:border-sffl-navy dark:hover:border-blue-500 hover:bg-blue-50',
    },
    {
        to: '/admin/event-days',
        title: 'Match Day',
        subtitle: 'Create match day',
        icon: CalendarDaysIcon,
        iconClass: 'bg-green-50 dark:bg-green-900/30 text-green-600',
        hoverClass: 'hover:border-green-500 dark:hover:border-green-500 hover:bg-green-50',
    },
    {
        to: '/admin/inventory',
        title: 'Warehouse Stock',
        subtitle: 'Physical logistics',
        icon: ArchiveBoxIcon,
        iconClass: 'bg-yellow-50 dark:bg-yellow-900/30 text-yellow-600',
        hoverClass: 'hover:border-yellow-500 dark:hover:border-yellow-500 hover:bg-yellow-50',
    },
    {
        to: '/admin/store',
        title: 'Online Store',
        subtitle: 'Manage e-comm',
        icon: ShoppingCartIcon,
        iconClass: 'bg-orange-50 dark:bg-orange-900/30 text-orange-600',
        hoverClass: 'hover:border-orange-500 dark:hover:border-orange-500 hover:bg-orange-50',
    },
];

// "team_head" -> "Team Head"
const formatRoleName = (role: string) => role.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

// A stable empty list, so the table isn't handed a fresh array on every render.
const NO_SALES: TicketResponse[] = [];

// No dependencies, so the columns live here rather than in a useMemo.
const SALES_COLUMNS: Column<TicketResponse>[] = [
    {
        header: 'Match day',
        cell: (sale) => (
            <span className="font-bold text-sffl-navy dark:text-white">
                {sale.days.length > 1
                    ? `Game Pass · ${sale.days.length} match days`
                    : sale.days[0]?.title || '—'}
            </span>
        ),
    },
    {
        header: 'Ticket',
        cell: (sale) => (
            <span className="text-sm font-bold bg-gray-100 dark:bg-gray-600 dark:text-gray-200 px-2 py-1 rounded">
                {sale.product_name || '—'}
            </span>
        ),
    },
    { header: 'Qty', align: 'center', cell: (sale) => sale.quantity },
    {
        header: 'Amount',
        align: 'right',
        sortable: true,
        sortValue: (sale) => sale.total_amount,
        cell: (sale) => <span className="font-bold text-green-600">{formatNaira(sale.total_amount)}</span>,
    },
    {
        header: 'Purchaser',
        cell: (sale) => <span className="text-sm text-gray-600 dark:text-gray-400 break-all">{sale.email}</span>,
    },
    {
        header: 'Time',
        sortable: true,
        sortValue: (sale) => sale.created_at,
        cell: (sale) => (
            <span className="text-xs text-gray-500 dark:text-gray-400">{new Date(sale.created_at).toLocaleString()}</span>
        ),
    },
];

export const Dashboard = () => {
    const {
        data: analytics,
        isLoading: loading,
        error: queryError,
    } = useQuery({
        queryKey: ['adminAnalytics'],
        queryFn: async () => {
            const res = await getAdminAnalytics();
            return res.data;
        }
    });

    const error = queryError
        ? (queryError as { response?: { data?: { error?: string } } }).response?.data?.error || 'Failed to load dashboard data'
        : '';

    if (loading) {
        return <Loader />;
    }

    if (error) {
        return (
            <div className="bg-red-50 text-red-600 p-4 rounded-lg my-4">
                <strong>Error:</strong> {error}
            </div>
        );
    }

    const {
        total_revenue = 0,
        total_tickets_sold = 0,
        total_users = 0,
        users_by_role = {},
        sales_by_tier = [],
    } = analytics || {};
    const recentSales = analytics?.recent_sales ?? NO_SALES;

    const usersByRoleRows: SiteBreakdownRow[] = Object.entries(users_by_role)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count);
    const ticketsByTierRows: SiteBreakdownRow[] = sales_by_tier
        .map((t) => ({ name: t.tier_name, count: t.quantity }))
        .sort((a, b) => b.count - a.count);
    const revenueByTierRows: SiteBreakdownRow[] = sales_by_tier
        .map((t) => ({ name: t.tier_name, count: t.total_amount }))
        .sort((a, b) => b.count - a.count);

    const avgTicketPrice = total_tickets_sold > 0 ? total_revenue / total_tickets_sold : 0;
    const topRole = usersByRoleRows[0];
    const usersHint =
        topRole && total_users > 0
            ? `${Math.round((topRole.count / total_users) * 100)}% are ${formatRoleName(topRole.name)}`
            : 'Total platform signups';

    return (
        <div className="space-y-6 sm:space-y-8 animate-fade-in">
            {/* Header */}
            <DashboardPageHeader
                title="Dashboard"
                subtitle="Welcome back — here's SFFL's performance, sales, and users at a glance."
            />

            {/* KPI Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
                <MetricCard tone="highlight" label="Total Revenue" value={formatNaira(total_revenue)} hint="All time ticket sales" />
                <MetricCard label="Tickets Sold" value={total_tickets_sold.toLocaleString()} hint="Paid and checked-in tickets" />
                <MetricCard label="Registered Users" value={total_users.toLocaleString()} hint={usersHint} />
                <MetricCard label="Avg. Ticket Price" value={formatNaira(avgTicketPrice)} hint="Revenue ÷ tickets sold" />
            </div>

            {/* Quick Actions */}
            <div>
                <SectionKicker>Shortcuts</SectionKicker>
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-4 sm:p-6">
                    <h2 className="text-xl sm:text-2xl font-black text-sffl-navy dark:text-white mb-4">Quick Actions</h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5 gap-4">
                        {QUICK_ACTIONS.map(({ to, title, subtitle, icon: Icon, iconClass, hoverClass }) => (
                            <Link
                                key={to}
                                to={to}
                                className={`flex items-center gap-3 p-4 min-h-11 border-2 border-gray-100 dark:border-gray-700 rounded-lg dark:hover:bg-gray-700 transition-all duration-300 hover:scale-[1.02] active:scale-95 ${hoverClass}`}
                            >
                                <div className={`shrink-0 p-2 rounded-lg ${iconClass}`}>
                                    <Icon className="w-5 h-5" aria-hidden="true" />
                                </div>
                                <div className="min-w-0">
                                    <div className="font-bold text-sffl-navy dark:text-white wrap-break-word">{title}</div>
                                    <div className="text-xs text-gray-500 dark:text-gray-400">{subtitle}</div>
                                </div>
                            </Link>
                        ))}
                    </div>
                </div>
            </div>

            {/* Charts */}
            <div className="space-y-6 sm:space-y-8">
                <div>
                    <SectionKicker>Platform</SectionKicker>
                    <RankedBarList
                        title="Users Breakdown"
                        countLabel="users"
                        rows={usersByRoleRows}
                        formatName={formatRoleName}
                        showShareOfTotal
                        emptyMessage="No user data available to chart."
                    />
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8">
                    <div>
                        <SectionKicker>Sales</SectionKicker>
                        <RankedBarList
                            title="Tickets Sold by Tier"
                            countLabel="tickets"
                            rows={ticketsByTierRows}
                            showShareOfTotal
                            emptyMessage="No sales data available to chart."
                        />
                    </div>
                    <div>
                        <SectionKicker>Sales</SectionKicker>
                        <RankedBarList
                            title="Revenue by Tier"
                            countLabel="in revenue"
                            rows={revenueByTierRows}
                            formatCount={formatNaira}
                            barColorClassName="bg-[#eb6834] dark:bg-[#d95926]"
                            showShareOfTotal
                            emptyMessage="No sales data available to chart."
                        />
                    </div>
                </div>
            </div>

            {/* Recent Sales Table */}
            <div>
                <SectionKicker>Sales</SectionKicker>
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-4 sm:p-6 border-gray-200 dark:border-gray-700 border">
                    <h2 className="text-xl sm:text-2xl font-black text-sffl-navy dark:text-white mb-4">Recent Ticket Sales</h2>
                    {/* The API sends at most the 10 latest sales, so there is nothing to page. */}
                    <DataTable
                        data={recentSales}
                        columns={SALES_COLUMNS}
                        searchable={false}
                        paginated={false}
                        getRowId={(sale) => sale.id}
                        emptyMessage="No recent ticket sales found."
                    />
                </div>
            </div>
        </div>
    );
};
