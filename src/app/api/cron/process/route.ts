import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import axios from 'axios';

// This route should be called by Vercel Cron or an external Cron service (e.g., every 15 mins)
export async function GET(req: Request) {
    // Basic Security: Check for a secret key if needed, or rely on Vercel's protection.
    // For now, open (or check a header if configured).
    // if (req.headers.get('Authorization') !== `Bearer ${process.env.CRON_SECRET}`) ...

    try {
        const now = new Date().toISOString();

        // 1. Fetch Due Tasks
        // 1. Fetch Due Tasks
        const { rows: tasks } = await db.sql`
            SELECT * FROM scheduled_tasks 
            WHERE status = 'pending' 
            AND scheduled_for <= ${now}
        `;

        // if (error) throw error;

        if (!tasks || tasks.length === 0) {
            return NextResponse.json({ message: 'No tasks due.' });
        }

        console.log(`Processing ${tasks.length} due tasks...`);

        // 2. Process Each Task
        const results = await Promise.all(tasks.map(async (task) => {
            try {
                // Send Message Logic
                const phone = task.contact_info?.phone;
                const message = task.payload || "This is your reminder.";

                if (phone) {
                    // We assume GHL Webhook Outgoing logic here, 
                    // OR we can just use the GHL API directly if we had it.
                    // But we used a webhook URL in previous steps.
                    // Let's use the same Outgoing Webhook logic.

                    if (process.env.GHL_OUTGOING_WEBHOOK_URL) {
                        await axios.post(process.env.GHL_OUTGOING_WEBHOOK_URL, {
                            phone: phone,
                            message: message
                        });
                    } else {
                        console.warn("No GHL Outgoing Webhook URL configured.");
                    }

                    // Mark Complete
                    // Mark Complete
                    await db.sql`UPDATE scheduled_tasks SET status = 'completed' WHERE id = ${task.id}`;

                    return { id: task.id, status: 'success' };
                }
                return { id: task.id, status: 'skipped_no_phone' };

            } catch (err: any) {
                console.error(`Task ${task.id} failed:`, err);
                // Option: Mark as 'failed' so we don't loop forever
                // Option: Mark as 'failed' so we don't loop forever
                await db.sql`UPDATE scheduled_tasks SET status = 'failed' WHERE id = ${task.id}`;
                return { id: task.id, status: 'failed', error: err.message };
            }
        }));

        return NextResponse.json({ processed: results.length, details: results });

    } catch (e: any) {
        console.error("Cron Error:", e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
