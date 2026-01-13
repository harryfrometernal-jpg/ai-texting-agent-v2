import 'dotenv/config';
import { db } from '../src/lib/db';

async function main() {
    console.log('--- Registering Vapi Assistant ---');

    const assistant = {
        id: '3bdb54ea-af2e-4c54-be24-24a2ceab2338',
        name: 'Harry AI Texting Agent',
        description: 'Use this for general support or complex explanations or following up with the client'
    };

    try {
        await db.sql`
            INSERT INTO vapi_assistants (assistant_id, name, description)
            VALUES (${assistant.id}, ${assistant.name}, ${assistant.description})
            ON CONFLICT (assistant_id) DO UPDATE 
            SET name = EXCLUDED.name, description = EXCLUDED.description
        `;
        console.log(`[SUCCESS] Registered Assistant: ${assistant.name}`);
    } catch (error) {
        console.error('[FAILURE] Could not register assistant:', error);
        process.exit(1);
    }
}

main().catch(console.error);
