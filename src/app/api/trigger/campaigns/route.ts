import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import axios from 'axios';

const OUTBOUND_WEBHOOK_URL = process.env.GHL_OUTBOUND_WEBHOOK_URL;

export async function POST(req: Request) {
    try {
        if (!OUTBOUND_WEBHOOK_URL) {
            return NextResponse.json({
                error: "GHL_OUTBOUND_WEBHOOK_URL not configured"
            }, { status: 400 });
        }

        let processedCount = 0;
        let failedCount = 0;

        // Process pending campaign queue items
        const { rows: campaigns } = await db.sql`
            SELECT * FROM campaign_queue
            WHERE status = 'pending'
            LIMIT 50
        `;

        console.log(`Processing ${campaigns.length} pending campaigns`);

        for (const item of campaigns) {
            try {
                console.log(`Sending campaign message to ${item.contact_phone}: ${item.ai_message}`);

                await axios.post(OUTBOUND_WEBHOOK_URL, {
                    phone: item.contact_phone,
                    message: item.ai_message,
                    source: 'campaigner_manual'
                });

                await db.sql`
                    UPDATE campaign_queue
                    SET status = 'sent', sent_at = NOW()
                    WHERE id = ${item.id}
                `;

                processedCount++;

            } catch (err: any) {
                console.error(`Failed to send campaign message ${item.id}:`, err);

                await db.sql`
                    UPDATE campaign_queue
                    SET status = 'failed', error_message = ${err.message}
                    WHERE id = ${item.id}
                `;

                failedCount++;
            }
        }

        return NextResponse.json({
            success: true,
            processed: processedCount,
            failed: failedCount,
            total_found: campaigns.length
        });

    } catch (error: any) {
        console.error("Manual campaign trigger error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}