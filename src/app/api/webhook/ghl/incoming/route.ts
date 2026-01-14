import { NextResponse } from 'next/server';
import { db } from "@/lib/db";
import { normalizePhoneNumber } from '@/lib/utils';
import { ErrorHandler } from '@/lib/utils/error-handler';

export async function POST(req: Request) {
    try {
        const body = await req.json();
        console.log("Received Webhook:", body);

        const { From, Body, contact_name } = body;

        // 1. Validation
        if (!From || !Body) {
            return NextResponse.json({ error: "Missing From or Body" }, { status: 400 });
        }

        const normalizedFrom = normalizePhoneNumber(From);
        const last10 = normalizedFrom.slice(-10);

        // 2. Log Inbound (Moved BEFORE whitelist check so we see everything)
        // 2. Log Inbound
        const { rows: logs } = await db.sql`
            INSERT INTO conversation_logs (contact_phone, direction, content, agent_used)
            VALUES (${From}, 'inbound', ${Body}, 'router')
            RETURNING *
        `;
        const logEntry = logs[0];

        // 3. New Logic: Check Whitelist (Admin/Team) FIRST
        console.log(`[Webhook] Checking Whitelist (Admin) for: ${From}`);
        const { rows: whitelistRows } = await db.sql`
            SELECT * FROM whitelist 
            WHERE phone_number = ${normalizedFrom} OR phone_number = ${From} -- Strict + Normalize
            LIMIT 1
        `;
        const adminUser = whitelistRows[0];

        // Variables to hold user context
        let userId = null;
        let userOrgId = null;
        let isFullAdmin = false;
        let activeGoal = null;

        if (adminUser) {
            console.log(`[Webhook] User is ADMIN/Whitelist: ${adminUser.name} - FULL ACCESS GRANTED`);
            userId = adminUser.id;
            userOrgId = adminUser.org_id;
            isFullAdmin = true;

            if (adminUser.ai_status === 'paused') {
                return NextResponse.json({ status: "paused_for_admin" });
            }
        } else {
            // 4. If not Admin, Check Contacts (Leads) - RESTRICTED ACCESS
            console.log(`[Webhook] Not Admin. Checking Contacts for: ${From}`);
            // Use fuzzy match for contacts/leads as they might come in with various formats
            const { rows: contactRows } = await db.sql`
                SELECT * FROM contacts
                WHERE phone_number LIKE ${'%' + last10}
                LIMIT 1
             `;
            let contactUser = contactRows[0];

            if (!contactUser) {
                // Contact not found - Skip auto-creation for non-whitelisted numbers
                console.log(`[Webhook] Contact not found for ${normalizedFrom}. Skipping response - contacts must be pre-added.`);
                return NextResponse.json({ status: "contact_not_found" });
            }

            console.log(`[Webhook] Found Lead Contact: ${contactUser.name}`);
            userId = contactUser.id;
            userOrgId = contactUser.org_id;

            if (contactUser.ai_status === 'paused') {
                return NextResponse.json({ status: "paused_for_lead" });
            }

            // CHECK GOAL STATUS - REQUIRED FOR CONTACTS
            const { rows: goals } = await db.sql`
                SELECT * FROM conversation_goals
                WHERE contact_phone = ${From} AND status = 'active'
                ORDER BY created_at DESC LIMIT 1
            `;

            if (goals.length === 0) {
                // NO Active Goal -> CONTACTS CANNOT MESSAGE WITHOUT GOALS
                console.log(`[Webhook] No active goal for contact ${From}. Ignoring message - contacts require active goals.`);
                return NextResponse.json({ status: "no_active_goal" });
            } else {
                activeGoal = goals[0];
                console.log(`[Webhook] Contact has active goal: ${activeGoal.goal_description}. Processing message.`);
            }
        }

        const context = {
            from: From,
            body: Body,
            contactName: contact_name || (isFullAdmin ? adminUser.name : 'Client'),
            orgId: userOrgId,
            numMedia: body.NumMedia,
            mediaUrl0: body.MediaUrl0,
            isAdmin: isFullAdmin, // Pass this to router if needed
            activeGoal: activeGoal
        };

        // 4. Route Message
        const { routeMessage } = await import('@/lib/agents/router');
        const routingResult = await routeMessage(context);
        console.log("Routing Result:", routingResult);

        // Update log with sentiment if available
        // Update log with sentiment if available
        if (logEntry && routingResult.sentiment) {
            if (logEntry && routingResult.sentiment) {
                await db.sql`
                UPDATE conversation_logs 
                SET sentiment = ${routingResult.sentiment}
                WHERE id = ${logEntry.id}
            `;
            }
        }

        // --- SENTINEL MODE ---
        if (routingResult.sentiment === 'negative' || routingResult.sentiment === 'frustrated') {
            console.log(`SENTINEL ALERT: Negative sentiment detected for ${From}. Pausing AI.`);

            // 1. Pause AI
            // 1. Pause AI
            await db.sql`
                UPDATE contacts 
                SET ai_status = 'paused'
                WHERE phone_number = ${From}
            `;

            // 2. Alert Admin (Log entry serves as alert for now)
            // 2. Alert Admin (Log entry)
            await db.sql`
                INSERT INTO conversation_logs (contact_phone, direction, content, agent_used)
                VALUES (${From}, 'outbound', '🚨 SENTINEL ALERT: User flagged as frustrated. AI Paused. Admin notified.', 'sentinel_system')
            `;

            // 3. Reply to User
            const sentinelMsg = "I hear you. I'm connecting you to a human manager to resolve this immediately.";

            // Log the actual sentinel reply
            // Log sentinel reply
            await db.sql`
                INSERT INTO conversation_logs (contact_phone, direction, content, agent_used)
                VALUES (${From}, 'outbound', ${sentinelMsg}, 'sentinel_reply')
            `;

            return NextResponse.json({ response: sentinelMsg });
        }

        let finalResponse = "";

        // 5. Execute Agent with Error Handling
        const errorContext = {
            from: From,
            orgId: userOrgId,
            agent: routingResult.type,
            originalMessage: Body
        };

        try {
            switch (routingResult.type) {
                case 'vapi':
                    // Trigger Call
                    if (routingResult.vapiAssistantId) {
                        const callResult = await ErrorHandler.retryWithBackoff(async () => {
                            const { triggerVapiCall } = await import('@/lib/agents/vapi');
                            return await triggerVapiCall(From, routingResult.vapiAssistantId!, {
                                name: context.contactName,
                                summary: `User asked: "${context.body}". Please assist them.`
                            });
                        }, 2, 1000);

                        if (callResult) {
                            finalResponse = "I'm having the agent call you now.";
                        } else {
                            finalResponse = "I tried to call you, but I couldn't connect. A manager will reach out shortly.";
                        }
                    } else {
                        finalResponse = "I wanted to classify to call, but didn't know which agent.";
                    }
                    break;

                case 'calendar':
                    finalResponse = await ErrorHandler.retryWithBackoff(async () => {
                        const { runCalendarAgent } = await import('@/lib/agents/calendar');
                        return await runCalendarAgent(context);
                    }, 2);
                    break;

                case 'docs':
                    const { runDocsAgent } = await import('@/lib/agents/docs');
                    finalResponse = await runDocsAgent(context);
                    break;

                case 'followup_scheduler':
                    const { runFollowupAgent } = await import('@/lib/agents/scheduler');
                    finalResponse = await runFollowupAgent(context);
                    break;

                case 'vision':
                    const { runVisionAgent } = await import('@/lib/agents/vision');
                    finalResponse = await runVisionAgent(context);
                    break;

                case 'picasso':
                    const { runPicassoAgent } = await import('@/lib/agents/picasso');
                    finalResponse = await runPicassoAgent(context);
                    break;

                case 'campaigner':
                    const { runCampaignerAgent } = await import('@/lib/agents/campaigner');
                    finalResponse = await runCampaignerAgent(context);
                    break;

                case 'concierge':
                    const { runConciergeAgent } = await import('@/lib/agents/concierge');
                    finalResponse = await runConciergeAgent(context);
                    break;

                case 'system':
                    const { runSystemAgent } = await import('@/lib/agents/system');
                    finalResponse = await runSystemAgent();
                    break;

                case 'scheduler':
                    const { runTimeTravelerAgent } = await import('@/lib/agents/time_traveler');
                    finalResponse = await runTimeTravelerAgent(context);
                    break;

                case 'zoom':
                    finalResponse = await ErrorHandler.retryWithBackoff(async () => {
                        const { runZoomAgent } = await import('@/lib/agents/zoom_agent');
                        return await runZoomAgent(context);
                    }, 2);
                    break;

                case 'contact_manager':
                    // Check if this is from admin
                    console.log('🔍 Webhook: Trying contact_manager with', {
                        From,
                        Body: Body.substring(0, 50) + '...',
                        agent: 'contact_manager'
                    });

                    const { ContactManager } = await import('@/lib/agents/contact_manager');
                    const contactCommand = await ContactManager.parseCommand(From, Body);

                    console.log('🔍 Webhook: Contact command result', {
                        commandFound: !!contactCommand,
                        command: contactCommand
                    });

                    if (contactCommand) {
                        finalResponse = await ContactManager.processCommand(contactCommand, From);
                    } else {
                        finalResponse = "Contact management commands are only available to administrators.";
                    }
                    break;


                case 'general':
                default:
                    finalResponse = await ErrorHandler.retryWithBackoff(async () => {
                        const { runKnowledgeAgent } = await import('@/lib/agents/knowledge');
                        return await runKnowledgeAgent(context);
                    }, 2);
                    break;
            }
        } catch (error) {
            finalResponse = await ErrorHandler.handleAgentError(error, errorContext);
        }

        // 6. Goal Tracking (only for contacts, not whitelisted admin users)
        if (!isFullAdmin && activeGoal) {
            const { GoalTracker } = await import('@/lib/agents/goal_tracker');
            const goalProgress = await GoalTracker.analyzeProgress(From, Body, finalResponse);

            // If goal completed, send summary to admin
            if (goalProgress.isCompleted) {
                const summary = await GoalTracker.getGoalSummary(From);
                const { AdminNotificationService } = await import('@/lib/services/admin_notifications');
                await AdminNotificationService.goalCompleted(From, context.contactName, summary, context.orgId);
            }

            // If conversation going off track, alert admin
            if (goalProgress.shouldAlert && !goalProgress.isCompleted) {
                const { AdminNotificationService: AdminNotificationService2 } = await import('@/lib/services/admin_notifications');
                await AdminNotificationService2.goalDrift(From, context.contactName, goalProgress.alertReason || "Conversation drift detected", context.orgId);
            }
        }

        // 7. Log Outbound
        await db.sql`
            INSERT INTO conversation_logs (contact_phone, direction, content, agent_used)
            VALUES (${From}, 'outbound', ${finalResponse}, ${routingResult.type})
        `;

        // 8. Background: Extract Memories (Fire and Forget)
        // We don't await this so the webhook returns fast
        Promise.all([
            (async () => {
                const { MemoryManager } = await import('@/lib/agents/memory');
                return MemoryManager.extractMemories(From, Body, finalResponse);
            })(),
            (async () => {
                const { MemoryManager } = await import('@/lib/agents/memory');
                return MemoryManager.summarizeRecentChat(From);
            })()
        ]).catch(err => console.error("Memory Background Task Error:", err));

        // 8. Return to GHL
        return NextResponse.json({ response: finalResponse });

    } catch (error: any) {
        console.error("Critical Webhook Error:", error);

        // Try to get context for critical error handling
        let errorFrom = 'unknown';
        let errorOrgId = undefined;
        try {
            const errorBody = await req.json().catch(() => ({}));
            errorFrom = errorBody.From || 'unknown';
        } catch (e) {
            // Ignore parsing errors
        }

        // Handle critical error (don't await to avoid blocking response)
        ErrorHandler.handleCriticalError(error, {
            from: errorFrom,
            orgId: errorOrgId
        }).catch(alertError => {
            console.error("Failed to send critical error alert:", alertError);
        });

        return NextResponse.json({
            response: "I'm experiencing technical difficulties. A team member has been notified and will help you shortly."
        });
    }
}
