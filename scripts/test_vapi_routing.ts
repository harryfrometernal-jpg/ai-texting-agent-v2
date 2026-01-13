import 'dotenv/config';
import { routeMessage } from '../src/lib/agents/router';

async function main() {
    console.log('--- Simulating Call Request ---');

    const context = {
        from: '+18569936360',
        body: 'Can someone please call me to explain how this works?',
        contactName: 'Harry',
        numMedia: 0
    };

    console.log(`User says: "${context.body}"`);

    const result = await routeMessage(context as any);

    console.log('\nRouter Result:', JSON.stringify(result, null, 2));

    if (result.type === 'vapi' && result.vapiAssistantId === '3bdb54ea-af2e-4c54-be24-24a2ceab2338') {
        console.log('[SUCCESS] Router correctly selected the Vapi agent!');
    } else {
        console.log('[FAILURE] Router did not select the expected Vapi agent.');
    }
}

main();
