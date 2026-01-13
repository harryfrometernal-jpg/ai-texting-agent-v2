
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

export async function GET() {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const userEmail = session.user.email;

        // Fetch user's organizations
        const orgsResult = await db.sql`SELECT * FROM organizations WHERE owner_email = ${userEmail}`;
        const orgs = orgsResult.rows;

        let whitelist: any[] = [];
        let contacts: any[] = [];
        let logs: any[] = [];
        let campaigns: any[] = [];
        let documents: any[] = [];

        if (orgs.length > 0) {
            // Fetch Admins/Whitelist
            const whitelistResult = await db.sql`
                SELECT w.* FROM whitelist w
                JOIN organizations o ON w.org_id = o.id
                WHERE o.owner_email = ${userEmail}
                ORDER BY w.created_at DESC
            `;
            whitelist = whitelistResult.rows;

            // Fetch Leads/Contacts (Reduced for faster initial load)
            const contactsResult = await db.sql`
                SELECT c.*, g.goal_description as active_goal_description, g.goal_type as active_goal_type
                FROM contacts c
                LEFT JOIN LATERAL (
                    SELECT goal_description, goal_type
                    FROM conversation_goals
                    WHERE contact_phone = c.phone_number AND status = 'active'
                    ORDER BY conversation_goals.created_at DESC
                    LIMIT 1
                ) g ON true
                JOIN organizations o ON c.org_id = o.id
                WHERE o.owner_email = ${userEmail}
                ORDER BY c.created_at DESC
                LIMIT 50
            `;
            contacts = contactsResult.rows;

            // Fetch Logs (Reduced for faster initial load)
            const logsResult = await db.sql`
                SELECT l.* FROM conversation_logs l
                JOIN organizations o ON l.org_id = o.id
                WHERE o.owner_email = ${userEmail}
                ORDER BY l.created_at DESC
                LIMIT 30
            `;
            logs = logsResult.rows;

            // Compute Stats on Server
            const { rows: statsCount } = await db.sql`
                SELECT
                    COUNT(*) FILTER (WHERE l.direction = 'inbound') as inbound_count,
                    COUNT(*) FILTER (WHERE l.direction = 'outbound') as outbound_count,
                    COUNT(*) as total_logs,
                    COUNT(*) FILTER (WHERE l.created_at >= CURRENT_DATE) as today_count
                FROM conversation_logs l
                JOIN organizations o ON l.org_id = o.id
                WHERE o.owner_email = ${userEmail}
            `;

            const { rows: contactCount } = await db.sql`
                SELECT COUNT(*) as total_contacts 
                FROM contacts c
                JOIN organizations o ON c.org_id = o.id
                WHERE o.owner_email = ${userEmail}
            `;

            // Merge stats
            const calculatedStats = {
                totalContacts: parseInt(contactCount[0].total_contacts),
                totalLogs: parseInt(statsCount[0].total_logs),
                interactionsToday: parseInt(statsCount[0].today_count),
                inbound: parseInt(statsCount[0].inbound_count),
                outbound: parseInt(statsCount[0].outbound_count)
            };

            // Fetch Campaigns
            const campaignsResult = await db.sql`
                SELECT c.* FROM campaigns c
                JOIN organizations o ON c.org_id = o.id
                WHERE o.owner_email = ${userEmail}
                ORDER BY c.created_at DESC
                LIMIT 10
            `;
            campaigns = campaignsResult.rows;

            // Fetch Docs
            const docsResult = await db.sql`
                SELECT d.id, d.content, d.created_at, d.metadata FROM documents d
                JOIN organizations o ON d.org_id = o.id
                WHERE o.owner_email = ${userEmail}
                ORDER BY d.created_at DESC
            `;
            documents = docsResult.rows;

            return NextResponse.json({
                orgs,
                whitelist,
                contacts,
                logs,
                campaigns,
                documents,
                stats: calculatedStats
            });
        }

        return NextResponse.json({
            orgs,
            whitelist: [],
            contacts: [],
            logs: [],
            campaigns: [],
            documents: [],
            stats: null
        });

    } catch (e: any) {
        console.error("Dashboard Init Error:", e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
