import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { BanknotesIcon, BellIcon, DocumentTextIcon, SwatchIcon } from '@heroicons/react/24/outline';
import {
    AppearanceSettings,
    ContractSettingsPanel,
    DashboardPageHeader,
    FantasySettingsPanel,
    NotificationSettingsPanel,
    Spinner,
    Tabs,
    Button,
} from '../../components';
import { appSettingsApi } from '../../services';
import type { AdminSettings as AdminSettingsData } from '../../types';

type Tab = 'appearance' | 'contracts' | 'notifications' | 'fantasy';

const SETTINGS_KEY = ['admin-settings'] as const;

export const AdminSettings = () => {
    const [tab, setTab] = useState<Tab>('appearance');
    const queryClient = useQueryClient();
    const { data, isLoading, isError, refetch } = useQuery({
        queryKey: SETTINGS_KEY,
        queryFn: appSettingsApi.getAdmin,
    });

    // A save returns everything as stored, so every tab shows the saved truth.
    const onSaved = (next: AdminSettingsData) => queryClient.setQueryData(SETTINGS_KEY, next);

    return (
        <div className="space-y-6 pb-mobile-nav-2x">
            <DashboardPageHeader
                title="App Settings"
                subtitle="Site-wide choices: how the app looks, how long contracts run, who gets contract emails, and the fantasy platform cut."
            />

            <Tabs
                aria-label="Settings"
                items={[
                    { value: 'appearance', label: 'Appearance', icon: SwatchIcon },
                    { value: 'contracts', label: 'Contracts', icon: DocumentTextIcon },
                    { value: 'notifications', label: 'Notifications', icon: BellIcon },
                    { value: 'fantasy', label: 'Fantasy', icon: BanknotesIcon },
                ]}
                value={tab}
                onChange={setTab}
            />

            {tab === 'appearance' && <AppearanceSettings />}

            {tab !== 'appearance' && isLoading && <Spinner label="Loading settings" />}

            {tab !== 'appearance' && isError && (
                <div className="rounded-2xl border border-red-200 dark:border-red-800/60 bg-red-50 dark:bg-red-900/20 p-4 flex flex-wrap items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-red-700 dark:text-red-300">The settings could not be loaded.</p>
                    <Button variant="secondary" onClick={() => refetch()}>
                        Try again
                    </Button>
                </div>
            )}

            {data && tab === 'contracts' && <ContractSettingsPanel settings={data.contracts} onSaved={onSaved} />}
            {data && tab === 'notifications' && <NotificationSettingsPanel settings={data.notifications} onSaved={onSaved} />}
            {data && tab === 'fantasy' && <FantasySettingsPanel settings={data.fantasy} onSaved={onSaved} />}
        </div>
    );
};

export default AdminSettings;
