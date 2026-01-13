
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { runMapsScraper } from '@/lib/agents/headhunter';

export async function POST(req: Request) {
    try {
        const { niche, city, org_id } = await req.json();

        if (!niche || !city || !org_id) {
            return NextResponse.json({ error: "Niche, City, and Org ID required" }, { status: 400 });
        }

        // Fetch Organization Settings (Webhook)
        const { rows } = await db.sql`SELECT ghl_webhook_url FROM organizations WHERE id = ${org_id}`;
        const webhookUrl = rows[0]?.ghl_webhook_url;

        const leads = await runMapsScraper(niche, city, org_id, webhookUrl);

        return NextResponse.json({
            success: true,
            leads_found: leads.length,
            leads
        });

    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
