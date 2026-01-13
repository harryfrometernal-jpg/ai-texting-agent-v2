import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import { IncomingMessageContext } from "./types";
import { db } from "@/lib/db";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

const tools = {
    schedule_followup: {
        description: "Schedule a follow-up message or task for a client.",
        parameters: {
            type: SchemaType.OBJECT,
            properties: {
                datetime: { type: SchemaType.STRING, description: "ISO 8601 date time for the follow-up" },
                message: { type: SchemaType.STRING, description: "The message or action to take" },
            },
            required: ["datetime", "message"]
        }
    }
};

export async function runFollowUpAgent(context: IncomingMessageContext): Promise<string> {
    const now = new Date().toISOString();
    const model = genAI.getGenerativeModel({
        model: "gemini-1.5-flash",
        tools: [{ functionDeclarations: Object.entries(tools).map(([name, schema]) => ({ name, ...schema })) as any }]
    });

    const prompt = `
    Current Time: ${now}
    User Request: ${context.body}
    Goal: Schedule a follow up.
  `;

    try {
        const result = await model.generateContent(prompt);
        const call = result.response.functionCalls()?.[0];

        if (call && call.name === 'schedule_followup') {
            const args = call.args as any;

            await db.sql`
                INSERT INTO scheduled_tasks (contact_info, scheduled_for, task_type, payload)
                VALUES (${JSON.stringify({ phone: context.from, name: context.contactName })}, ${args.datetime}, 'followup', ${args.message})
            `;

            // if (error) throw error; // db.sql throws automatically

            return `I've scheduled a follow-up for ${args.datetime}. I will remind you to: "${args.message}"`;
        }

        return "I wasn't sure when to schedule that. Please specify a time.";
    } catch (error) {
        console.error("FollowUp Agent Error:", error);
        return "Failed to schedule follow-up.";
    }
}
