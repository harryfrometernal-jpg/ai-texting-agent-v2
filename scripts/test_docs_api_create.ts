import 'dotenv/config';
import { google } from 'googleapis';

const SCOPES = ['https://www.googleapis.com/auth/documents', 'https://www.googleapis.com/auth/drive'];

const getAuthClient = async () => {
    const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON || '{}');
    return new google.auth.JWT({
        email: credentials.client_email,
        key: credentials.private_key,
        scopes: SCOPES,
    });
};

async function main() {
    console.log('--- Testing Docs API Create ---');
    const auth = await getAuthClient();
    const docs = google.docs({ version: 'v1', auth });

    try {
        console.log('Attempting docs.documents.create...');
        const res = await docs.documents.create({
            requestBody: { title: 'Direct Docs API Test' }
        });

        console.log('[SUCCESS] Created Doc!');
        console.log('ID:', res.data.documentId);
        console.log('Title:', res.data.title);
    } catch (error: any) {
        console.error('[FAILURE] Docs API Error:', error.message);
        if (error.response) {
            console.error('Details:', JSON.stringify(error.response.data, null, 2));
        }
    }
}

main();
