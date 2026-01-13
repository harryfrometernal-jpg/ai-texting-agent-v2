import 'dotenv/config';

// Verified working public URL
const URL = 'https://ai-texting-agent.vercel.app/api/webhook/ghl/incoming';

async function main() {
    console.log(`--- Testing Calendar Request on Production ---`);
    console.log(`Target: ${URL}`);

    const body = {
        From: '+18569936360',
        Body: 'Schedule a meeting for tomorrow at 2pm',
        contact_name: 'Prod Tester',
        NumMedia: 0
    };

    console.log('Sending payload:', body);

    try {
        const response = await fetch(URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });

        console.log(`\nStatus: ${response.status} ${response.statusText}`);
        const text = await response.text();
        console.log('Response Body:', text);
    } catch (err) {
        console.error('Network Error:', err);
    }
}

main();
