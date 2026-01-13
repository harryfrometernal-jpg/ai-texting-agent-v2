import 'dotenv/config';
import { db } from '../src/lib/db';

async function main() {
    console.log('--- Checking AI Status ---');
    const phone = '+18569936360'; // User's number

    const last10 = phone.slice(-10);
    const { rows } = await db.sql`
        SELECT * FROM whitelisted_numbers 
        WHERE phone_number LIKE ${'%' + last10}
    `;

    if (rows.length > 0) {
        console.log('User Found:', rows[0]);
        if (rows[0].ai_status === 'paused') {
            console.log('[ALERT] AI IS PAUSED for this user.');
        } else {
            console.log('[OK] AI is Active.');
        }
    } else {
        console.log('[ERROR] User not found in whitelist.');
    }
}

main().catch(console.error);
