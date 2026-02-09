// Google Calendar Integration Helper
export const addToGoogleCalendar = (event: {
    title: string;
    description: string;
    location: string;
    startDate: Date;
    endDate: Date;
}) => {
    const formatDate = (date: Date) => {
        return date.toISOString().replace(/-|:|\.\d+/g, '');
    };

    const params = new URLSearchParams({
        action: 'TEMPLATE',
        text: event.title,
        details: event.description,
        location: event.location,
        dates: `${formatDate(event.startDate)}/${formatDate(event.endDate)}`,
    });

    const url = `https://calendar.google.com/calendar/render?${params.toString()}`;
    window.open(url, '_blank');
};

// Example match event for testing
export const createMatchEvent = (
    homeTeam: string,
    awayTeam: string,
    matchDate: Date,
    venue: string = 'Showtime Arena'
) => {
    const endDate = new Date(matchDate);
    endDate.setHours(endDate.getHours() + 2); // 2 hour match duration

    return {
        title: `${homeTeam} vs ${awayTeam} - SFFL`,
        description: `Showtime Flag Football League match between ${homeTeam} and ${awayTeam}`,
        location: venue,
        startDate: matchDate,
        endDate: endDate,
    };
};
