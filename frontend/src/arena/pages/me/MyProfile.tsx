import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { DocumentTextIcon, PencilSquareIcon, ShieldCheckIcon, Squares2X2Icon, UserCircleIcon } from '@heroicons/react/24/outline';
import { Button, ButtonLink, DashboardPageHeader, Field, Input, Modal, Select, Spinner } from '../../../components';
import { arenaApi } from '../../../services';
import type { ArenaMyPlayerInput, ArenaPlayer, ArenaPlatform } from '../../../types';
import { Crest, EmptyState, Panel, PlayerFace } from '../../components';
import { arenaKeys, useArenaMe, useDivisionClubs, useFollowedClub } from '../../hooks';
import { errorMessage, PLATFORMS, POSITIONS } from '../../utils';

const emptyForm: ArenaMyPlayerInput = { gamertag: '', ea_id: '', platform: 'PS', primary_position: 'ST' };

/** The form for a player's own details, used to create the profile and to edit it. */
const ProfileForm = ({ id, value, onChange, onSubmit }: { id: string; value: ArenaMyPlayerInput; onChange: (v: ArenaMyPlayerInput) => void; onSubmit: () => void }) => (
  <form
    id={id}
    onSubmit={(e: FormEvent) => {
      e.preventDefault();
      onSubmit();
    }}
    className="grid gap-4 sm:grid-cols-2"
  >
    <Field label="Gamertag" htmlFor={`${id}-tag`} hint="The name clubs will see. It must be unique." className="sm:col-span-2">
      <Input id={`${id}-tag`} required minLength={2} maxLength={32} value={value.gamertag} onChange={(e) => onChange({ ...value, gamertag: e.target.value })} />
    </Field>
    <Field label="EA ID" htmlFor={`${id}-ea`} hint="Optional. Your EA account name.">
      <Input id={`${id}-ea`} maxLength={40} value={value.ea_id} onChange={(e) => onChange({ ...value, ea_id: e.target.value })} />
    </Field>
    <Field label="Platform" htmlFor={`${id}-platform`}>
      <Select id={`${id}-platform`} value={value.platform} onChange={(e) => onChange({ ...value, platform: e.target.value as ArenaPlatform })}>
        {PLATFORMS.map((p) => (
          <option key={p.value} value={p.value}>{p.label}</option>
        ))}
      </Select>
    </Field>
    <Field label="Main position" htmlFor={`${id}-pos`} className="sm:col-span-2">
      <Select id={`${id}-pos`} value={value.primary_position} onChange={(e) => onChange({ ...value, primary_position: e.target.value })}>
        {POSITIONS.map((p) => (
          <option key={p} value={p}>{p}</option>
        ))}
      </Select>
    </Field>
  </form>
);

const toForm = (p: ArenaPlayer): ArenaMyPlayerInput => ({ gamertag: p.gamertag, ea_id: p.ea_id, platform: p.platform, primary_position: p.primary_position });

