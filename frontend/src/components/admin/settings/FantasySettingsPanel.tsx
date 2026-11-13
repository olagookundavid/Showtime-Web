import { useState } from 'react';
import toast from 'react-hot-toast';
import { BanknotesIcon } from '@heroicons/react/24/outline';
import { appSettingsApi } from '../../../services';
import type { AdminSettings, FantasySettings } from '../../../types';
import { getApiErrorMessage } from '../../../utils';
import { Button, ConfirmDialog, ConfirmSummary, Field, Input } from '../../ui';
import { SettingsSection } from './SettingsSection';

type Props = {
    settings: FantasySettings;
    onSaved: (next: AdminSettings) => void;
};

const MAX_CUT = 50;

/** The share of paid fantasy league entry fees the platform keeps. */
export const FantasySettingsPanel = ({ settings, onSaved }: Props) => {
    const [cut, setCut] = useState(String(settings.platform_cut_percent));
    const [confirming, setConfirming] = useState(false);
    const [saving, setSaving] = useState(false);

    const value = parseFloat(cut);
    const valid = Number.isFinite(value) && value >= 0 && value <= MAX_CUT;
    const dirty = valid && value !== settings.platform_cut_percent;

    const save = async () => {
        setSaving(true);
        try {
            const next = await appSettingsApi.saveFantasy({ platform_cut_percent: value });
            onSaved(next);
            setCut(String(next.fantasy.platform_cut_percent));
            toast.success('Platform cut saved.');
        } catch (err) {
            toast.error(getApiErrorMessage(err, 'Could not save the platform cut.'));
        } finally {
            setSaving(false);
            setConfirming(false);
        }
    };

    return (
        <SettingsSection
            title="Fantasy platform cut"
            description="The share of each paid league's entry fees that Showtime keeps. The rest becomes the prize pool. It is applied when a league settles, so it changes what leagues pay out from now on."
            footer={
                <Button onClick={() => setConfirming(true)} disabled={!dirty}>
                    Save platform cut
                </Button>
            }
        >
            <Field
                label="Platform cut (%)"
                htmlFor="set-platform-cut"
                hint={`Between 0 and ${MAX_CUT}. For example, 2.5 keeps ₦25 of every ₦1,000 paid in.`}
                error={cut !== '' && !valid ? `Enter a number between 0 and ${MAX_CUT}.` : undefined}
                className="max-w-xs"
            >
                <Input id="set-platform-cut" type="number" min="0" max={MAX_CUT} step="0.1" value={cut} invalid={cut !== '' && !valid} onChange={(e) => setCut(e.target.value)} />
            </Field>

            <ConfirmDialog
                open={confirming}
                title="Change the platform cut?"
                description="This decides how much of every paid league's entry fees Showtime keeps when it settles."
                confirmLabel="Change Cut"
                tone="warning"
                icon={BanknotesIcon}
                pending={saving}
                body={<ConfirmSummary rows={[['Now', `${settings.platform_cut_percent}%`], ['Change to', `${valid ? value : cut}%`]]} />}
                onConfirm={save}
                onCancel={() => setConfirming(false)}
            />
        </SettingsSection>
    );
};
