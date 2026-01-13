import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import axios from 'axios';

// GHL Webhook to actually send the text
// User must setup a Workflow in GHL: Webhook Trigger -> Send SMS
// Fallback to Env Var if not found in DB
const OUTBOUND_WEBHOOK_URL = process.env.GHL_OUTBOUND_WEBHOOK_URL;

export async function GET(req: Request) {
    // Basic security check (Cron secret or similar)
    // For Vercel Cron, we can check auth header if configured, but for MVP open.

    let processedCount = 0;

    try {
        // 1. Process Scheduled Messages (Time Traveler)
        // JOIN with organizations to get the specific webhook URL
        const { rows: scheduled } = await db.sql`
            SELECT s.*, o.ghl_webhook_url 
            FROM scheduled_messages s
            LEFT JOIN organizations o ON s.org_id = o.id
            WHERE s.status = 'pending' AND s.scheduled_at <= NOW()
            LIMIT 50
        `;

        for (const msg of scheduled) {
            console.log(`Processing Scheduled Msg ${msg.id} to ${msg.target_phone}`);

            // Determine Webhook URL: Org-Specific > Env Global
            const webhookUrl = msg.ghl_webhook_url || OUTBOUND_WEBHOOK_URL;

            if (!webhookUrl) {
                console.error(`No Outbound Webhook URL found for msg ${msg.id} (Org: ${msg.org_id})`);
                await db.sql`UPDATE scheduled_messages SET status = 'failed_no_webhook' WHERE id = ${msg.id}`;
                continue;
            }

            try {
                // Send to GHL
                await axios.post(webhookUrl, {
                    phone: msg.target_phone,
                    message: msg.message_body,
                    source: 'time_traveler'
                });

                // Update Status
                await db.sql`UPDATE scheduled_messages SET status = 'sent' WHERE id = ${msg.id}`;
                processedCount++;
            } catch (err) {
                console.error(`Failed to send ${msg.id}:`, err);
                await db.sql`UPDATE scheduled_messages SET status = 'failed' WHERE id = ${msg.id}`;
            }
        }

        // 2. Process Campaign Queue (The Campaigner)
        // (Optional: Only process 20 at a time to avoid rate limits)
        const { rows: methods } = await db.sql`
            SELECT * FROM campaign_queue 
            WHERE status = 'pending' 
            LIMIT 20
        `;

        for (const item of methods) {
            console.log(`Processing Campaign Msg for ${item.contact_phone}`);
            try {
                // For now, Campaigner uses global OUTBOUND_WEBHOOK_URL or needs update to fetch org too.
                // Assuming Campaigner runs under same context, but campaign_queue doesn't have org_id yet?
                // Whitelist has org_id. We can join.
                // For MVP, stick to global or try to fetch from whitelist join.
                // Let's us global fallback for Campaigner for now to minimize risk.
                if (!OUTBOUND_WEBHOOK_URL) {
                    console.error("Campaigner skipping: No Global Outbound Webhook");
                    continue;
                }

                await axios.post(OUTBOUND_WEBHOOK_URL, {
                    phone: item.contact_phone,
                    message: item.ai_message,
                    source: 'campaigner'
                });

                await db.sql`UPDATE campaign_queue SET status = 'sent' WHERE id = ${item.id}`;
                processedCount++;
            } catch (err) {
                console.error(`Failed to campaign message ${item.id}:`, err);
                await db.sql`UPDATE campaign_queue SET status = 'failed' WHERE id = ${item.id}`;
            }
        }

        return NextResponse.json({ status: 'ok', processed: processedCount });

    } catch (e: any) {
        console.error("Cron Error:", e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
