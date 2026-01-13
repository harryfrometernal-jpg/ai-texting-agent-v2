import { GoogleGenerativeAI } from "@google/generative-ai";
import { db } from "@/lib/db";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-lite-preview-02-05" });

export interface Memory {
    key: string;
    value: string;
    confidence: number;
}

export class MemoryManager {

    /**
     * Retrieves all verified memories for a specific contact.
     */
    static async getMemories(phone: string): Promise<string> {
        const { rows: data } = await db.sql`
            SELECT memory_key, memory_value 
            FROM contact_memories 
            WHERE contact_phone = ${phone}
        `;

        if (!data || data.length === 0) return "";

        return data.map(m => `- ${m.memory_key}: ${m.memory_value}`).join('\n');
    }

    /**
     * Analyzes a conversation turn to extract new facts.
     * This should be run in the background.
     */
    static async extractMemories(phone: string, userMessage: string, context?: string) {
        try {
            // We only care about FACTS about the user or their business/life.
            // We ignore temporary intent like "I'm hungry".
            const prompt = `
            Analyze the following message from a user (Phone: ${phone}) and extract permanently useful facts about them.
            Focus on: Names, Job Titles, Pet Names, Family, Preferences, Important Dates, Location.
            Ignore: Temporary states ("I'm driving"), Questions, or Commands.
            
            Existing Memories (Context):
            ${context || "None"}

            User Message: "${userMessage}"

            Return strictly a JSON array of objects: [{ "key": "string", "value": "string" }].
            Key should be snake_case (e.g. user_name, dog_name).
            If no new facts are found, return empty array [].
            `;

            const result = await model.generateContent(prompt);
            const text = result.response.text().replace(/```json/g, '').replace(/```/g, '').trim();
            const facts = JSON.parse(text);

            if (Array.isArray(facts) && facts.length > 0) {
                console.log(`[Memory] Extracted for ${phone}:`, facts);

                for (const fact of facts) {
                    await db.sql`
                        INSERT INTO contact_memories (contact_phone, memory_key, memory_value, confidence)
                        VALUES (${phone}, ${fact.key}, ${fact.value}, 0.9)
                        ON CONFLICT (contact_phone, memory_key)
                        DO UPDATE SET memory_value = EXCLUDED.memory_value, confidence = EXCLUDED.confidence
                    `;
                }
            }
        } catch (error) {
            console.error("[Memory] Extraction failed:", error);
        }
    }

    /**
     * Compresses recent chat history into a summary to save context window.
     * Should be triggered periodically (e.g. every 10 messages).
     */
    static async summarizeRecentChat(phone: string): Promise<void> {
        try {
            // 1. Fetch last 20 messages regardless of direction
            const logsResult = await db.sql`
                SELECT direction, content, created_at
                FROM conversation_logs
                WHERE contact_phone = ${phone}
                ORDER BY created_at DESC
                LIMIT 20
            `;

            const logs = logsResult.rows.reverse(); // Oldest first
            if (logs.length < 10) return; // Not enough to summarize

            const conversationText = logs.map((l: any) => `${l.direction.toUpperCase()}: ${l.content}`).join('\n');

            // 2. Generate Summary
            const prompt = `
            Summarize the key points of this conversation in 3-4 bullets.
            Focus on what the user wants, what was promised, and any open loops.
            
            Conversation:
            ${conversationText}
            `;

            const result = await model.generateContent(prompt);
            const summary = result.response.text();

            console.log(`[Memory] Summary for ${phone}:\n${summary}`);

            // 3. Store in Memory Table (special key)
            // Use a rotating key or just 'chat_summary_latest'
            // For now, let's just keep one 'chat_summary_latest' and append? 
            // Better: 'chat_summary' overwrites context. 
            // Ideally we'd archive old summaries, but let's stick to simple "Current Context" summary.

            await db.sql`
                INSERT INTO contact_memories (contact_phone, memory_key, memory_value, confidence)
                VALUES (${phone}, 'latest_chat_summary', ${summary}, 0.8)
                ON CONFLICT (contact_phone, memory_key)
                DO UPDATE SET memory_value = EXCLUDED.memory_value, confidence = EXCLUDED.confidence
            `;

        } catch (e) {
            console.error("[Memory] Summarization failed:", e);
        }
    }
}
