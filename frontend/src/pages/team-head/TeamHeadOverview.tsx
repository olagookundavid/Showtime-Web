import { Link } from 'react-router-dom';
import { ChevronRightIcon, ShieldCheckIcon } from '@heroicons/react/24/outline';
import { LightboxImage } from '../../components/ui';
import { DashboardPageHeader } from '../../components/dashboard/DashboardPageHeader';
import { TEAM_HEAD_NAV_SECTIONS } from '../../components/team-head/teamHeadNav';
import { useTeamHeadTeam } from '../../components/team-head/useTeamHeadTeam';

// Every page but this one, straight from the sidebar, so the two never disagree.
const QUICK_ACTIONS = TEAM_HEAD_NAV_SECTIONS.flatMap(s => s.links).filter(l => !l.end);

const TeamHeadOverview = () => {
    const team = useTeamHeadTeam();

    if (!team) {
        return (
            <div className="text-center py-20">
                <p className="text-2xl font-black text-gray-400 dark:text-gray-500">No team assigned</p>
                <p className="text-gray-500 mt-2">Contact an admin to get assigned to a team.</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <DashboardPageHeader
                title="Overview"
                subtitle={<>Everything you manage for <span className="font-bold">{team.name}</span>, in one place.</>}
            />

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md border border-gray-200 dark:border-gray-700 p-4 sm:p-6">
                    <div className="flex items-center gap-4 min-w-0">
                        {team.logo ? (
                            <LightboxImage
                                src={team.logo}
                                alt={team.name}
                                thumbnailClassName="w-20 h-20 shrink-0 rounded-xl object-contain bg-gray-50 dark:bg-gray-700/50 p-2 shadow-sm border border-gray-100 dark:border-gray-700"
                            />
                        ) : (
                            <div className="w-20 h-20 shrink-0 rounded-xl bg-sffl-navy/10 flex items-center justify-center text-2xl font-black text-sffl-navy dark:text-white">
                                {team.short_name?.slice(0, 3) || <ShieldCheckIcon className="w-10 h-10" aria-hidden="true" />}
                            </div>
                        )}
                        <div className="min-w-0">
                            <h2 className="text-xl sm:text-2xl font-black text-gray-900 dark:text-white wrap-break-word">{team.name}</h2>
                            <span className="text-sm text-gray-500 dark:text-gray-400 font-medium">{team.short_name}</span>
                        </div>
                    </div>
                </div>

                <div className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-xl shadow-md border border-gray-200 dark:border-gray-700 p-4 sm:p-6">
                    <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Quick Actions</h2>
                    <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {QUICK_ACTIONS.map(link => (
                            <li key={link.path}>
                                <Link
                                    to={link.path}
                                    className="group flex items-center gap-3 h-full min-h-11 p-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-sffl-red/40 hover:bg-sffl-red/5 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-sffl-red/40"
                                >
                                    <span className="shrink-0 w-10 h-10 rounded-lg bg-sffl-red/10 text-sffl-red flex items-center justify-center">
                                        <link.icon className="w-5 h-5" aria-hidden="true" />
                                    </span>
                                    <span className="min-w-0 flex-1">
                                        <span className="block font-bold text-sm text-gray-900 dark:text-white">{link.name}</span>
                                        <span className="block text-xs text-gray-500 dark:text-gray-400 mt-0.5">{link.description}</span>
                                    </span>
                                    <ChevronRightIcon className="w-4 h-4 shrink-0 text-gray-400 group-hover:text-sffl-red transition-colors" aria-hidden="true" />
                                </Link>
                            </li>
                        ))}
                    </ul>
                </div>
            </div>
        </div>
    );
};

export default TeamHeadOverview;
