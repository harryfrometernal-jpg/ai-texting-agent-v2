import { NextResponse } from 'next/server';
import axios from 'axios';

// Only authenticated admins or internal cron jobs should call this
// Only authenticated admins or internal cron jobs should call this
export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { contact, message, manualUrl, org_id } = body;

        if (!contact || !contact.phone || !message) {
            return NextResponse.json({ error: "Missing contact details or message" }, { status: 400 });
        }

        let ghlWebhookUrl = manualUrl || process.env.GHL_OUTGOING_WEBHOOK_URL;

        if (!manualUrl && org_id) {
            try {
                const { db } = await import('@/lib/db');
                const { rows } = await db.sql`
                    SELECT ghl_webhook_url FROM organizations WHERE id = ${org_id} LIMIT 1
                `;
                if (rows.length > 0 && rows[0].ghl_webhook_url) {
                    ghlWebhookUrl = rows[0].ghl_webhook_url;
                }
            } catch (e) {
                console.error("DB Fetch Error:", e);
            }
        }

        if (!ghlWebhookUrl) {
            return NextResponse.json({ error: "GHL_OUTGOING_WEBHOOK_URL not configured for this org" }, { status: 500 });
        }

        // Send to GHL
        // GHL Webhook Trigger expects JSON payload
        await axios.post(ghlWebhookUrl, {
            inboundWebhookRequest: {
                fullName: contact.name,
                email: contact.email,
                phone: contact.phone,
                message: message
            }
        });

        return NextResponse.json({ success: true, sentTo: ghlWebhookUrl });

    } catch (error: any) {
        console.error("Outgoing Webhook Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
