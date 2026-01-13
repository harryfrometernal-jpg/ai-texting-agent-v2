
import { GoogleGenerativeAI } from "@google/generative-ai";
import { db } from "@/lib/db";
import { IncomingMessageContext } from "./types";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

export async function runFollowupAgent(context: IncomingMessageContext): Promise<string> {
    // 1. Parse Schedule Request
    const prompt = `
    User Request: "${context.body}"
    Current Time (UTC): ${new Date().toISOString()}

    Extract the following strictly in JSON:
    - scheduled_for: ISO 8601 Timestamp of when to remind/follow-up.
    - task_type: 'followup' (default)
    - payload: The reminder message. "Remind me to [action]" -> Payload: "Reminder: [action]"
    
    If no clear time is given, guess logically (e.g. "tomorrow" = +24h, "next week" = +7d).
    `;

    try {
        const result = await model.generateContent(prompt);
        const text = result.response.text().replace(/```json/g, '').replace(/```/g, '').trim();
        const data = JSON.parse(text);

        if (data.scheduled_for && !isNaN(Date.parse(data.scheduled_for))) {
            // 2. Insert into DB
            // 2. Insert into DB (Vercel Postgres)
            // Note: storing contact_info as JSONB
            try {
                await db.sql`
                    INSERT INTO scheduled_tasks (contact_info, scheduled_for, task_type, payload, status)
                    VALUES (${JSON.stringify({ phone: context.from, name: context.contactName })}, ${data.scheduled_for}, ${data.task_type || 'followup'}, ${data.payload}, 'pending')
                `;
            } catch (error: any) {
                console.error("Scheduler DB Error:", error);
                return "I tried to schedule that, but something went wrong with my database.";
            }



            const date = new Date(data.scheduled_for);
            return `Got it. I'll remind you on ${date.toLocaleDateString()} at ${date.toLocaleTimeString()}.`;
        } else {
            return "I couldn't quite figure out the time. Could you say that again with a specific date or time?";
        }
    } catch (e) {
        console.error("Followup Agent Error:", e);
        return "Sorry, I had trouble setting that reminder.";
    }
}
