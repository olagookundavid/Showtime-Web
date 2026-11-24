import { useEffect, useMemo, useState, type ComponentType, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  CheckCircleIcon,
  ExclamationCircleIcon,
  ExclamationTriangleIcon,
  LockClosedIcon,
  PaperAirplaneIcon,
  PencilSquareIcon,
  SparklesIcon,
} from '@heroicons/react/24/outline';
import { Button, Checkbox, ConfirmDialog, ConfirmSummary, Field, Select } from '../../../components';
import { arenaApi } from '../../../services';
import type { ArenaSheetEditor } from '../../../types';
import { Crest, Panel, PitchBoard, StatusBadge, type PitchSlot } from '../../components';
import { errorMessage, formatKickoffTime, formatMatchDate, matchRound } from '../../utils';
import { manageKeys } from './ContractShared';
import {
  MAX_BENCH,
  SLOTS,
  assignSlot,
  changeFormation,
  draftFromEditor,
  draftFromSheet,
  fitsSlot,
  playerMap,
  sameDraft,
  sheetProblems,
  toSaveBody,
  type SheetDraft,
} from './SheetLogic';
import { SheetPlayerPicker } from './SheetPlayerPicker';

interface SheetEditorViewProps {
  editor: ArenaSheetEditor;
  /** Set when organiser staff are editing another club's sheet. */
  clubId?: string;
  /** Tells the page whether there is work that would be lost by leaving. */
  onDirtyChange: (dirty: boolean) => void;
}

type Confirm = 'submit' | 'reopen' | 'autopick' | null;

const Callout = ({
  tone,
  icon: Icon,
  title,
  children,
}: {
  tone: 'warning' | 'info';
  icon: ComponentType<{ className?: string }>;
  title: string;
  children: ReactNode;
}) => (
  <div
    role="status"
    className={`flex items-start gap-3 rounded-xl border p-4 text-sm ${
      tone === 'warning'
        ? 'border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200'
        : 'border-sky-200 bg-sky-50 text-sky-900 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-200'
    }`}
  >
    <Icon className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
    <div className="min-w-0">
      <p className="font-bold">{title}</p>
      <div className="mt-0.5 wrap-break-word">{children}</div>
    </div>
  </div>
);

