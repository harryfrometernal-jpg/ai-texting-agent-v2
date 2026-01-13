import 'dotenv/config';
import { POST } from '../src/app/api/webhook/ghl/incoming/route';

async function main() {
    console.log('--- Simulating Webhook Request ---');

    const body = {
        From: '+18569936360',
        Body: 'Call me please',
        contact_name: 'Debug User',
        NumMedia: 0
    };

    const req = {
        json: async () => body,
        // Mock other Request methods if needed
    } as unknown as Request;

    console.log('Sending request...');
    try {
        const response = await POST(req);
        const status = response.status;
        const json = await response.json();

        console.log(`\nResponse Status: ${status}`);
        console.log('Response JSON:', JSON.stringify(json, null, 2));

        if (status === 500) {
            console.error('[FAILURE] Reproduced 500 Internal Server Error');
            process.exit(1);
        } else {
            console.log('[SUCCESS] Request handled successfully (200 or ignored)');
            process.exit(0);
        }
    } catch (err) {
        console.error('Unhandled Error calling POST:', err);
        process.exit(1);
    }
}

main();
