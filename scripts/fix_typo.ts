import 'dotenv/config';
import { db } from '../src/lib/db';

async function main() {
    console.log('--- Fixing Typo in Whitelist ---');

    // 1. Check for the incorrect number
    const wrongNumber = '+18569936369';
    const correctNumber = '+18569936360';

    console.log(`Updating ${wrongNumber} -> ${correctNumber}`);

    const result = await db.sql`
        UPDATE whitelisted_numbers 
        SET phone_number = ${correctNumber} 
        WHERE phone_number = ${wrongNumber}
    `;

    console.log(`Updated ${result.rowCount} rows.`);

    // Verify
    const { rows } = await db.sql`SELECT * FROM whitelisted_numbers WHERE phone_number = ${correctNumber}`;
    if (rows.length > 0) {
        console.log('[SUCCESS] Correct number is now in DB:', rows[0]);
    } else {
        console.log('[FAILURE] Could not verify update.');
    }

    process.exit(0);
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
