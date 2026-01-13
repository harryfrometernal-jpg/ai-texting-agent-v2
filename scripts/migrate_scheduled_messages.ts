import 'dotenv/config';
import { db } from "@/lib/db";

async function main() {
    console.log("Creating 'scheduled_messages' table...");

    try {
        await db.sql`
            CREATE TABLE IF NOT EXISTS scheduled_messages (
                id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
                target_phone TEXT NOT NULL,
                message_body TEXT NOT NULL,
                scheduled_at TIMESTAMP WITH TIME ZONE NOT NULL,
                status TEXT DEFAULT 'pending', -- 'pending', 'sent', 'failed'
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                org_id UUID REFERENCES organizations(id)
            );
        `;

        console.log("✅ Table 'scheduled_messages' created successfully.");
    } catch (e: any) {
        console.error("❌ Migration failed:", e.message);
    }
}

main();
