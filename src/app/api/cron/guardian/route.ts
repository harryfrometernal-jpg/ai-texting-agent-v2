import { NextResponse } from 'next/server';
import { runKnowledgeAgent } from '@/lib/agents/knowledge';
import { db } from '@/lib/db';

export async function GET(req: Request) {
    try {
        console.log("🛡️ Guardian: Starting System Health Check...");

        // 1. Simulate a User Message
        const testContext = {
            from: '+15550009999', // Test Number
            body: 'Is the system online?',
            contactName: 'Guardian Bot'
        };

        // 2. Test Core Agent (Knowledge Base)
        const startTime = Date.now();
        const response = await runKnowledgeAgent(testContext);
        const duration = Date.now() - startTime;

        // 3. Verify Response
        if (!response || response.length === 0) {
            throw new Error("Agent returned empty response.");
        }

        console.log(`🛡️ Guardian: Check Passed in ${duration}ms. Response: "${response}"`);

        // 4. Log Success
        // 4. Log Success
        await db.sql`
            INSERT INTO conversation_logs (contact_phone, direction, content, agent_used, channel)
            VALUES ('SYSTEM_GUARDIAN', 'outbound', ${`✅ Health Check Passed (${duration}ms)`}, 'guardian_system', 'sms')
        `;

        return NextResponse.json({ status: 'healthy', latency: duration, sample_response: response });

    } catch (error: any) {
        console.error("🛡️ Guardian: SYSTEM FAILURE", error);

        // Log Failure
        // Log Failure
        await db.sql`
            INSERT INTO conversation_logs (contact_phone, direction, content, agent_used, channel)
            VALUES ('SYSTEM_GUARDIAN', 'outbound', ${`❌ Health Check FAILED: ${error.message}`}, 'guardian_system', 'sms')
        `;

        return NextResponse.json({ status: 'unhealthy', error: error.message }, { status: 500 });
    }
}
