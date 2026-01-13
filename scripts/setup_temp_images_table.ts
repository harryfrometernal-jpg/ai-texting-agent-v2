
import 'dotenv/config';
import { sql } from '@vercel/postgres';

async function main() {
    try {
        console.log('Starting temporary_images migration...');

        await sql`
      CREATE TABLE IF NOT EXISTS temporary_images (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        remote_url TEXT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        expires_at TIMESTAMPTZ NOT NULL
      );
    `;
        console.log('Created temporary_images table');

    } catch (error) {
        console.error('Migration failed:', error);
        process.exit(1);
    }
}

main();
