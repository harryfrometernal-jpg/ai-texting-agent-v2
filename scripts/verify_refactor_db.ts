
import 'dotenv/config';
import { db } from '@/lib/db';

async function main() {
    console.log('Verifying Contacts Refactor...');

    try {
        // 1. Check Table Existence and Columns
        // detailed column query
        const { rows: columns } = await db.sql`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'contacts';
        `;

        console.log('Columns in contacts table:', columns.map(c => `${c.column_name} (${c.data_type})`).join(', '));

        const hasEmail = columns.some(c => c.column_name === 'email');
        const hasTags = columns.some(c => c.column_name === 'tags');

        if (!hasEmail) console.error('❌ Missing email column');
        if (!hasTags) console.error('❌ Missing tags column');

        if (hasEmail && hasTags) console.log('✅ Schema migration verified: contacts table has email and tags.');

        // 2. Test Insertion (Simulation of Upload)
        const testPhone = '+15559998888';
        const testName = 'Test User';
        const testEmail = 'test@example.com';
        const testTags = ['import-test', 'vip'];
        // need a valid org_id
        const { rows: orgs } = await db.sql`SELECT id FROM organizations LIMIT 1`;
        if (orgs.length === 0) {
            console.log('⚠️ No organizations found, skipping insertion test.');
            return;
        }
        const orgId = orgs[0].id;

        console.log(`Testing insertion for org ${orgId}...`);

        await db.sql`
            INSERT INTO contacts (name, phone_number, email, tags, org_id, ai_status)
            VALUES (${testName}, ${testPhone}, ${testEmail}, ${testTags as any}, ${orgId}, 'active')
            ON CONFLICT (phone_number) 
            DO UPDATE SET name = EXCLUDED.name, email = EXCLUDED.email, tags = contacts.tags || EXCLUDED.tags
        `;
        console.log('✅ Insertion successful.');

        // 3. Verify Data
        const { rows: inserted } = await db.sql`SELECT * FROM contacts WHERE phone_number = ${testPhone}`;
        const contact = inserted[0];
        console.log('Retrieved Contact:', contact);

        if (contact.email === testEmail && contact.tags.includes('import-test')) {
            console.log('✅ Data verification passed.');
        } else {
            console.error('❌ Data mismatch.');
        }

        // Cleanup
        await db.sql`DELETE FROM contacts WHERE phone_number = ${testPhone}`;
        console.log('Cleanup done.');

    } catch (e) {
        console.error('Verification failed:', e);
        process.exit(1);
    } finally {
        process.exit(0);
    }
}

main();
