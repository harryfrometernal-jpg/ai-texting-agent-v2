import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import axios from 'axios';
import { TaskManager } from '@/lib/agents/task_manager';

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

        // 3. Process Daily Task Prompts
        console.log('Processing daily task prompts...');

        const currentTime = new Date();
        const currentHour = currentTime.getUTCHours();
        const currentMinute = currentTime.getUTCMinutes();

        // Query for users who should receive prompts at this time
        // Convert their local time preferences to UTC for comparison
        const { rows: usersForPrompts } = await db.sql`
            SELECT tp.*, w.org_id, o.ghl_webhook_url
            FROM task_preferences tp
            JOIN whitelist w ON tp.user_phone = w.phone_number
            JOIN organizations o ON w.org_id = o.id
            WHERE tp.daily_prompt_time IS NOT NULL
            AND w.ai_status = 'active'
        `;

        for (const user of usersForPrompts) {
            try {
                // Convert user's local prompt time to UTC
                const [hours, minutes] = user.daily_prompt_time.split(':');
                let promptHour = parseInt(hours);

                // Adjust for timezone (EST is UTC-5, but we'll be flexible)
                // For now, assuming 8:00 AM EST = 13:00 UTC (1 PM UTC)
                if (user.timezone === 'America/New_York') {
                    promptHour += 5; // Convert EST to UTC
                }

                // Check if current time matches prompt time (with 1 hour window)
                const timeMatch = (currentHour === promptHour && currentMinute >= 0 && currentMinute < 60);

                if (timeMatch) {
                    console.log(`Sending daily prompt to ${user.user_phone} at ${currentTime.toISOString()}`);

                    // Check if we already sent a prompt today
                    const today = currentTime.toISOString().split('T')[0];
                    const { rows: existingPrompts } = await db.sql`
                        SELECT id FROM task_checkins
                        WHERE user_phone = ${user.user_phone}
                        AND task_date = ${today}
                        AND checkin_type = 'daily_prompt'
                    `;

                    if (existingPrompts.length === 0) {
                        // Generate and send daily prompt
                        const promptMessage = await TaskManager.sendDailyPrompt(user.user_phone);

                        if (promptMessage && promptMessage.length > 0) {
                            const webhookUrl = user.ghl_webhook_url || OUTBOUND_WEBHOOK_URL;

                            if (webhookUrl) {
                                try {
                                    await axios.post(webhookUrl, {
                                        phone: user.user_phone,
                                        message: promptMessage,
                                        source: 'task_manager_daily_prompt'
                                    });

                                    console.log(`✅ Daily prompt sent to ${user.user_phone}`);
                                    processedCount++;
                                } catch (sendError) {
                                    console.error(`Failed to send daily prompt to ${user.user_phone}:`, sendError);
                                }
                            } else {
                                console.error(`No webhook URL for user ${user.user_phone}`);
                            }
                        }
                    } else {
                        console.log(`Daily prompt already sent to ${user.user_phone} today`);
                    }
                }
            } catch (userError) {
                console.error(`Error processing daily prompt for ${user.user_phone}:`, userError);
            }
        }

        // 4. Process Follow-up Calls for Non-Responsive Users
        console.log('Processing follow-up calls for accountability...');

        const callsTriggered = await TaskManager.processFollowUpCalls();

        if (callsTriggered.length > 0) {
            console.log(`✅ Triggered ${callsTriggered.length} follow-up calls: ${callsTriggered.join(', ')}`);
        }

        return NextResponse.json({
            status: 'ok',
            processed: processedCount,
            follow_up_calls: callsTriggered.length,
            timestamp: currentTime.toISOString(),
            utc_time: `${currentHour}:${currentMinute.toString().padStart(2, '0')}`
        });

    } catch (e: any) {
        console.error("Cron Error:", e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
