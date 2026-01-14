import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import axios from 'axios';

export async function GET(req: Request) {
    try {
        console.log('🌅 Daily task prompt cron job started');

        // Get current time in EST
        const now = new Date();
        const estTime = new Date(now.toLocaleString("en-US", { timeZone: "America/New_York" }));
        const currentHour = estTime.getHours();
        const currentMinute = estTime.getMinutes();

        console.log(`Current EST time: ${currentHour}:${currentMinute.toString().padStart(2, '0')}`);

        // Check if it's 7:30 AM EST (allow 7:30-7:35 window for execution)
        if (currentHour !== 7 || currentMinute < 30 || currentMinute > 35) {
            console.log('Not the right time for daily prompt (7:30-7:35 AM EST)');
            return NextResponse.json({
                success: true,
                message: `Not the right time. Current: ${currentHour}:${currentMinute.toString().padStart(2, '0')} EST`,
                executed: false
            });
        }

        // Get users who should receive daily prompts
        const { rows: users } = await db.sql`
            SELECT user_phone, daily_prompt_time, timezone, notification_style
            FROM task_preferences
            WHERE user_phone IS NOT NULL
        `;

        console.log(`Found ${users.length} users for daily prompts`);

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
                console.log(`Processing daily prompt for user: ${user.user_phone}`);

                // Generate and send the daily prompt
                const { TaskManager } = await import('@/lib/agents/task_manager');
                const promptMessage = await TaskManager.sendDailyPrompt(user.user_phone);

                if (promptMessage !== "Daily prompt already sent today.") {
                    // Send via webhook
                    await axios.post(OUTBOUND_WEBHOOK_URL, {
                        phone: user.user_phone,
                        message: promptMessage,
                        source: 'daily_task_prompt'
                    });

                    console.log(`✅ Daily prompt sent to ${user.user_phone}`);
                    sentCount++;
                } else {
                    console.log(`⏭️ Daily prompt already sent today for ${user.user_phone}`);
                }

            } catch (error: any) {
                console.error(`❌ Error sending daily prompt to ${user.user_phone}:`, error.message);
                errorCount++;
            }
        }

        console.log(`🌅 Daily task prompt cron completed: ${sentCount} sent, ${errorCount} errors`);

        return NextResponse.json({
            success: true,
            message: "Daily task prompts processed",
            users_processed: users.length,
            prompts_sent: sentCount,
            errors: errorCount,
            execution_time: estTime.toISOString()
        });

    } catch (error: any) {
        console.error("Daily task prompt cron error:", error);
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