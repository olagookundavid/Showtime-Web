import { useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { CalendarDaysIcon } from '@heroicons/react/24/outline';
import { Button, ConfirmDialog, ConfirmSummary, DataTable, Field, Input, Modal, Select, type Column } from '../../../components';
import { arenaApi } from '../../../services';
import type { ArenaDivision, ArenaFixturePlan, ArenaFixtureRequest, ArenaPlannedFixture, ArenaSeason } from '../../../types';
import { Crest } from '../../components';
import { WEEKDAYS, errorMessage, formatKickoffTime, formatMatchDate } from '../../utils';
import { dateValue, invalidateArena, todayInLagos } from './seasonHelpers';

const FORM_ID = 'arena-fixture-form';

interface FixturePreviewModalProps {
  division: ArenaDivision;
  season: ArenaSeason;
  onClose: () => void;
}

interface Preview {
  plan: ArenaFixturePlan;
  request: ArenaFixtureRequest;
}

const rowId = (f: ArenaPlannedFixture) => `${f.matchweek}-${f.home.id}-${f.away.id}`;

const TeamName = ({ club }: { club: ArenaPlannedFixture['home'] }) => (
  <span className="flex min-w-0 items-center gap-2">
    <Crest club={club} size="sm" />
    <span className="truncate">{club.name}</span>
  </span>
);

const columns: Column<ArenaPlannedFixture>[] = [
  {
    header: 'Match',
    sortValue: (f) => f.home.name,
    cell: (f) => (
      <span className="flex min-w-60 items-center gap-2 font-bold text-sffl-navy dark:text-white">
        <TeamName club={f.home} />
        <span className="shrink-0 text-xs font-semibold text-gray-500 dark:text-gray-400">v</span>
        <TeamName club={f.away} />
      </span>
    ),
  },
  { header: 'Matchweek', accessor: 'matchweek', cell: (f) => <span className="tabular">{f.matchweek}</span> },
  { header: 'Kick-off (WAT)', cell: (f) => <span className="whitespace-nowrap">{`${formatMatchDate(f.kickoff_at)}, ${formatKickoffTime(f.kickoff_at)}`}</span> },
];

/**
 * Make a division's fixtures in two steps: choose the first date and legs and
 * look at the plan, then confirm to create it. Nothing is saved until the confirm.
 */
export const FixturePreviewModal = ({ division, season, onClose }: FixturePreviewModalProps) => {
  const qc = useQueryClient();
  const [firstDate, setFirstDate] = useState(() => {
    const start = dateValue(season.starts_on);
    const today = todayInLagos();
    return start && start > today ? start : today;
  });
  const [legs, setLegs] = useState<'1' | '2'>('2');
  const [preview, setPreview] = useState<Preview | null>(null);
  const [week, setWeek] = useState('');
  const [confirming, setConfirming] = useState(false);

  const request = (): ArenaFixtureRequest => ({ first_date: firstDate, legs: legs === '1' ? 1 : 2 });

  const previewMut = useMutation({
    mutationFn: (req: ArenaFixtureRequest) => arenaApi.previewFixtures(division.id, req),
    onSuccess: (plan, req) => {
      setPreview({ plan, request: req });
      setWeek('');
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  const createMut = useMutation({
    mutationFn: (req: ArenaFixtureRequest) => arenaApi.generateFixtures(division.id, req),
    onSuccess: (plan) => {
      toast.success(`${plan.fixtures.length} fixtures created for ${division.name}.`);
      invalidateArena(qc);
      setConfirming(false);
      onClose();
    },
    onError: (err) => {
      setConfirming(false);
      toast.error(errorMessage(err));
    },
  });

  const weeks = useMemo(() => Array.from({ length: preview?.plan.matchweeks ?? 0 }, (_, i) => i + 1), [preview]);
  const rows = useMemo(
    () => (preview ? preview.plan.fixtures.filter((f) => !week || f.matchweek === Number(week)) : []),
    [preview, week],
  );

  const fixtures = preview?.plan.fixtures ?? [];
  const first = fixtures[0]?.kickoff_at ?? null;
  const last = fixtures[fixtures.length - 1]?.kickoff_at ?? null;

  return (
    <>
      <Modal
        open
        onClose={onClose}
        title="Make fixtures"
        subtitle={division.name}
        maxWidth="3xl"
        footer={
          preview ? (
            <>
              <Button variant="outline" onClick={() => setPreview(null)} disabled={createMut.isPending}>
                Change settings
              </Button>
              <Button icon={CalendarDaysIcon} onClick={() => setConfirming(true)}>
                Create fixtures
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" form={FORM_ID} loading={previewMut.isPending}>
                Preview fixtures
              </Button>
            </>
          )
        }
      >
        {preview ? (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-gray-700 dark:text-gray-300">
              <span className="font-bold text-sffl-navy dark:text-white">
                {fixtures.length} matches over {preview.plan.matchweeks} matchweeks
              </span>
              , from {formatMatchDate(first)} to {formatMatchDate(last)}. This is only a preview: nothing is saved until you press Create fixtures.
            </p>
            <DataTable
              data={rows}
              columns={columns}
              compact
              searchable={false}
              itemsPerPage={10}
              getRowId={rowId}
              emptyMessage="No matches in this matchweek."
              headerActions={
                <Select aria-label="Show matchweek" value={week} onChange={(e) => setWeek(e.target.value)} className="w-full sm:w-52">
                  <option value="">All matchweeks</option>
                  {weeks.map((w) => (
                    <option key={w} value={w}>
                      Matchweek {w}
                    </option>
                  ))}
                </Select>
              }
            />
          </div>
        ) : (
          <form
            id={FORM_ID}
            className="grid grid-cols-1 gap-4 sm:grid-cols-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (!firstDate) {
                toast.error('Pick the first date.');
                return;
              }
              previewMut.mutate(request());
            }}
          >
            <p className="text-sm text-gray-600 dark:text-gray-400 sm:col-span-2">
              Fixtures are made for the {division.club_count} clubs in {division.name}. Matches are played on {WEEKDAYS[division.kickoff_day]}s, so the first matchweek is the first {WEEKDAYS[division.kickoff_day]} on or after the date you choose.
            </p>
            <Field label="First date" htmlFor="fixtures-first-date" hint="Matchweek 1 is on or after this date.">
              <Input id="fixtures-first-date" type="date" value={firstDate} required onChange={(e) => setFirstDate(e.target.value)} />
            </Field>
            <Field
              label="How many times do clubs meet?"
              htmlFor="fixtures-legs"
              hint={legs === '2' ? 'Home and away: every club plays every other club twice.' : 'Once: every club plays every other club one time.'}
            >
              <Select id="fixtures-legs" value={legs} onChange={(e) => setLegs(e.target.value as '1' | '2')}>
                <option value="2">Home and away (twice)</option>
                <option value="1">Once</option>
              </Select>
            </Field>
          </form>
        )}
      </Modal>

      <ConfirmDialog
        open={confirming}
        title={`Create fixtures for ${division.name}?`}
        description="This adds every league match to the calendar. You can still move a match, or delete all fixtures before any result is entered."
        body={
          <ConfirmSummary
            rows={[
              ['Division', division.name],
              ['Matches', String(fixtures.length)],
              ['Matchweeks', String(preview?.plan.matchweeks ?? '')],
              ['First match', first ? `${formatMatchDate(first)}, ${formatKickoffTime(first)} WAT` : ''],
            ]}
          />
        }
        confirmLabel="Create fixtures"
        tone="info"
        icon={CalendarDaysIcon}
        pending={createMut.isPending}
        onConfirm={() => preview && createMut.mutate(preview.request)}
        onCancel={() => setConfirming(false)}
      />
    </>
  );
};
