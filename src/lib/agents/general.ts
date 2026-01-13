import { GoogleGenerativeAI } from "@google/generative-ai";
import { IncomingMessageContext } from "./types";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export async function runGeneralAgent(context: IncomingMessageContext): Promise<string> {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" }); // Using 1.5 Flash as standard

    const prompt = `
    You are a helpful AI assistant.
    You are chatting with a user via SMS.
    User's Name: ${context.contactName}
    
    Please answer their question or respond to their message concisely (suitable for SMS).
    
    User Message: "${context.body}"
  `;

    try {
        const result = await model.generateContent(prompt);
        return result.response.text();
    } catch (error) {
        console.error("General Agent Error:", error);
        return "I'm sorry, I'm having trouble thinking right now.";
    }
}
