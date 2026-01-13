import 'dotenv/config';
import { google } from 'googleapis';

const SCOPES = ['https://www.googleapis.com/auth/calendar'];

const getAuthClient = async () => {
    const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON || '{}');
    if (!credentials.client_email) {
        throw new Error("Missing GOOGLE_SERVICE_ACCOUNT_JSON");
    }
    const auth = new google.auth.JWT({
        email: credentials.client_email,
        key: credentials.private_key,
        scopes: SCOPES,
    });
    return auth;
};

async function main() {
    console.log('--- Listing Accessible Calendars ---');
    const auth = await getAuthClient();
    const calendar = google.calendar({ version: 'v3', auth });

    try {
        const res = await calendar.calendarList.list();
        const calendars = res.data.items || [];

        console.log(`Found ${calendars.length} calendars:`);
        calendars.forEach(cal => {
            console.log(`- Summary: "${cal.summary}"`);
            console.log(`  ID: ${cal.id}`);
            console.log(`  AccessRole: ${cal.accessRole}`);
            console.log(`  Primary: ${cal.primary ? 'YES' : 'NO'}\n`);
        });

    } catch (error) {
        console.error('Error:', error);
    }
}

main();
