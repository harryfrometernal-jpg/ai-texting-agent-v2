import 'dotenv/config';
import { db } from '@/lib/db';

async function main() {
    console.log('--- Migrating Database: Adding Tags Column ---');

    try {
        await db.sql`
            ALTER TABLE whitelisted_numbers 
            ADD COLUMN IF NOT EXISTS tags text[] DEFAULT ARRAY[]::text[];
        `;
        console.log('✅ Success: Added tags column to whitelisted_numbers.');
    } catch (error) {
        console.error('❌ Migration Failed:', error);
    }
}

main();
