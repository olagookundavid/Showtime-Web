import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getTeams, type Team } from '../../services/api';
import { Loader } from '../../components/ui/Loader';

export const TeamDetail = () => {
    const { id } = useParams<{ id: string }>();

    const { data, isLoading } = useQuery({
        queryKey: ['publicTeamsForDetail'],
        queryFn: () => getTeams(1, 100),
    });

    const team: Team | undefined = data?.data?.find(t => t.id === id);

    if (isLoading) return <Loader />;

    if (!team) {
        return (
            <div className="space-y-6">
                <div className="bg-sffl-navy text-white p-4 md:p-8 rounded-xl md:rounded-2xl shadow-xl">
                    <h1 className="text-3xl md:text-5xl font-black italic">TEAM</h1>
                </div>
                <div className="bg-gray-100 dark:bg-gray-800 p-12 rounded-xl text-center">
                    <div className="text-4xl mb-3">🛡️</div>
                    <p className="text-gray-500 text-lg font-semibold">Team not found.</p>
                    <Link to="/teams" className="text-sffl-red font-bold mt-4 inline-block">← Back to Teams</Link>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center gap-4 bg-sffl-navy text-white p-4 md:p-8 rounded-xl md:rounded-2xl shadow-xl">
                {team.logo && (
                    <img src={team.logo} alt={team.name} className="w-16 h-16 md:w-24 md:h-24 object-contain rounded-lg bg-white/10 p-2" />
                )}
                <div>
                    <h1 className="text-3xl md:text-5xl font-black italic tracking-tighter">{team.name.toUpperCase()}</h1>
                    {team.short_name && <p className="text-gray-300 mt-1 text-sm md:text-lg">{team.short_name}</p>}
                </div>
            </div>

            <div className="bg-white dark:bg-gray-800 p-8 rounded-xl shadow-md text-center">
                <div className="text-4xl mb-3">🚧</div>
                <p className="text-gray-700 dark:text-gray-300 font-semibold">Team page coming soon.</p>
                <Link to="/teams" className="text-sffl-red font-bold mt-4 inline-block">← Back to Teams</Link>
            </div>
        </div>
    );
};
