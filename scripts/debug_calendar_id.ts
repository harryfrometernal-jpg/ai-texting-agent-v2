import 'dotenv/config';
import { google } from 'googleapis';

const SCOPES = ['https://www.googleapis.com/auth/calendar'];

const getAuthClient = async () => {
    const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON || '{}');
    return new google.auth.JWT({
        email: credentials.client_email,
        key: credentials.private_key,
        scopes: SCOPES,
    });
};

async function main() {
    console.log('--- Inspecting Primary Calendar ---');
    const auth = await getAuthClient();
    const calendar = google.calendar({ version: 'v3', auth });

    try {
        const res = await calendar.calendars.get({ calendarId: 'primary' });
        console.log('Primary Calendar Details:');
        console.log(`- Summary: ${res.data.summary}`);
        console.log(`- ID: ${res.data.id}`);
        console.log(`- TimeZone: ${res.data.timeZone}`);

        console.log('\n--- Checking Lists Again ---');
        const list = await calendar.calendarList.list();
        console.log(`Total Calendars in List: ${list.data.items?.length}`);
    } catch (error: any) {
        console.error('Error:', error.message);
    }
}

main();
