
import { GoogleGenerativeAI } from "@google/generative-ai";
import { IncomingMessageContext } from "./types";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" }); // 2.0 Flash has excellent vision and is compatible with new key

export async function runVisionAgent(context: IncomingMessageContext): Promise<string> {
    const imageUrl = (context as any).mediaUrl0; // GHL/Twilio sends MediaUrl0, MediaUrl1...

    if (!imageUrl) {
        return "I see you sent an image, but I couldn't download it. Could you try again?";
    }

    try {
        // Fetch image bytes
        const imageResp = await fetch(imageUrl);
        const imageBuffer = await imageResp.arrayBuffer();

        const prompt = `
        User Message: "${context.body}"
        
        TASK: Visual Estimation & Analysis
        1. Analyze the attached image in detail.
        2. If it looks like a repair issue (plumbing, electrical, damage), describe the damage technically and suggest an estimated severity (Low/Medium/High).
        3. If it is a document/receipt, extract total amounts.
        4. OUTPUT FORMAT:
           If estimating: "ESTIMATE REQUEST: [Description of damage]. Severity: [Level]. Recommended Action: [Action]."
           Otherwise: [Helpful interaction].
        
        Be helpful and professional.
        `;

        const result = await model.generateContent([
            prompt,
            {
                inlineData: {
                    data: Buffer.from(imageBuffer).toString("base64"),
                    mimeType: imageResp.headers.get("content-type") || "image/jpeg",
                },
            },
        ]);

        return result.response.text();
    } catch (error) {
        console.error("Vision Agent Error:", error);
        return "I received your image, but I'm having trouble analyzing it right now.";
    }
}
