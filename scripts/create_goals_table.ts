
import 'dotenv/config';
import { sql } from '@vercel/postgres';

async function main() {
    try {
        console.log('Creating Goals and Notifications Tables...');

        // conversation_goals
        await sql`
      CREATE TABLE IF NOT EXISTS conversation_goals (
        id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
        contact_phone TEXT NOT NULL,
        contact_name TEXT,
        goal_description TEXT NOT NULL,
        goal_type TEXT DEFAULT 'custom',
        status TEXT DEFAULT 'active', -- active, completed, abandoned
        progress_notes TEXT,
        completion_summary TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        completed_at TIMESTAMP WITH TIME ZONE,
        last_activity_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `;

        // admin_notifications
        await sql`
      CREATE TABLE IF NOT EXISTS admin_notifications (
        id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
        type TEXT NOT NULL, -- goal_completion, goal_drift, conversation_issue
        contact_phone TEXT,
        contact_name TEXT,
        message TEXT NOT NULL,
        priority TEXT DEFAULT 'normal', -- normal, high
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        read_at TIMESTAMP WITH TIME ZONE
      );
    `;

        console.log('Tables created successfully.');

    } catch (error) {
        console.error('Migration failed:', error);
    } finally {
        process.exit(0);
    }
}

main();
