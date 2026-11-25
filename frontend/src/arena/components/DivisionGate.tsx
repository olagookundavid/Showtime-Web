import type { ReactNode } from 'react';
import type { UseQueryResult } from '@tanstack/react-query';
import { ExclamationTriangleIcon, TrophyIcon } from '@heroicons/react/24/outline';
import { Button, Spinner } from '../../components';
import { useArenaScope } from '../scope';
import { EmptyState } from './EmptyState';

/**
 * Wraps a public page's content so every page handles the same cases the same
 * way: still loading, no season yet, no divisions yet, or the request failed.
 */
export const DivisionGate = ({ query, children }: { query?: UseQueryResult<unknown>; children: ReactNode }) => {
  const { season, division, isLoading } = useArenaScope();

  if (isLoading || query?.isLoading) return <Spinner label="Loading" className="py-16" />;
  if (!season) {
    return (
      <EmptyState
        icon={TrophyIcon}
        title="The season hasn't been set up yet"
        description="Fixtures, tables and stats will appear here as soon as the organisers start the first season. Check back soon."
      />
    );
  }
  if (!division) {
    return (
      <EmptyState
        icon={TrophyIcon}
        title={`${season.name} has no divisions yet`}
        description="Once the organisers add a division and its clubs, its fixtures and table will show here."
      />
    );
  }
  if (query?.isError) {
    return (
      <EmptyState
        icon={ExclamationTriangleIcon}
        title="We couldn't load this page"
        description="Check your connection and try again."
        action={<Button variant="navy" onClick={() => query.refetch()}>Try again</Button>}
      />
    );
  }
  return <>{children}</>;
};
