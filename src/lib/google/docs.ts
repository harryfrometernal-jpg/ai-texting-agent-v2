import { google } from 'googleapis';

const SCOPES = ['https://www.googleapis.com/auth/documents', 'https://www.googleapis.com/auth/drive'];

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

export async function createDoc(title: string) {
    const auth = getAuth();
    const drive = google.drive({ version: 'v3', auth });

    const res = await drive.files.create({
        requestBody: {
            name: title,
            mimeType: 'application/vnd.google-apps.document',
            parents: process.env.GOOGLE_DRIVE_FOLDER_ID ? [process.env.GOOGLE_DRIVE_FOLDER_ID] : []
        }
    });

    return { documentId: res.data.id };
}

export async function appendText(documentId: string, text: string) {
    const docs = google.docs({ version: 'v1', auth: getAuth() });
    await docs.documents.batchUpdate({
        documentId,
        requestBody: {
            requests: [{
                insertText: {
                    endOfSegmentLocation: { segmentId: '' }, // Body
                    text: text + '\n'
                }
            }]
        }
    });
}