export const ArenaMyProfile = () => {
  const me = useArenaMe();
  const queryClient = useQueryClient();
  const followed = useFollowedClub();
  const clubs = useDivisionClubs();
  const [form, setForm] = useState<ArenaMyPlayerInput>(emptyForm);
  const [editing, setEditing] = useState(false);

  const save = useMutation({
    mutationFn: (input: ArenaMyPlayerInput) => (me.data?.player ? arenaApi.updateMyPlayer(input) : arenaApi.createMyPlayer(input)),
    onSuccess: () => {
      toast.success(me.data?.player ? 'Profile updated.' : 'Your player profile is ready.');
      setEditing(false);
      queryClient.invalidateQueries({ queryKey: arenaKeys.me });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  if (me.isLoading) return <Spinner label="Loading your profile" className="py-16" />;
  const data = me.data;
  const player = data?.player;
  const followedClub = clubs.data?.find((c) => c.id === followed.clubId);

  return (
    <div className="space-y-6">
      <DashboardPageHeader title="My Profile" subtitle="Your player profile, the club you follow, and what is waiting for you." />

      {!player ? (
        <Panel title="Create your player profile">
          <p className="mb-4 max-w-2xl text-sm text-gray-600 dark:text-gray-400">
            Clubs can only send contract offers to players with a profile. It takes a minute, and you can change it later.
          </p>
          <ProfileForm id="create-profile" value={form} onChange={setForm} onSubmit={() => save.mutate(form)} />
          <Button type="submit" form="create-profile" variant="navy" className="mt-5" loading={save.isPending}>
            Create my profile
          </Button>
        </Panel>
      ) : (
        <Panel title="Player profile">
          <div className="flex flex-wrap items-center gap-4">
            <PlayerFace name={player.gamertag} src={player.avatar_url} size="lg" />
            <div className="min-w-0 flex-1">
              <p className="text-xl font-extrabold text-sffl-navy dark:text-white">{player.gamertag}</p>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {player.primary_position} · {PLATFORMS.find((p) => p.value === player.platform)?.label}
                {player.ea_id ? ` · EA ID ${player.ea_id}` : ''}
              </p>
              <p className="mt-1 text-sm font-bold text-sffl-navy dark:text-white">
                {player.club_id ? (
                  <Link to={`/clubs/${player.club_slug}`} className="hover:underline">
                    {player.club_name}{player.shirt_number ? `, number ${player.shirt_number}` : ''}
                  </Link>
                ) : (
                  'Free agent: clubs can offer you a contract'
                )}
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              icon={PencilSquareIcon}
              onClick={() => {
                setForm(toForm(player));
                setEditing(true);
              }}
            >
              Edit profile
            </Button>
          </div>
        </Panel>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Contract offers">
          {data && data.open_offers > 0 ? (
            <div>
              <p className="text-sm text-gray-700 dark:text-gray-300">
                You have <span className="font-black">{data.open_offers}</span> {data.open_offers === 1 ? 'offer' : 'offers'} waiting for your answer.
              </p>
              <ButtonLink to="/me/contracts" variant="navy" size="sm" icon={DocumentTextIcon} className="mt-3">Review offers</ButtonLink>
            </div>
          ) : (
            <EmptyState
              icon={DocumentTextIcon}
              title="No offers waiting"
              description={player ? 'When a club offers you a contract it appears here and in My Contracts.' : 'Create your player profile so clubs can find you.'}
              action={<ButtonLink to="/me/contracts" variant="outline" size="sm">My contracts</ButtonLink>}
            />
          )}
        </Panel>

        <Panel title="My club">
          {followedClub ? (
            <div className="flex flex-wrap items-center gap-3">
              <Crest club={followedClub} size="lg" />
              <div className="min-w-0 flex-1">
                <Link to={`/clubs/${followedClub.slug}`} className="block truncate text-lg font-extrabold text-sffl-navy hover:underline dark:text-white">{followedClub.name}</Link>
                <p className="text-xs text-gray-500">The club you follow</p>
              </div>
              <Button variant="secondary" size="sm" loading={followed.pending} onClick={followed.clear}>Stop following</Button>
            </div>
          ) : (
            <EmptyState icon={ShieldCheckIcon} title="You aren't following a club" description="Follow one to see its position and form on the overview." action={<ButtonLink to="/clubs" variant="navy" size="sm">Choose a club</ButtonLink>} />
          )}
        </Panel>

        {data?.managed_club && (
          <Panel title="Club management" className="lg:col-span-2">
            <div className="flex flex-wrap items-center gap-3">
              <Crest club={data.managed_club} size="lg" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-lg font-extrabold text-sffl-navy dark:text-white">You manage {data.managed_club.name}</p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {data.pending_releases > 0 ? `${data.pending_releases} release ${data.pending_releases === 1 ? 'request needs' : 'requests need'} your answer.` : 'Manage your squad, transfers and team sheets.'}
                </p>
              </div>
              <ButtonLink to="/manage" variant="navy" icon={Squares2X2Icon}>Open my club</ButtonLink>
            </div>
          </Panel>
        )}
      </div>

      {!player && !data?.managed_club && (
        <p className="flex items-center gap-2 text-sm text-gray-500">
          <UserCircleIcon className="h-5 w-5" aria-hidden="true" />
          Running a club instead? Ask the organisers to make you its manager.
        </p>
      )}

      <Modal
        open={editing}
        onClose={() => setEditing(false)}
        title="Edit your profile"
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditing(false)}>Cancel</Button>
            <Button type="submit" form="edit-profile" variant="navy" loading={save.isPending}>Save changes</Button>
          </>
        }
      >
        <ProfileForm id="edit-profile" value={form} onChange={setForm} onSubmit={() => save.mutate(form)} />
      </Modal>
    </div>
  );
};
