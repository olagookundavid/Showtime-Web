export interface Player {
    id: string;
    name: string;
    jerseyNumber: number;
    position: string;
    gender?: string;
    team: string;
    stats: {
        touchdowns: number;
        yards: number;
        interceptions?: number;
        tackles?: number;
    };
    bio?: string;
    image?: string;
}

export const mockPlayers: Player[] = [
    {
        id: '1',
        name: 'J. SMITH',
        jerseyNumber: 12,
        position: 'QB',
        team: 'Outlaws',
        stats: {
            touchdowns: 18,
            yards: 2450,
            interceptions: 3,
        },
        bio: 'Star quarterback leading the Outlaws to victory. Known for accurate throws and strategic play.',
        image: 'https://images.unsplash.com/photo-1546962339-5ff89552b8ed?w=400&q=80',
    },
    {
        id: '2',
        name: 'M. JOHNSON',
        jerseyNumber: 7,
        position: 'WR',
        team: 'Dragons',
        stats: {
            touchdowns: 12,
            yards: 1850,
        },
        bio: 'Lightning-fast wide receiver with exceptional catching ability.',
        image: 'https://images.unsplash.com/photo-1566577739112-5180d4bf9390?w=400&q=80',
    },
    {
        id: '3',
        name: 'D. WILLIAMS',
        jerseyNumber: 24,
        position: 'RB',
        team: 'Spartans',
        stats: {
            touchdowns: 15,
            yards: 1920,
        },
        bio: 'Powerful running back known for breaking through defensive lines.',
        image: 'https://images.unsplash.com/photo-1560272564-c83b66b1ad12?w=400&q=80',
    },
    {
        id: '4',
        name: 'T. BROWN',
        jerseyNumber: 88,
        position: 'DE',
        team: 'Titans',
        stats: {
            touchdowns: 2,
            yards: 45,
            tackles: 42,
        },
        bio: 'Defensive powerhouse with incredible speed and agility.',
        image: 'https://images.unsplash.com/photo-1511886929837-354d827aae26?w=400&q=80',
    },
    {
        id: '5',
        name: 'A. DAVIS',
        jerseyNumber: 3,
        position: 'QB',
        team: 'Vipers',
        stats: {
            touchdowns: 14,
            yards: 2100,
            interceptions: 5,
        },
        bio: 'Veteran quarterback with years of league experience.',
        image: 'https://images.unsplash.com/photo-1541963058-d4c255efe471?w=400&q=80',
    },
    {
        id: '6',
        name: 'R. WILSON',
        jerseyNumber: 21,
        position: 'CB',
        team: 'Rebels',
        stats: {
            touchdowns: 1,
            yards: 120,
            tackles: 38,
        },
        bio: 'Elite cornerback with unmatched coverage skills.',
        image: 'https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?w=400&q=80',
    },
];
