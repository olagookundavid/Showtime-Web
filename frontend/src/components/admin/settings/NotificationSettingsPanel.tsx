import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { MagnifyingGlassIcon, PlusIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { useDebounced } from '../../../hooks';
import { appSettingsApi } from '../../../services';
import type { AdminSettings, NotificationSettings, SettingsUser } from '../../../types';
import { getApiErrorMessage } from '../../../utils';
import { Button, Checkbox, IconButton, Input, Spinner } from '../../ui';
import { SettingsSection } from './SettingsSection';

type Props = {
    settings: NotificationSettings;
    onSaved: (next: AdminSettings) => void;
};

const roleLabel = (role: string) => role.replace(/_/g, ' ');

/** Adds and removes the people who receive the weekly league summary. */
const RecipientPicker = ({ chosen, onChange }: { chosen: SettingsUser[]; onChange: (next: SettingsUser[]) => void }) => {
    const [search, setSearch] = useState('');
    const debounced = useDebounced(search, 250);
    const { data: found = [], isFetching } = useQuery({
        queryKey: ['settings-staff', debounced],
        queryFn: () => appSettingsApi.searchStaff(debounced),
    });
    const chosenIds = new Set(chosen.map((c) => c.user_id));
    const options = found.filter((u) => !chosenIds.has(u.user_id));

    return (
        <div className="space-y-4">
            <div>
                <p className="text-sm font-bold text-gray-700 dark:text-gray-200 mb-2">
                    Receiving the weekly league summary ({chosen.length})
                </p>
                {chosen.length === 0 ? (
                    <p className="text-sm text-gray-500 dark:text-gray-400 rounded-xl border border-dashed border-gray-300 dark:border-gray-600 p-4">
                        Nobody is chosen, so the weekly summary is not sent. Search below and add someone.
                    </p>
                ) : (
                    <ul className="divide-y divide-gray-100 dark:divide-gray-700 rounded-xl border border-gray-200 dark:border-gray-700">
                        {chosen.map((u) => (
                            <li key={u.user_id} className="flex items-center justify-between gap-3 p-3">
                                <div className="min-w-0">
                                    <p className="font-semibold text-gray-900 dark:text-white truncate">{u.name}</p>
                                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{u.email} · {roleLabel(u.role)}</p>
                                </div>
                                <IconButton
                                    icon={XMarkIcon}
                                    label={`Remove ${u.name}`}
                                    variant="ghost"
                                    onClick={() => onChange(chosen.filter((c) => c.user_id !== u.user_id))}
                                />
                            </li>
                        ))}
                    </ul>
                )}
            </div>

            <div className="space-y-2">
                <Input
                    type="search"
                    aria-label="Search staff to add"
                    icon={MagnifyingGlassIcon}
                    placeholder="Search staff by name or email to add"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full sm:max-w-md"
                />
                {isFetching && options.length === 0 ? (
                    <Spinner label="Searching staff" />
                ) : options.length === 0 ? (
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                        {debounced ? 'No other staff match your search.' : 'Everyone on staff is already chosen.'}
                    </p>
                ) : (
                    <ul className="divide-y divide-gray-100 dark:divide-gray-700 rounded-xl border border-gray-200 dark:border-gray-700 max-h-64 overflow-y-auto">
                        {options.map((u) => (
                            <li key={u.user_id} className="flex items-center justify-between gap-3 p-3">
                                <div className="min-w-0">
                                    <p className="font-semibold text-gray-900 dark:text-white truncate">{u.name}</p>
                                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{u.email} · {roleLabel(u.role)}</p>
                                </div>
                                <Button variant="secondary" icon={PlusIcon} onClick={() => onChange([...chosen, u])}>
                                    Add
                                </Button>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </div>
    );
};

/** Who hears about contracts running out, and whether they do at all. */
export const NotificationSettingsPanel = ({ settings, onSaved }: Props) => {
    const [teamSummaries, setTeamSummaries] = useState(settings.team_summaries_enabled);
    const [leagueDigest, setLeagueDigest] = useState(settings.league_digest_enabled);
    const [recipients, setRecipients] = useState<SettingsUser[]>(settings.league_digest_recipients);
    const [saving, setSaving] = useState(false);

    // A save returns the stored settings; show those rather than what was typed.
    useEffect(() => {
        setTeamSummaries(settings.team_summaries_enabled);
        setLeagueDigest(settings.league_digest_enabled);
        setRecipients(settings.league_digest_recipients);
    }, [settings]);

    const dirty =
        teamSummaries !== settings.team_summaries_enabled ||
        leagueDigest !== settings.league_digest_enabled ||
        recipients.map((r) => r.user_id).join() !== settings.league_digest_recipients.map((r) => r.user_id).join();

    const save = async () => {
        setSaving(true);
        try {
            const next = await appSettingsApi.saveNotifications({
                team_summaries_enabled: teamSummaries,
                league_digest_enabled: leagueDigest,
                league_digest_recipients: recipients.map((r) => r.user_id),
            });
            onSaved(next);
            toast.success('Notification settings saved.');
        } catch (err) {
            toast.error(getApiErrorMessage(err, 'Could not save the notification settings.'));
        } finally {
            setSaving(false);
        }
    };

    return (
        <SettingsSection
            title="Contract emails and notifications"
            description="Tell the right people when contracts are about to run out. Team managers hear about their own squad; the people chosen below get one summary across the whole league every Monday morning."
            footer={
                <Button onClick={save} loading={saving} disabled={!dirty}>
                    Save notification settings
                </Button>
            }
        >
            <Checkbox
                label="Send team managers a summary of their expiring players"
                hint="By email and in the app, whenever a player nears the end of a contract or a contract expires."
                checked={teamSummaries}
                onChange={(e) => setTeamSummaries(e.target.checked)}
            />
            <Checkbox
                label="Send the weekly league-wide summary"
                hint="Every Monday at 08:00 Lagos time, to the people chosen below. Skipped in a week with nothing to report."
                checked={leagueDigest}
                onChange={(e) => setLeagueDigest(e.target.checked)}
            />
            <RecipientPicker chosen={recipients} onChange={setRecipients} />
        </SettingsSection>
    );
};
