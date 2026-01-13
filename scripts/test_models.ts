import 'dotenv/config';
import { GoogleGenerativeAI } from "@google/generative-ai";

async function main() {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
        console.error("No API Key found");
        return;
    }
    console.log("Using Key:", key.substring(0, 10) + "...");

    // Can't easily use listModels via SDK immediately, let's just try generateContent on a few known models
    const models = ["gemini-1.5-flash", "gemini-1.5-pro", "gemini-1.0-pro", "gemini-pro"];

    const genAI = new GoogleGenerativeAI(key);

    for (const m of models) {
        console.log(`\nTesting ${m}...`);
        try {
            const model = genAI.getGenerativeModel({ model: m });
            const result = await model.generateContent("Hello");
            console.log(`[SUCCESS] ${m} works! Response: ${result.response.text()}`);
        } catch (e: any) {
            console.log(`[FAILURE] ${m}: ${e.message}`);
        }
    }
}

main();
