import { GoogleGenerativeAI } from "@google/generative-ai";
import { db } from "@/lib/db";
import { IncomingMessageContext } from "./types";
import { normalizePhoneNumber } from "@/lib/utils";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

export async function runTimeTravelerAgent(context: IncomingMessageContext): Promise<string> {
    const today = new Date().toISOString();

    // 1. Parse Request
    const prompt = `
    Current Time: ${today}
    User Request: "${context.body}"
    Sender Phone: "${context.from}"
    
    Goal: Schedule a text message for the future.
    
    Extract:
    - target_phone: Who to text? If "me" or "myself", use Sender Phone. If a name, output the name (we might need to look it up, but for now assume they provide number or we ask).
    - scheduled_at: ISO timestamp for when to send.
    - message_body: What to say.

    Respond in JSON:
    {
        "target_phone": "+15550001234", 
        "scheduled_at": "2025-10-20T10:00:00Z",
        "message_body": "Don't forget the meeting!",
        "confirmation_text": "I've scheduled that for you." 
    }
    `;

    try {
        const result = await model.generateContent(prompt);
        const text = result.response.text().replace(/```json/g, '').replace(/```/g, '').trim();
        const data = JSON.parse(text);

        // Basic normalization if it looks like a phone number
        let target = data.target_phone;
        if (target.match(/\d{10}/)) {
            target = normalizePhoneNumber(target);
        }

        // 2. Insert into DB
        if (!context.orgId) {
            console.warn(`[Time Traveler] Missing Org ID for ${context.from}. Scheduling might fail if no global webhook.`);
        }

        await db.sql`
            INSERT INTO scheduled_messages (target_phone, message_body, scheduled_at, status, org_id)
            VALUES (${target}, ${data.message_body}, ${data.scheduled_at}, 'pending', ${context.orgId})
        `;

        return `✅ Scheduled! I'll text ${target} at ${new Date(data.scheduled_at).toLocaleString()} saying: "${data.message_body}"`;

    } catch (e: any) {
        console.error("Time Traveler Error:", e);
        return "I couldn't schedule that. Please try specifying the time and message clearly.";
    }
}
