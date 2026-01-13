import 'dotenv/config';
import { google } from 'googleapis';

const SCOPES = ['https://www.googleapis.com/auth/drive'];

const getAuthClient = async () => {
    const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON || '{}');
    return new google.auth.JWT({
        email: credentials.client_email,
        key: credentials.private_key,
        scopes: SCOPES,
    });
};

async function main() {
    console.log('--- Testing Google Drive API ---');
    const auth = await getAuthClient();
    const drive = google.drive({ version: 'v3', auth });

    try {
        console.log('Attempting to list files...');
        const res = await drive.files.list({
            pageSize: 5,
            fields: 'nextPageToken, files(id, name)',
        });

        const files = res.data.files;
        console.log('Files found:', files?.length);
        if (files?.length) {
            files.map((file) => {
                console.log(`${file.name} (${file.id})`);
            });
        }
        console.log('[SUCCESS] Drive API is working.');
    } catch (error: any) {
        console.error('[FAILURE] Drive API Error:', error.message);
        if (error.response) {
            console.error('Details:', JSON.stringify(error.response.data, null, 2));
        }
    }
}

main();