/** The team sheet editor for one match: formation, XI, captain and bench. */
export const SheetEditorView = ({ editor, clubId, onDirtyChange }: SheetEditorViewProps) => {
  const qc = useQueryClient();
  const matchId = editor.match.id;
  const roster = useMemo(() => editor.roster ?? [], [editor.roster]);
  const formations = editor.formations;
  const players = useMemo(() => playerMap(roster), [roster]);
  const initial = useMemo(() => draftFromEditor(editor), [editor]);

  const [base, setBase] = useState<SheetDraft>(initial.draft);
  const [draft, setDraft] = useState<SheetDraft>(initial.draft);
  const [removed, setRemoved] = useState(initial.removed);
  const [seen, setSeen] = useState(editor);
  const [pickerSlot, setPickerSlot] = useState<number | null>(null);
  const [confirm, setConfirm] = useState<Confirm>(null);

  const dirty = removed > 0 || !sameDraft(draft, base);

  // A fresher copy from the server replaces the draft only when nothing has been changed here.
  if (seen !== editor) {
    setSeen(editor);
    if (!dirty) {
      setBase(initial.draft);
      setDraft(initial.draft);
      setRemoved(initial.removed);
    }
  }

  const sheet = editor.sheet;
  const submitted = sheet.status === 'submitted';
  const readOnly = editor.locked || submitted;
  const formation = formations.find((f) => f.name === draft.formation) ?? formations[0];

  useEffect(() => {
    onDirtyChange(dirty && !readOnly);
  }, [dirty, readOnly, onDirtyChange]);
  useEffect(() => () => onDirtyChange(false), [onDirtyChange]);

  const adopt = (next: ArenaSheetEditor) => {
    qc.setQueryData(manageKeys.sheet(matchId, clubId), next);
    const d = draftFromEditor(next);
    setBase(d.draft);
    setDraft(d.draft);
    setRemoved(d.removed);
    setSeen(next);
  };

  const save = useMutation({
    mutationFn: (submit: boolean) => arenaApi.saveSheet(matchId, toSaveBody(draft, submit), clubId),
    onSuccess: (next, submit) => {
      toast.success(submit ? 'Team sheet submitted.' : 'Draft saved.');
      adopt(next);
      setConfirm(null);
    },
    onError: (err) => {
      toast.error(errorMessage(err));
      setConfirm(null);
    },
  });

  const reopen = useMutation({
    mutationFn: () => arenaApi.reopenSheet(matchId, clubId),
    onSuccess: (next) => {
      toast.success('You can edit your team sheet again. Submit it when you are done.');
      adopt(next);
      setConfirm(null);
    },
    onError: (err) => {
      toast.error(errorMessage(err));
      setConfirm(null);
    },
  });

  const autopick = useMutation({
    mutationFn: () => arenaApi.autoPick(draft.formation, clubId),
    onSuccess: (picked) => {
      setDraft(draftFromSheet(picked, players).draft);
      toast.success('Lineup filled in. Check it, then save or submit.');
      setConfirm(null);
    },
    onError: (err) => {
      toast.error(errorMessage(err));
      setConfirm(null);
    },
  });

  const problems = useMemo(() => {
    const list = sheetProblems(draft, formation, players);
    if (roster.length < SLOTS) list.unshift(`Your squad has ${roster.length} players. You need at least ${SLOTS} to fill a team.`);
    else if (!roster.some((p) => p.primary_position === 'GK')) list.unshift('Your squad has no goalkeeper. Sign one before you can submit.');
    if (!dirty) for (const e of editor.errors ?? []) if (!list.includes(e)) list.push(e);
    return list;
  }, [draft, formation, players, roster, dirty, editor.errors]);

  const myId = sheet.club_id;
  const opponent = editor.match.home_club_id === myId ? editor.match.away : editor.match.home;
  const venue = editor.match.home_club_id === myId ? 'Home' : 'Away';
  const when = `${formatMatchDate(editor.match.kickoff_at)}, ${formatKickoffTime(editor.match.kickoff_at)} WAT`;
  const captain = players.get(draft.captain);
  const starterIds = draft.starters.filter(Boolean);
  const benchPool = roster.filter((p) => !starterIds.includes(p.id));
  const busy = save.isPending || reopen.isPending || autopick.isPending;

  const slots: PitchSlot[] = formation.slots.map((_, i) => {
    const p = players.get(draft.starters[i]);
    return {
      index: i,
      label: p?.gamertag ?? 'Empty',
      number: p?.shirt_number ?? null,
      captain: !!p && p.id === draft.captain,
      onSelect: readOnly ? undefined : () => setPickerSlot(i),
    };
  });

  const slotLabel = (i: number, p: (typeof roster)[number]) => {
    const at = draft.starters.indexOf(p.id);
    return `${p.gamertag}, ${p.primary_position}${p.shirt_number !== null ? ` #${p.shirt_number}` : ''}${at >= 0 && at !== i ? ' (swap)' : ''}`;
  };

  const toggleBench = (id: string, on: boolean) =>
    setDraft((d) => ({ ...d, bench: on ? [...d.bench, id] : d.bench.filter((b) => b !== id) }));

  return (
    <div className="space-y-4">
      <section className="flex min-w-0 flex-col gap-3 rounded-xl border border-gray-200 bg-white p-4 dark:border-white/10 dark:bg-white/5 sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <div className="flex min-w-0 items-center gap-3">
          {opponent && <Crest club={opponent} size="lg" />}
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
              {matchRound(editor.match)} &middot; {venue}
            </p>
            <h2 className="truncate text-xl font-black text-sffl-navy dark:text-white">{opponent ? `vs ${opponent.name}` : 'Opponent to be decided'}</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">{when}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {editor.locked ? (
            <StatusBadge tone="neutral">Locked</StatusBadge>
          ) : (
            <StatusBadge tone={submitted ? 'success' : 'pending'}>{submitted ? 'Submitted' : 'Draft'}</StatusBadge>
          )}
          {sheet.revision > 0 && <StatusBadge tone="info">Revision {sheet.revision}</StatusBadge>}
          {!sheet.id && <StatusBadge>Not saved yet</StatusBadge>}
          {dirty && !readOnly && <StatusBadge tone="pending">Unsaved changes</StatusBadge>}
        </div>
      </section>

      {sheet.review_reason && (
        <Callout tone="warning" icon={ExclamationTriangleIcon} title="Please review this team sheet">
          {sheet.review_reason} Check your lineup, then submit it again.
        </Callout>
      )}
      {editor.locked && (
        <Callout tone="info" icon={LockClosedIcon} title="This team sheet is locked">
          {editor.lock_reason || 'It can no longer be changed.'}
        </Callout>
      )}
      {submitted && !editor.locked && (
        <Callout tone="info" icon={CheckCircleIcon} title="This team sheet is submitted">
          It is ready for the match. Choose Edit again if you need to change it. You will have to submit it again afterwards.
        </Callout>
      )}
      {removed > 0 && !readOnly && (
        <Callout tone="warning" icon={ExclamationTriangleIcon} title="Some players have left your squad">
          {removed === 1 ? 'One player was' : `${removed} players were`} taken off this sheet because they are no longer registered with you. Fill the empty places, then save.
        </Callout>
      )}
      {roster.length < SLOTS && !readOnly && (
        <Callout tone="warning" icon={ExclamationTriangleIcon} title="Your squad is too small">
          You have {roster.length} {roster.length === 1 ? 'player' : 'players'} and need at least {SLOTS}.{' '}
          <Link to="/manage/transfers?tab=free" className="font-bold underline">
            Sign players
          </Link>
        </Callout>
      )}

      <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
        <Panel title="Lineup">
          <div className="space-y-4">
            <Field label="Formation" htmlFor="sheet-formation" hint="Players keep their place where their position still fits. Check the lineup after you change it.">
              <Select
                id="sheet-formation"
                value={draft.formation}
                disabled={readOnly}
                onChange={(e) => {
                  const next = formations.find((f) => f.name === e.target.value);
                  if (next) setDraft((d) => changeFormation(d, next, players));
                }}
              >
                {formations.map((f) => (
                  <option key={f.name} value={f.name}>
                    {f.name}
                  </option>
                ))}
              </Select>
            </Field>
            <PitchBoard formation={formation} slots={slots} label={`Starting XI in a ${formation.name} formation`} />
            {!readOnly && <p className="text-center text-xs text-gray-500 dark:text-gray-400">Tap a place on the pitch to choose who plays there.</p>}
          </div>
        </Panel>

        <div className="space-y-4">
          <Panel title="Starting XI">
            <ul className="space-y-3">
              {formation.slots.map((pos, i) => (
                <li key={i} className="grid grid-cols-[3.25rem_1fr] items-center gap-3">
                  <label htmlFor={`sheet-slot-${i}`} className="text-sm font-black text-sffl-navy dark:text-white">
                    <span className="sr-only">Place {i + 1}: </span>
                    {pos}
                  </label>
                  <Select
                    id={`sheet-slot-${i}`}
                    value={draft.starters[i] ?? ''}
                    disabled={readOnly}
                    onChange={(e) => setDraft((d) => assignSlot(d, i, e.target.value, formation, players))}
                  >
                    <option value="">Empty. Choose a player</option>
                    {roster
                      .filter((p) => fitsSlot(pos, p))
                      .map((p) => (
                        <option key={p.id} value={p.id}>
                          {slotLabel(i, p)}
                        </option>
                      ))}
                  </Select>
                </li>
              ))}
            </ul>
            <Field label="Captain" htmlFor="sheet-captain" className="mt-5" hint="The captain has to be one of your starters.">
              <Select
                id="sheet-captain"
                value={draft.captain}
                disabled={readOnly || starterIds.length === 0}
                onChange={(e) => setDraft((d) => ({ ...d, captain: e.target.value }))}
              >
                <option value="">Choose a captain</option>
                {starterIds.map((id) => (
                  <option key={id} value={id}>
                    {players.get(id)?.gamertag ?? 'Unknown player'}
                  </option>
                ))}
              </Select>
            </Field>
          </Panel>

          <Panel title={`Substitutes (${draft.bench.length} of ${MAX_BENCH})`}>
            {benchPool.length === 0 ? (
              <p className="text-sm text-gray-600 dark:text-gray-400">Everyone in your squad is in the starting XI, so there is nobody left for the bench.</p>
            ) : (
              <>
                <p className="mb-2 text-sm text-gray-600 dark:text-gray-400">Pick up to {MAX_BENCH} players who start on the bench.</p>
                <ul className="divide-y divide-gray-100 dark:divide-white/10">
                  {benchPool.map((p) => {
                    const on = draft.bench.includes(p.id);
                    return (
                      <li key={p.id}>
                        <Checkbox
                          label={p.gamertag}
                          hint={`${p.primary_position}${p.shirt_number !== null ? ` · #${p.shirt_number}` : ''}`}
                          checked={on}
                          disabled={readOnly || (!on && draft.bench.length >= MAX_BENCH)}
                          onChange={(e) => toggleBench(p.id, e.target.checked)}
                        />
                      </li>
                    );
                  })}
                </ul>
                {!readOnly && draft.bench.length >= MAX_BENCH && (
                  <p className="mt-2 text-xs font-semibold text-gray-600 dark:text-gray-400">The bench is full. Untick someone to pick another player.</p>
                )}
              </>
            )}
          </Panel>
        </div>
      </div>

      {!editor.locked && (
        <Panel title={submitted ? 'Ready for the match' : 'Save or submit'}>
          <div className="space-y-4">
            {!readOnly && problems.length > 0 && (
              <div>
                <p className="mb-1.5 text-sm font-bold text-gray-800 dark:text-gray-200">Before you can submit</p>
                <ul className="space-y-1">
                  {problems.map((m) => (
                    <li key={m} className="flex items-start gap-2 text-sm text-amber-800 dark:text-amber-300">
                      <ExclamationCircleIcon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                      <span className="min-w-0 wrap-break-word">{m}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {!readOnly && problems.length === 0 && (
              <p className="flex items-center gap-2 text-sm font-bold text-emerald-700 dark:text-emerald-400">
                <CheckCircleIcon className="h-5 w-5 shrink-0" aria-hidden="true" />
                Your team sheet is complete and ready to submit.
              </p>
            )}
            {dirty && !readOnly && (
              <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">You have changes that are not saved yet. Save a draft or submit before you leave.</p>
            )}

            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              {submitted ? (
                <Button icon={PencilSquareIcon} variant="secondary" loading={reopen.isPending} onClick={() => setConfirm('reopen')} className="w-full sm:w-auto">
                  Edit again
                </Button>
              ) : (
                <>
                  <Button
                    variant="outline"
                    icon={SparklesIcon}
                    disabled={busy}
                    onClick={() => (starterIds.length > 0 || draft.bench.length > 0 ? setConfirm('autopick') : autopick.mutate())}
                    loading={autopick.isPending}
                    className="w-full sm:w-auto"
                  >
                    Auto-pick
                  </Button>
                  <Button variant="secondary" disabled={busy} loading={save.isPending && !save.variables} onClick={() => save.mutate(false)} className="w-full sm:w-auto">
                    Save draft
                  </Button>
                  <Button
                    icon={PaperAirplaneIcon}
                    disabled={problems.length > 0 || busy}
                    onClick={() => setConfirm('submit')}
                    className="w-full sm:w-auto"
                  >
                    Submit team sheet
                  </Button>
                </>
              )}
            </div>
          </div>
        </Panel>
      )}

      {pickerSlot !== null && (
        <SheetPlayerPicker
          slot={pickerSlot}
          slotPositions={formation.slots}
          draft={draft}
          roster={roster}
          onPick={(id) => {
            setDraft((d) => assignSlot(d, pickerSlot, id, formation, players));
            setPickerSlot(null);
          }}
          onClose={() => setPickerSlot(null)}
        />
      )}

      <ConfirmDialog
        open={confirm === 'submit'}
        title="Submit this team sheet?"
        description="This is the lineup you are putting forward for the match. You can still edit it again until kick-off."
        body={
          <ConfirmSummary
            rows={[
              ['Match', opponent ? `${venue} vs ${opponent.name}` : undefined],
              ['Kick-off', when],
              ['Formation', draft.formation],
              ['Captain', captain?.gamertag],
              ['Substitutes', `${draft.bench.length} of ${MAX_BENCH}`],
            ]}
          />
        }
        confirmLabel="Submit team sheet"
        tone="success"
        icon={PaperAirplaneIcon}
        pending={save.isPending}
        onConfirm={() => save.mutate(true)}
        onCancel={() => setConfirm(null)}
      />
      <ConfirmDialog
        open={confirm === 'reopen'}
        title="Edit this team sheet again?"
        description="It goes back to a draft and won't count for the match until you submit it again."
        confirmLabel="Edit again"
        tone="warning"
        icon={PencilSquareIcon}
        pending={reopen.isPending}
        onConfirm={() => reopen.mutate()}
        onCancel={() => setConfirm(null)}
      />
      <ConfirmDialog
        open={confirm === 'autopick'}
        title="Replace your lineup?"
        description="Auto-pick fills the starting XI and the bench from your squad using the formation you chose. Your current picks, including unsaved ones, are replaced. Nothing is saved until you save."
        confirmLabel="Auto-pick"
        tone="warning"
        icon={SparklesIcon}
        pending={autopick.isPending}
        onConfirm={() => autopick.mutate()}
        onCancel={() => setConfirm(null)}
      />
    </div>
  );
};
