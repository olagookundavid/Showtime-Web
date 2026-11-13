import { useState } from 'react';
import toast from 'react-hot-toast';
import { appSettingsApi } from '../../../services';
import type { AdminSettings, ContractSettings } from '../../../types';
import { getApiErrorMessage } from '../../../utils';
import { Button, Field, Input } from '../../ui';
import { SettingsSection } from './SettingsSection';

type Props = {
    settings: ContractSettings;
    onSaved: (next: AdminSettings) => void;
};

type Form = Record<keyof ContractSettings, string>;

const toForm = (s: ContractSettings): Form => ({
    default_length: String(s.default_length),
    onboarding_length: String(s.onboarding_length),
    warning_matches: String(s.warning_matches),
});

/** The three numbers that decide how long contracts run and when they count as running out. */
export const ContractSettingsPanel = ({ settings, onSaved }: Props) => {
    const [form, setForm] = useState<Form>(() => toForm(settings));
    const [saving, setSaving] = useState(false);

    const set = (key: keyof Form, value: string) => setForm((f) => ({ ...f, [key]: value }));
    const dirty = (Object.keys(form) as (keyof Form)[]).some((k) => form[k] !== String(settings[k]));

    const save = async () => {
        const payload: ContractSettings = {
            default_length: parseInt(form.default_length, 10),
            onboarding_length: parseInt(form.onboarding_length, 10),
            warning_matches: parseInt(form.warning_matches, 10),
        };
        if (!(payload.default_length >= 1 && payload.default_length <= 50)) {
            toast.error('The default contract length must be between 1 and 50 matches.');
            return;
        }
        if (!(payload.onboarding_length >= 1 && payload.onboarding_length <= 50)) {
            toast.error("A new player's first contract must be between 1 and 50 matches.");
            return;
        }
        if (!(payload.warning_matches >= 1 && payload.warning_matches <= 10)) {
            toast.error('The warning period must be between 1 and 10 matches.');
            return;
        }
        setSaving(true);
        try {
            const next = await appSettingsApi.saveContracts(payload);
            onSaved(next);
            setForm(toForm(next.contracts));
            toast.success('Contract settings saved.');
        } catch (err) {
            toast.error(getApiErrorMessage(err, 'Could not save the contract settings.'));
        } finally {
            setSaving(false);
        }
    };

    return (
        <SettingsSection
            title="Contract lengths"
            description="Contracts are counted in team matches. These numbers apply to contracts made from now on; contracts that already exist keep the length they were signed with."
            footer={
                <Button onClick={save} loading={saving} disabled={!dirty}>
                    Save contract settings
                </Button>
            }
        >
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <Field
                    label="Default contract length"
                    htmlFor="set-default-length"
                    hint="Pre-filled when a team head offers or extends a contract, and used for transfers."
                >
                    <Input id="set-default-length" type="number" min="1" max="50" value={form.default_length} onChange={(e) => set('default_length', e.target.value)} />
                </Field>
                <Field
                    label="First contract for a new player"
                    htmlFor="set-onboarding-length"
                    hint="Given automatically to a player who is added, or whose account claim is approved."
                >
                    <Input id="set-onboarding-length" type="number" min="1" max="50" value={form.onboarding_length} onChange={(e) => set('onboarding_length', e.target.value)} />
                </Field>
                <Field
                    label="Warn when this many matches are left"
                    htmlFor="set-warning-matches"
                    hint="Players and managers hear about a contract once it is this close to ending."
                >
                    <Input id="set-warning-matches" type="number" min="1" max="10" value={form.warning_matches} onChange={(e) => set('warning_matches', e.target.value)} />
                </Field>
            </div>
        </SettingsSection>
    );
};
