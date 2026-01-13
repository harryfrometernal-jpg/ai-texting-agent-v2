
import 'dotenv/config';
import { sql } from '@vercel/postgres';

async function main() {
    try {
        console.log('Starting Contacts Refactor Migration...');

        // 1. Rename Table
        // Check if table exists to avoid errors on rerun
        // Vercel Postgres/Neon supports `IF EXISTS`
        await sql`ALTER TABLE IF EXISTS whitelisted_numbers RENAME TO contacts;`;
        console.log('Renamed whitelisted_numbers -> contacts');

        // 2. Add New Columns
        await sql`ALTER TABLE contacts ADD COLUMN IF NOT EXISTS email TEXT;`;
        await sql`ALTER TABLE contacts ADD COLUMN IF NOT EXISTS tags TEXT[];`; // Postgres array type

        // 3. Update Foreign Key Columns in related tables (optional, but good for clarity)
        // campaign_queue has contact_phone (TEXT) and contact_id (UUID). 
        // The foreign key constraint name might need update but the relationship persists even after rename.
        // However, for code clarity we might want to rename columns in other tables, but let's stick to the table rename first 
        // to minimize partial breakage. We will update the code to refer to 'contacts'.

        console.log('Migration completed: contacts table ready.');

    } catch (error) {
        console.error('Migration failed:', error);
        // Don't exit 1 if it failed just because table already renamed
    } finally {
        process.exit(0);
    }
}

main();
