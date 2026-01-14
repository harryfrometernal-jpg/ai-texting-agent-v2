import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import axios from 'axios';

export async function GET(req: Request) {
    try {
        console.log('🔄 Task check-ins cron job started');

        // Get current time in EST
        const now = new Date();
        const estTime = new Date(now.toLocaleString("en-US", { timeZone: "America/New_York" }));
        const currentHour = estTime.getHours();

        console.log(`Current EST time: ${currentHour}:00`);

        // Only run during productive hours (9 AM - 8 PM EST)
        if (currentHour < 9 || currentHour > 20) {
            console.log('Outside productive hours (9 AM - 8 PM EST)');
            return NextResponse.json({
                success: true,
                message: "Outside productive hours",
                executed: false
            });
        }

        // Get users who might need check-ins
        const { rows: users } = await db.sql`
            SELECT DISTINCT user_phone
            FROM task_preferences
            WHERE user_phone IS NOT NULL
        `;

        console.log(`Checking ${users.length} users for potential check-ins`);

        let sentCount = 0;
        let errorCount = 0;

        // Get the outbound webhook URL
        const { rows: orgRows } = await db.sql`
            SELECT ghl_webhook_url FROM organizations
            WHERE ghl_webhook_url IS NOT NULL
            ORDER BY created_at ASC
            LIMIT 1
        `;

        const OUTBOUND_WEBHOOK_URL = orgRows[0]?.ghl_webhook_url || process.env.GHL_OUTBOUND_WEBHOOK_URL;

        if (!OUTBOUND_WEBHOOK_URL) {
            console.error('No outbound webhook URL configured');
            return NextResponse.json({
                error: "Outbound webhook URL not configured"
            }, { status: 500 });
        }

        for (const user of users) {
            try {
                console.log(`Checking if ${user.user_phone} needs a check-in`);

                // Check if user should receive a check-in
                const { TaskManager } = await import('@/lib/agents/task_manager');
                const shouldSend = await TaskManager.shouldSendCheckin(user.user_phone);

                if (shouldSend) {
                    // Generate progress check-in
                    const checkinMessage = await TaskManager.generateProgressCheckin(user.user_phone);

                    if (checkinMessage) {
                        // Send via webhook
                        await axios.post(OUTBOUND_WEBHOOK_URL, {
                            phone: user.user_phone,
                            message: checkinMessage,
                            source: 'task_checkin'
                        });

                        console.log(`✅ Check-in sent to ${user.user_phone}`);
                        sentCount++;
                    } else {
                        console.log(`⏭️ No check-in needed for ${user.user_phone}`);
                    }
                } else {
                    console.log(`⏭️ Check-in criteria not met for ${user.user_phone}`);
                }

            } catch (error: any) {
                console.error(`❌ Error processing check-in for ${user.user_phone}:`, error.message);
                errorCount++;
            }
        }

        console.log(`🔄 Task check-ins cron completed: ${sentCount} sent, ${errorCount} errors`);

        return NextResponse.json({
            success: true,
            message: "Task check-ins processed",
            users_checked: users.length,
            checkins_sent: sentCount,
            errors: errorCount,
            execution_time: estTime.toISOString()
        });

    } catch (error: any) {
        console.error("Task check-ins cron error:", error);
        return NextResponse.json({
            error: error.message,
            success: false
        }, { status: 500 });
    }
}

// Also allow POST for manual triggering
export async function POST(req: Request) {
    return GET(req);
}