import { useOutletContext } from 'react-router-dom';
import { LightboxImage } from '../../components/ui';

interface TeamInfo {
    id: string;
    name: string;
    short_name: string;
    logo: string;
}

const TeamHeadOverview = () => {
    const { team } = useOutletContext<{ team: TeamInfo | null }>();

    if (!team) {
        return (
            <div className="text-center py-20">
                <p className="text-2xl font-black text-gray-400 dark:text-gray-500">No team assigned</p>
                <p className="text-gray-500 mt-2">Contact an admin to get assigned to a team.</p>
            </div>
        );
    }

    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-3xl font-black text-sffl-navy dark:text-white uppercase">Welcome to {team.name}</h1>
                <p className="text-gray-600 dark:text-gray-400 mt-1">Manage your team's players and details from here.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md border border-gray-200 dark:border-gray-700 p-6">
                    <div className="flex items-center gap-4 mb-4">
                        {team.logo ? (
                            <LightboxImage 
                                src={team.logo} 
                                alt={team.name} 
                                thumbnailClassName="w-20 h-20 rounded-xl object-contain bg-gray-50 dark:bg-gray-700/50 p-2 shadow-sm border border-gray-100 dark:border-gray-700" 
                            />
                        ) : (
                            <div className="w-20 h-20 rounded-xl bg-sffl-navy/10 flex items-center justify-center text-3xl font-black text-sffl-navy">
                                {team.short_name?.slice(0, 3) || '🛡️'}
                            </div>
                        )}
                        <div>
                            <h2 className="text-2xl font-black text-gray-900 dark:text-white uppercase">{team.name}</h2>
                            <span className="text-sm text-gray-500 dark:text-gray-400 font-medium uppercase">{team.short_name}</span>
                        </div>
                    </div>
                </div>

                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md border border-gray-200 dark:border-gray-700 p-6">
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Quick Actions</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <a href="/team-head/players" className="block bg-sffl-red/5 hover:bg-sffl-red/10 border border-sffl-red/20 rounded-lg p-3 transition-colors">
                            <span className="font-bold text-sffl-red text-sm">🏃 Manage Roster</span>
                            <p className="text-xs text-gray-500 mt-0.5">View and manage your team's players.</p>
                        </a>
                        <a href="/team-head/contracts" className="block bg-sffl-navy/5 hover:bg-sffl-navy/10 border border-sffl-navy/20 rounded-lg p-3 transition-colors">
                            <span className="font-bold text-sffl-navy dark:text-blue-400 text-sm">📝 Manage Contracts</span>
                            <p className="text-xs text-gray-500 mt-0.5">Issue, renew, and release contracts.</p>
                        </a>
                        <a href="/team-head/transfers" className="block bg-amber-500/5 hover:bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 transition-colors">
                            <span className="font-bold text-amber-600 dark:text-amber-400 text-sm">🔄 Transfer Market</span>
                            <p className="text-xs text-gray-500 mt-0.5">Trade, list, and bid on players.</p>
                        </a>
                        <a href="/team-head/budget" className="block bg-green-500/5 hover:bg-green-500/10 border border-green-500/20 rounded-lg p-3 transition-colors">
                            <span className="font-bold text-green-600 dark:text-green-400 text-sm">💰 Team Budget</span>
                            <p className="text-xs text-gray-500 mt-0.5">Check remaining point allowances.</p>
                        </a>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default TeamHeadOverview;
