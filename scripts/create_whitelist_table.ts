
import 'dotenv/config';
import { sql } from '@vercel/postgres';

async function main() {
    try {
        console.log('Creating Whitelist Table...');

        // Enable UUID extension
        await sql`CREATE EXTENSION IF NOT EXISTS "uuid-ossp";`;

        // Create 'whitelist' table designed for Admins/Team Members
        await sql`
      CREATE TABLE IF NOT EXISTS whitelist (
        id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
        phone_number TEXT UNIQUE NOT NULL,
        name TEXT,
        org_id UUID REFERENCES organizations(id),
        role TEXT DEFAULT 'member', -- 'admin', 'member'
        ai_status TEXT DEFAULT 'active', -- 'active', 'paused'
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `;

        console.log('Adding default admin to whitelist...');

        // Check organizations - if none exist (fresh db), inserting with null org_id is fine if schema allows.
        // If org_id is required logic-wise, we might need to handle it. 
        // BUT the webhook logic relies on whitelist.org_id to route context.
        // Let's see if we can get an org.

        // We already have organizations table?
        const { rows: orgs } = await sql`SELECT id FROM organizations LIMIT 1`;
        let orgId = null;
        if (orgs.length > 0) {
            orgId = orgs[0].id;
        }

        // Insert admin
        if (orgId) {
            await sql`
            INSERT INTO whitelist (phone_number, name, role, ai_status, org_id)
            VALUES ('+18569936360', 'Harry Castaner', 'admin', 'active', ${orgId})
            ON CONFLICT (phone_number) DO NOTHING;
        `;
        } else {
            await sql`
            INSERT INTO whitelist (phone_number, name, role, ai_status)
            VALUES ('+18569936360', 'Harry Castaner', 'admin', 'active')
            ON CONFLICT (phone_number) DO NOTHING;
        `;
        }

        console.log('Whitelist table created and admin added.');

    } catch (error) {
        console.error('Migration failed:', error);
    } finally {
        process.exit(0);
    }
}

main();
