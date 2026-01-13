import 'dotenv/config';
import { runPicassoAgent } from '../src/lib/agents/picasso';

async function main() {
    console.log('--- Testing Picasso Agent ---');

    const context = {
        body: 'Draw a futuristic cyberpunk city with neon lights',
        from: '+18569936360',
        contactName: 'Harry',
        history: []
    };

    console.log(`User says: "${context.body}"`);

    try {
        const response = await runPicassoAgent(context);
        console.log('\nAgent Response:', response);
    } catch (error) {
        console.error('\n[FATAL] Agent crashed:', error);
    }
}

main();
