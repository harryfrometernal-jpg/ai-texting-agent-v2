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
    console.log('--- Checking Folder Details ---');
    const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
    if (!folderId) {
        console.error("No GOOGLE_DRIVE_FOLDER_ID found.");
        return;
    }

    const auth = await getAuthClient();
    const drive = google.drive({ version: 'v3', auth });

    try {
        console.log(`Inspecting Folder ID: ${folderId}`);
        const res = await drive.files.get({
            fileId: folderId,
            fields: 'id, name, mimeType, driveId, owners, capabilities',
            supportsAllDrives: true
        });

        console.log('Folder Metadata:', JSON.stringify(res.data, null, 2));

        if (res.data.driveId) {
            console.log("✅ result: This is inside a SHARED DRIVE (Team Drive).");
        } else {
            console.log("ℹ️ result: This is a regular folder (My Drive).");
        }
    } catch (error: any) {
        console.error('[FAILURE] Error:', error.message);
    }
}

main();
