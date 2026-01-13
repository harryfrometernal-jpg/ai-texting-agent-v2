import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(req: Request) {
    try {
        // Check campaign queue status
        const { rows: queueStatus } = await db.sql`
            SELECT status, COUNT(*) as count
            FROM campaign_queue
            GROUP BY status
            ORDER BY status
        `;

        // Check recent campaigns
        const { rows: recentCampaigns } = await db.sql`
            SELECT * FROM campaigns
            ORDER BY created_at DESC
            LIMIT 10
        `;

        // Check active goals
        const { rows: activeGoals } = await db.sql`
            SELECT COUNT(*) as count, goal_type
            FROM conversation_goals
            WHERE status = 'active'
            GROUP BY goal_type
        `;

        // Check contacts count
        const { rows: contactsCount } = await db.sql`
            SELECT COUNT(*) as count FROM contacts
        `;

        return NextResponse.json({
            queue_status: queueStatus,
            recent_campaigns: recentCampaigns,
            active_goals: activeGoals,
            total_contacts: contactsCount[0].count,
            env_check: {
                has_outbound_webhook: !!process.env.GHL_OUTBOUND_WEBHOOK_URL,
                base_url: process.env.NEXTAUTH_URL || process.env.VERCEL_URL || 'http://localhost:3000'
            }
        });

    } catch (error: any) {
        console.error("Debug endpoint error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}