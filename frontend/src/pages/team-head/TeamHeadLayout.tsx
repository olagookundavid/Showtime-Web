import { useQuery } from '@tanstack/react-query';
import api, { teamHeadClaimsApi } from '../../services/api';
import { DashboardShell } from '../../components/dashboard/DashboardShell';
import {
    TEAM_HEAD_BOTTOM_NAV,
    TEAM_HEAD_CLAIMS_PATH,
    TEAM_HEAD_HOME,
    TEAM_HEAD_NAV_SECTIONS,
} from '../../components/team-head/teamHeadNav';
import type { TeamHeadOutletContext, TeamHeadTeam } from '../../components/team-head/useTeamHeadTeam';

const TeamHeadLayout = () => {
    // Surfaces how many players are waiting on this manager to confirm who they are.
    // Without a badge the queue is invisible, and a claim nobody looks at is a player
    // who never gets an account.
    const { data: pendingClaims } = useQuery({
        queryKey: ['teamHeadPendingClaims'],
        queryFn: async () => {
            // Counts only what the manager can actually clear: roster claims, plus
            // new-player requests still waiting on their endorsement. A request they
            // have already answered belongs to the league office now.
            return await teamHeadClaimsApi.pendingCount();
        },
        refetchOnWindowFocus: true,
    });

    const { data: teamData } = useQuery({
        queryKey: ['myTeamHead'],
        queryFn: async () => {
            const res = await api.get('/team-head/my-team');
            return res.data.data as TeamHeadTeam;
        },
        retry: false,
    });

    const team = teamData || null;
    const outletContext: TeamHeadOutletContext = { team };

    return (
        <DashboardShell
            sections={TEAM_HEAD_NAV_SECTIONS}
            homePath={TEAM_HEAD_HOME}
            brandLabel={team?.short_name ? `Team Head · ${team.short_name}` : 'Team Head'}
            navLabel="Team head"
            drawerLabel="Team head menu"
            bottomNavLabel="Team head shortcuts"
            moreLabel="More team head pages"
            collapsedStorageKey="sffl_team_head_sidebar_collapsed"
            bottomNavItems={TEAM_HEAD_BOTTOM_NAV}
            badges={{ [TEAM_HEAD_CLAIMS_PATH]: pendingClaims ?? 0 }}
            logoutDescription="You will need to sign in again to manage your team."
            outletContext={outletContext}
        />
    );
};

export default TeamHeadLayout;
