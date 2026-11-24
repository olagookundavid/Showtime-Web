import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ClipboardDocumentListIcon } from '@heroicons/react/24/outline';
import { ButtonLink, DashboardPageHeader, Spinner } from '../../../components';
import { arenaApi } from '../../../services';
import { EmptyState, Panel } from '../../components';
import { errorMessage } from '../../utils';
import { ResultEntryForm } from './ResultEntryForm';

export const ArenaAdminResultEntry = () => {
  const { matchId = '' } = useParams();

  // Always fetch fresh: the form starts from what's saved, and editing it from stale data would overwrite newer stats.
  const { data, isLoading, error } = useQuery({
    queryKey: ['arena', 'admin', 'result-form', matchId],
    queryFn: () => arenaApi.resultForm(matchId),
    enabled: !!matchId,
    staleTime: 0,
    gcTime: 0,
    refetchOnWindowFocus: false,
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Spinner label="Loading match" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="space-y-6">
        <DashboardPageHeader title="Enter Result" subtitle="This match could not be opened." back={{ to: '/admin/results', label: 'Results' }} />
        <Panel title="Match unavailable">
          <EmptyState
            icon={ClipboardDocumentListIcon}
            title="We couldn't open this match"
            description={error ? errorMessage(error) : 'It may not exist any more, or it is still waiting for its clubs to be decided.'}
            action={<ButtonLink to="/admin/results">Back to results</ButtonLink>}
          />
        </Panel>
      </div>
    );
  }

  return <ResultEntryForm key={data.match.id} form={data} />;
};
