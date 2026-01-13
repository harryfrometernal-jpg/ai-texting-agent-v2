
import { GoogleGenerativeAI } from "@google/generative-ai";
import { IncomingMessageContext } from "./types";
import { db } from "@/lib/db";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

export async function runPicassoAgent(context: IncomingMessageContext): Promise<string> {
    // 1. Refine Prompt
    // User might say "Draw a cat". We want "A hyper-realistic 8k cinematic photo of a fluffy cat..."
    // We use Gemini to prompt-engineer the user's request.
    const enhancerPrompt = `
    User Request: "${context.body}"
    
    Task: Convert this into a highly detailed, descriptive image generation prompt. 
    Focus on lighting, style, composition, and mood.
    Return ONLY the prompt text.
    `;


    try {
        const result = await model.generateContent(enhancerPrompt);
        const enhancedPrompt = result.response.text().trim();
        const encodedPrompt = encodeURIComponent(enhancedPrompt);

        // 2. Generate Base Image URL (Pollinations.ai)
        const remoteUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}`;

        // 3. Create Ephemeral Link
        // Expiration: 24 hours from now
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

        const { rows } = await db.sql`
            INSERT INTO temporary_images (remote_url, expires_at)
            VALUES (${remoteUrl}, ${expiresAt})
            RETURNING id;
        `;

        if (rows.length > 0) {
            const imageId = rows[0].id;
            // Assuming the app is deployed on Vercel or locally, we construct the URL.
            // In production, you might want to use process.env.NEXT_PUBLIC_APP_URL
            const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000';
            const shortLink = `${appUrl}/api/images/${imageId}`;

            return `Here is your masterpiece! 🎨\n\n${shortLink}\n\n(This link will expire in 24 hours)`;
        } else {
            throw new Error("Failed to insert into temporary_images");
        }

    } catch (e) {
        console.error("Picasso Error:", e);
        return "I broke my paintbrush... couldn't generate that image right now.";
    }
}
