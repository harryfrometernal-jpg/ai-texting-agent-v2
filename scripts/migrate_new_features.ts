/**
 * Migration script to add all the new features' database tables
 * Run this after deploying the new code
 */

import { db } from '../src/lib/db';

async function runMigrations() {
    console.log("🚀 Starting database migrations for new features...");

    try {
        // 1. Goal-Based Conversation System
        console.log("📋 Creating conversation_goals table...");
        await db.sql`
            CREATE TABLE IF NOT EXISTS public.conversation_goals (
                id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
                contact_phone TEXT NOT NULL,
                contact_name TEXT,
                goal_description TEXT NOT NULL,
                goal_type TEXT DEFAULT 'custom' CHECK (goal_type IN ('custom', 'book_call', 'get_info', 'schedule_meeting')),
                status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'abandoned', 'paused')),
                progress_notes TEXT,
                completion_summary TEXT,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
                completed_at TIMESTAMP WITH TIME ZONE,
                last_activity_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
            );
        `;

        // 2. Contact Management
        console.log("👥 Creating contacts table...");
        await db.sql`
            CREATE TABLE IF NOT EXISTS public.contacts (
                id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
                name TEXT NOT NULL,
                phone_number TEXT UNIQUE NOT NULL,
                email TEXT,
                notes TEXT,
                tags JSONB DEFAULT '[]',
                added_by_ai BOOLEAN DEFAULT false,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
            );
        `;

        // 3. Admin Notifications
        console.log("🚨 Creating admin_notifications table...");
        await db.sql`
            CREATE TABLE IF NOT EXISTS public.admin_notifications (
                id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
                type TEXT NOT NULL CHECK (type IN ('goal_completion', 'goal_drift', 'conversation_issue', 'contact_added', 'system_alert')),
                contact_phone TEXT,
                contact_name TEXT,
                message TEXT NOT NULL,
                priority TEXT DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
                sent_to_admin BOOLEAN DEFAULT false,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
                sent_at TIMESTAMP WITH TIME ZONE
            );
        `;

        // 4. Zoom Integration
        console.log("📹 Creating zoom_meetings table...");
        await db.sql`
            CREATE TABLE IF NOT EXISTS public.zoom_meetings (
                id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
                meeting_id TEXT UNIQUE NOT NULL,
                join_url TEXT NOT NULL,
                start_url TEXT NOT NULL,
                topic TEXT NOT NULL,
                created_for_contact TEXT,
                expires_at TIMESTAMP WITH TIME ZONE,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
            );
        `;

        // 5. Enable RLS on new tables
        console.log("🔒 Enabling Row Level Security...");
        await db.sql`ALTER TABLE public.conversation_goals ENABLE ROW LEVEL SECURITY;`;
        await db.sql`ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;`;
        await db.sql`ALTER TABLE public.admin_notifications ENABLE ROW LEVEL SECURITY;`;
        await db.sql`ALTER TABLE public.zoom_meetings ENABLE ROW LEVEL SECURITY;`;

        // 6. Create indexes for better performance
        console.log("⚡ Creating performance indexes...");
        await db.sql`CREATE INDEX IF NOT EXISTS idx_conversation_goals_contact_phone ON conversation_goals(contact_phone);`;
        await db.sql`CREATE INDEX IF NOT EXISTS idx_conversation_goals_status ON conversation_goals(status);`;
        await db.sql`CREATE INDEX IF NOT EXISTS idx_contacts_phone_number ON contacts(phone_number);`;
        await db.sql`CREATE INDEX IF NOT EXISTS idx_admin_notifications_sent ON admin_notifications(sent_to_admin);`;
        await db.sql`CREATE INDEX IF NOT EXISTS idx_admin_notifications_priority ON admin_notifications(priority);`;
        await db.sql`CREATE INDEX IF NOT EXISTS idx_zoom_meetings_expires ON zoom_meetings(expires_at);`;

        console.log("✅ All migrations completed successfully!");
        console.log("\n🎯 New features ready:");
        console.log("  • Goal-based conversations");
        console.log("  • Contact management via AI");
        console.log("  • Zoom integration");
        console.log("  • Enhanced admin notifications");

        console.log("\n📱 Test your system by texting your AI:");
        console.log("  Admin commands (from +18569936360):");
        console.log("  • 'text John about booking a call'");
        console.log("  • 'add contact Jane Smith 555-987-6543'");
        console.log("  • 'give me a zoom link for client meeting'");

    } catch (error) {
        console.error("❌ Migration failed:", error);
        throw error;
    }
}

// Run migrations if this script is executed directly
if (require.main === module) {
    runMigrations()
        .then(() => {
            console.log("🎉 Migration completed! Your AI texting agent is ready.");
            process.exit(0);
        })
        .catch((error) => {
            console.error("💥 Migration failed:", error);
            process.exit(1);
        });
}

export { runMigrations };