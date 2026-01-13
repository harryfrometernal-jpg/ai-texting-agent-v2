import { google } from 'googleapis';
import { withRetry } from '@/lib/retry';

const SCOPES = ['https://www.googleapis.com/auth/calendar'];

const getAuthClient = async () => {
    const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON || '{}');
    const auth = new google.auth.JWT({
        email: credentials.client_email,
        key: credentials.private_key,
        scopes: SCOPES,
    });
    return auth;
};

export const listEvents = async (timeMin: string, timeMax: string) => {
    const auth = await getAuthClient();
    const calendar = google.calendar({ version: 'v3', auth });

    try {
        const calendarId = process.env.GOOGLE_CALENDAR_ID || 'primary';
        const response = await withRetry(() => calendar.events.list({
            calendarId,
            timeMin,
            timeMax,
            singleEvents: true,
            orderBy: 'startTime',
        }));
        return response.data.items;
    } catch (error) {
        console.error('Error listing events:', error);
        throw error;
    }
};

export const createEvent = async (summary: string, startTime: string, endTime: string, attendeeEmail?: string) => {
    const auth = await getAuthClient();
    const calendar = google.calendar({ version: 'v3', auth });

    const event = {
        summary,
        start: { dateTime: startTime },
        end: { dateTime: endTime },
        attendees: attendeeEmail ? [{ email: attendeeEmail }] : [],
    };

    try {
        const calendarId = process.env.GOOGLE_CALENDAR_ID || 'primary';
        const response = await withRetry(() => calendar.events.insert({
            calendarId,
            requestBody: event,
        }));
        return response.data;
    } catch (error) {
        console.error('Error creating event:', error);
        throw error;
    }
};
