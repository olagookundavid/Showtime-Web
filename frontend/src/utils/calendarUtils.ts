import type { Match } from '../services/api';

export const generateGoogleCalendarLink = (match: Match): string => {
    const formatTime = (date: Date) => date.toISOString().replace(/-|:|\.\d\d\d/g, '');

    // Parse start and end time (assume 2 hours duration)
    const startDate = new Date(match.start_time);
    const endDate = new Date(startDate.getTime() + 2 * 60 * 60 * 1000); // +2 hours

    const start = formatTime(startDate);
    const end = formatTime(endDate);

    const title = `${match.home_team?.name} vs ${match.away_team?.name}`;
    const details = `SFFL Match: ${title}\nVenue: ${match.venue}\ncompetition: ${match.competition?.name}`;
    const location = match.venue;

    const params = new URLSearchParams({
        action: 'TEMPLATE',
        text: title,
        dates: `${start}/${end}`,
        details: details,
        location: location,
    });

    return `https://calendar.google.com/calendar/render?${params.toString()}`;
};
