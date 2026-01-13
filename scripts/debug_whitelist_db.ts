import 'dotenv/config';
import { db } from '../src/lib/db';
import { normalizePhoneNumber } from '../src/lib/utils';

async function main() {
    const testNumber = '+18569936360';
    console.log(`\n--- Debugging Whitelist for ${testNumber} ---`);

    // 1. Dump Table
    console.log('\n1. Fetching ALL Whitelisted Numbers:');
    const { rows } = await db.sql`SELECT * FROM whitelisted_numbers`;

    if (rows.length === 0) {
        console.log('   [WARNING] Table is EMPTY!');
    } else {
        rows.forEach(r => {
            console.log(`   - ID: ${r.id}, Phone: '${r.phone_number}', Org: ${r.org_id}, Status: ${r.ai_status}`);
        });
    }

    // 2. Simulate Logic
    const normalized = normalizePhoneNumber(testNumber);
    const last10 = normalized.slice(-10);
    console.log(`\n2. Testing Logic:`);
    console.log(`   - Input: ${testNumber}`);
    console.log(`   - Normalized: ${normalized}`);
    console.log(`   - Last 10: ${last10}`);

    // 3. Run Query
    console.log(`\n3. Running Exact Query from Webhook:`);
    const query = `%'${last10}'`; // Note: simple string interp here for display, real query uses params

    // We use the exact same parameterized query as the route
    const { rows: matchRows } = await db.sql`
        SELECT * FROM whitelisted_numbers 
        WHERE phone_number LIKE ${'%' + last10} 
        LIMIT 1
    `;

    if (matchRows.length > 0) {
        console.log(`   [SUCCESS] MATCH FOUND! ID: ${matchRows[0].id}`);
    } else {
        console.log(`   [FAILURE] NO MATCH FOUND in Database.`);
    }

    process.exit(0);
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
