import type { Match, Team } from '../types';

export const MOCK_TEAMS: Record<string, Team> = {
    't1': { id: 't1', name: 'Raptors', wins: 5, losses: 1, draws: 0, points: 15, logoUrl: 'https://placehold.co/60x60/red/white?text=R' },
    't2': { id: 't2', name: 'Spartans', wins: 4, losses: 2, draws: 0, points: 12, logoUrl: 'https://placehold.co/60x60/green/white?text=S' },
    't3': { id: 't3', name: 'Vipers', wins: 3, losses: 3, draws: 0, points: 9, logoUrl: 'https://placehold.co/60x60/yellow/black?text=V' },
    't4': { id: 't4', name: 'Hawks', wins: 0, losses: 6, draws: 0, points: 0, logoUrl: 'https://placehold.co/60x60/blue/white?text=H' },
};

export const MOCK_MATCHES: Match[] = [
    {
        id: 'm1',
        homeTeamId: 't1',
        awayTeamId: 't2',
        homeScore: 24,
        awayScore: 18,
        date: '2023-10-15T14:00:00Z',
        status: 'completed',
        venue: 'Main Stadium',
    },
    {
        id: 'm2',
        homeTeamId: 't3',
        awayTeamId: 't4',
        homeScore: 30,
        awayScore: 12,
        date: '2023-10-15T16:00:00Z',
        status: 'completed',
        venue: 'Main Stadium',
    },
    {
        id: 'm3',
        homeTeamId: 't1',
        awayTeamId: 't3',
        date: '2023-10-22T14:00:00Z',
        status: 'scheduled',
        venue: 'Main Stadium',
    },
    {
        id: 'm4',
        homeTeamId: 't2',
        awayTeamId: 't4',
        date: '2023-10-22T16:00:00Z',
        status: 'scheduled',
        venue: 'Training Ground',
    },
];
