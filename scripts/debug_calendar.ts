import 'dotenv/config';
import { runCalendarAgent } from '../src/lib/agents/calendar';

async function main() {
    console.log('--- Testing Calendar Agent ---');

    // Simulate a booking request
    const context = {
        from: '+18569936360',
        contactName: 'Harry',
        body: 'Schedule a meeting for tomorrow at 2pm called Test Meeting'
    };

    console.log(`User says: "${context.body}"`);

    try {
        const response = await runCalendarAgent(context);
        console.log('\nAgent Response:', response);
    } catch (error) {
        console.error('\n[FATAL] Agent crashed:', error);
    }
}

main();
