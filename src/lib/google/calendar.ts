import { google } from 'googleapis';

const SCOPES = ['https://www.googleapis.com/auth/calendar'];

function getAuth() {
    const jsonKey = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
    if (!jsonKey) throw new Error("Missing GOOGLE_SERVICE_ACCOUNT_JSON");

    const credentials = JSON.parse(jsonKey);
    return new google.auth.JWT({
        email: credentials.client_email,
        key: credentials.private_key,
        scopes: SCOPES
    });
}

export async function listEvents(timeMin: string, timeMax: string) {
    const calendar = google.calendar({ version: 'v3', auth: getAuth() });
    const res = await calendar.events.list({
        calendarId: 'primary', // User needs to share their primary calendar with the service account email
        timeMin,
        timeMax,
        singleEvents: true,
        orderBy: 'startTime',
    });
    return res.data.items;
}

export async function createEvent(summary: string, description: string, startTime: string, endTime: string) {
    const calendar = google.calendar({ version: 'v3', auth: getAuth() });
    const event = {
        summary,
        description,
        start: { dateTime: startTime },
        end: { dateTime: endTime },
    };
    const res = await calendar.events.insert({
        calendarId: 'primary',
        requestBody: event,
    });
    return res.data;
}
