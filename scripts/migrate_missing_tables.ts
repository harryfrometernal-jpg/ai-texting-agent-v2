import 'dotenv/config';
import { sql } from '@vercel/postgres';

async function main() {
    console.log('Starting migration for missing tables...');

    try {
        // 1. vapi_assistants
        console.log('Creating vapi_assistants...');
        await sql`
      CREATE TABLE IF NOT EXISTS vapi_assistants (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        assistant_id TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        description TEXT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `;

        // 2. scheduled_tasks
        console.log('Creating scheduled_tasks...');
        await sql`
      CREATE TABLE IF NOT EXISTS scheduled_tasks (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        contact_info JSONB NOT NULL,
        scheduled_for TIMESTAMPTZ NOT NULL,
        task_type TEXT NOT NULL,
        payload TEXT,
        status TEXT DEFAULT 'pending',
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `;

        // 3. contact_memories
        console.log('Creating contact_memories...');
        await sql`
        CREATE TABLE IF NOT EXISTS contact_memories (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        contact_phone TEXT NOT NULL,
        memory_key TEXT NOT NULL,
        memory_value TEXT NOT NULL,
        confidence FLOAT DEFAULT 1.0,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(contact_phone, memory_key)
        );
    `;

        // 4. admin_users (for completeness)
        console.log('Creating admin_users...');
        await sql`
        CREATE TABLE IF NOT EXISTS admin_users (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
        );
    `;

        // Insert 'admin@example.com' or owner email if needed, but not strictly required for this route error.

        console.log('Migration completed successfully!');
    } catch (error) {
        console.error('Migration failed:', error);
        process.exit(1);
    }
}

main();
