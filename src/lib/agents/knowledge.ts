import { GoogleGenerativeAI } from "@google/generative-ai";
import { db } from '@/lib/db';
import { getEmbedding } from "@/lib/rag/embeddings";
import { IncomingMessageContext } from "./types";
import { MemoryManager } from "./memory";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

import { createPaymentLink } from "@/lib/services/stripe";

export async function runKnowledgeAgent(context: IncomingMessageContext): Promise<string> {
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    // 1. Get Embedding for user query
    let contextText = "";
    try {
        const embedding = await getEmbedding(context.body);

        // 2. Search Knowledge Base (RAG) with Vercel Postgres (pgvector)
        const embeddingString = `[${embedding.join(',')}]`;

        const { rows: documents } = await db.sql`
            SELECT content, metadata
            FROM documents
            WHERE 1 - (embedding <=> ${embeddingString}::vector) > 0.6
            ORDER BY embedding <=> ${embeddingString}::vector ASC
            LIMIT 3
        `;

        if (documents && documents.length > 0) {
            contextText = documents.map((d: any) => d.content).join("\n---\n");
        }
    } catch (e) {
        console.error("RAG Retrieval Error:", e);
    }

    // 3. Fetch Long-Term Memory
    const userMemories = await MemoryManager.getMemories(context.from);

    // 4. Generate Answer with CLOSER Instruction
    const prompt = `
    You are a helpful AI assistant for a business.
    
    Business Knowledge Base:
    ${contextText || "No specific business knowledge found."}

    User Profile / Memories:
    ${userMemories || "No prior facts known about this user."}

    User Message: "${context.body}"

    Goal: Answer the user's question accurately.
    
    SPECIAL INSTRUCTION - THE CLOSER:
    If the user explicitly says they want to buy, sign up, or asks for a payment link/price to start NOW, 
    your response MUST start with the exact token: "ACTION_GENERATE_LINK".
    Then write a short, encouraging message to go with the link.
    Example: "ACTION_GENERATE_LINK Great! Let's get you started."

    GENERAL INSTRUCTIONS:
    - DETECT LANGUAGE: If the user speaks a language other than English (e.g. Spanish, French), YOU MUST REPLY IN THAT SAME LANGUAGE.
    - If context answers it, use it.
    - Keep response concise (SMS style).
    - If no buy signal, just answer normally.
    `;

    try {
        const result = await model.generateContent(prompt);
        let response = result.response.text();

        // Check for Closer Action
        if (response.includes("ACTION_GENERATE_LINK")) {
            const link = await createPaymentLink(context.from);
            response = response.replace("ACTION_GENERATE_LINK", "").trim();
            response += `\nHere is the link: ${link}`;
        }

        return response;
    } catch (error) {
        console.error("Knowledge Generation Error:", error);
        return "I'm having a little trouble connecting right now, but I received your message.";
    }
}
