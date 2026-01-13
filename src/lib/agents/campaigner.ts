import { GoogleGenerativeAI } from "@google/generative-ai";
import { IncomingMessageContext } from "./types";
import { db } from "@/lib/db";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

export async function runCampaignerAgent(context: IncomingMessageContext): Promise<string> {
    // 1. Parse Request
    // User: "Send a message to all VIPs saying Hi"
    const prompt = `
    User Request: "${context.body}"
    
    Extract:
    1. target_tag: The tag to filter users by (e.g. "VIP", "Lead", "All"). If "All", use "ALL".
    2. message_content: The message body to send.
    3. action: "preview" (default) or "send" (only if explicitly confirmed).
    
    Respond in JSON:
    {
        "target_tag": "tag",
        "message_content": "body",
        "action": "preview" | "send"
    }
    `;

    try {
        const result = await model.generateContent(prompt);
        const text = result.response.text().replace(/```json/g, '').replace(/```/g, '').trim();
        const data = JSON.parse(text);

        // 2. Query Audience Size
        let count = 0;
        let query;
        if (data.target_tag === 'ALL') {
            const { rows } = await db.sql`SELECT COUNT(*) FROM contacts`;
            count = parseInt(rows[0].count);
        } else {
            // Check if tag is in the tags array
            // Note: Postgres array contains check is `tag = ANY(tags)` or `tags @> ARRAY[tag]`
            // We'll use simple text matching or JSONB if we migrated to that, but we used text[]
            const { rows } = await db.sql`
                SELECT COUNT(*) FROM contacts 
                WHERE ${data.target_tag} = ANY(tags)
            `;
            count = parseInt(rows[0].count);
        }

        if (count === 0) {
            return `I couldn't find any contacts tagged with "${data.target_tag}". Try tagging some users primarily.`;
        }

        // 3. Confirm or Execute
        // For V1 MVP, we will mostly return the Preview and ask them to confirm in a specific way, 
        // OR if they said "Confirmed", we do it.
        // SAFEGUARD: Only execute if action is 'send' AND user said "confirm" or "yes" recently? 
        // For now, let's just show the preview and say "I prepared it".

        // Actually, to make it functional we need to write to `campaign_queue`.

        if (data.action === 'send' || context.body.toLowerCase().includes('confirm') || context.body.toLowerCase().includes('do it') || context.body.toLowerCase().includes('yes')) {
            // INSERT INTO QUEUE
            // We need to fetch the IDs first
            let contacts;
            if (data.target_tag === 'ALL') {
                const res = await db.sql`SELECT id, phone_number FROM contacts`;
                contacts = res.rows;
            } else {
                const res = await db.sql`SELECT id, phone_number FROM contacts WHERE ${data.target_tag} = ANY(tags)`;
                contacts = res.rows;
            }

            // Create Campaign
            const { rows: campRows } = await db.sql`
                INSERT INTO campaigns (goal, total_contacts, status)
                VALUES (${'Blast: ' + data.target_tag}, ${count}, 'active')
                RETURNING id
            `;
            const campaignId = campRows[0].id;

            // Bulk Insert (Loop for now, optimize later)
            for (const contact of contacts) {
                // 1. Add to Campaign Queue (To be sent)
                await db.sql`
                    INSERT INTO campaign_queue (campaign_id, contact_phone, contact_id, status, ai_message)
                    VALUES (${campaignId}, ${contact.phone_number}, ${contact.id}, 'pending', ${data.message_content})
                `;

                // 2. Set Active Goal for this Contact (So they can reply)
                // We deactivate any old active goals first to avoid confusion? Or just stack? 
                // Let's stack or rely on most recent. But typically we want one main focus. 
                // For simplicity: close old ones or just insert new one as active. 
                // Let's just insert new one. The webhook logic needs to handle multiple active goals or pick latest.
                // Best practice: Set others to 'abandoned' or 'completed' if a new campaign starts?
                // Let's keep it simple: Just insert new active goal.

                await db.sql`
                    INSERT INTO conversation_goals (contact_phone, goal_description, status, goal_type)
                    VALUES (${contact.phone_number}, ${'Respond to Campaign: ' + data.message_content.substring(0, 50) + '...'}, 'active', 'campaign_response')
                `;
            }

            // Trigger immediate processing of the campaign queue
            try {
                const baseUrl = process.env.NEXTAUTH_URL || process.env.VERCEL_URL || 'http://localhost:3000';
                const response = await fetch(`${baseUrl}/api/trigger/campaigns`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' }
                });
                const result = await response.json();
                console.log("Campaign processing triggered:", result);

                if (result.success && result.processed > 0) {
                    return `🚀 Campaign Launched! Successfully sent "${data.message_content}" to ${result.processed} contacts tagged "${data.target_tag}".`;
                }
            } catch (error) {
                console.error("Failed to trigger campaign processing:", error);
                // Don't fail the whole operation if this doesn't work
            }

            return `🚀 Campaign Launched! Sending "${data.message_content}" to ${count} contacts tagged "${data.target_tag}". Messages are being sent now.`;

        } else {
            return `📢 **Campaign Preview**\n\nTarget: ${data.target_tag} (${count} contacts)\nMessage: "${data.message_content}"\n\nReply "Confirm" to send this blast.`;
        }

    } catch (e) {
        console.error("Campaigner Error:", e);
        return "I had trouble setting up that campaign.";
    }
}
