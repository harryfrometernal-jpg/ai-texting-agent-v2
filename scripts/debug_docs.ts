import 'dotenv/config';
import { runDocsAgent } from '../src/lib/agents/docs';

async function main() {
    console.log('--- Testing Docs Agent ---');

    const context = {
        body: 'Create a SOP for "How to Handle Angry Customers" with 3 steps: Listen, Apologize, Solve.',
        from: '+18569936360',
        contactName: 'Harry',
        history: []
    };

    console.log(`User says: "${context.body}"`);

    try {
        const response = await runDocsAgent(context);
        console.log('\nAgent Response:', response);
    } catch (error) {
        console.error('\n[FATAL] Agent crashed:', error);
    }
}

main();
