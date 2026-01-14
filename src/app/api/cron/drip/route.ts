
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { GoogleGenerativeAI } from "@google/generative-ai";

export async function GET(req: Request) {
    // Secure Cron
    // const authHeader = req.headers.get('authorization');
    // if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    //     return new Response('Unauthorized', { status: 401 });
    // }

    try {
        // 1. Fetch Pending Items
        // Limit to 5 per run to avoid timeouts/rate limits
        // 1. Fetch Pending Items
        // Limit to 5 per run to avoid timeouts/rate limits
        const { rows: queueItems } = await db.sql`
            SELECT cq.*, c.goal 
            FROM campaign_queue cq
            LEFT JOIN campaigns c ON cq.campaign_id = c.id
            WHERE cq.status = 'pending'
            LIMIT 5
        `;

        if (!queueItems || queueItems.length === 0) {
            return NextResponse.json({ message: "No pending items." });
        }

        const results = [];

        for (const item of queueItems) {
            try {
                // Check if campaign is still active
                // (Optimally we filter this in the query, but Supabase relational filters can be tricky in one go)

                // 2. Generate Message
                // const memories = await MemoryManager.getMemories(item.contact_phone);
                // Note: Join result puts columns in same object properly or prefixes them? 
                // In pg, it merges. 'goal' should be on item directly if naming collision avoided.
                const goal = item.goal || "Check in";

                // Fetch memories (MemoryManager still uses Supabase internally? check it)
                const { MemoryManager } = await import('@/lib/agents/memory');
                const memories = await MemoryManager.getMemories(item.contact_phone);

                const prompt = `
                You are a marketing assistant.
                Goal: Write a short SMS (1-2 sentences) to a customer about: "${goal}".
                
                Context/Memories about them:
                ${memories || "None"}

                Rules:
                - Be friendly and personalized.
                - Keep it under 160 chars.
                - No hashtags.
                `;

                const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
                const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
                const result = await model.generateContent(prompt);
                const message = result.response.text().trim();

                // 3. Send (Simulate or Webhook)
                // await axios.post(GHL_WEBHOOK, ...);

                // 4. Update Queue Status
                // 4. Update Queue Status
                await db.sql`
                    UPDATE campaign_queue 
                    SET status = 'sent', ai_message = ${message}, sent_at = ${new Date().toISOString()}
                    WHERE id = ${item.id}
                `;

                // 5. Log
                // 5. Log
                await db.sql`
                    INSERT INTO conversation_logs (contact_phone, direction, content, agent_used)
                    VALUES (${item.contact_phone}, 'outbound', ${message}, 'broadcast_drip')
                `;

                results.push({ id: item.id, status: 'sent' });

            } catch (err) {
                console.error(`Drip failed for ${item.id}`, err);
                await db.sql`UPDATE campaign_queue SET status = 'failed' WHERE id = ${item.id}`;
                results.push({ id: item.id, status: 'failed' });
            }
        }

        return NextResponse.json({ success: true, processed: results.length, results });

    } catch (e: any) {
        console.error("Cron Drip Error:", e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
