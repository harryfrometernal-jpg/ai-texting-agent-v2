import { db } from "@/lib/db";
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

export async function runSystemAgent(): Promise<string> {
    let report = "🩺 **System Health Report**\n";
    let issues = false;

    // Database
    try {
        await db.sql`SELECT 1`;
        report += "✅ Database: Connected\n";
    } catch (e) {
        report += "❌ Database: Error\n";
        issues = true;
    }

    // AI
    try {
        await model.generateContent("ping");
        report += "✅ Gemini AI: Online\n";
    } catch (e) {
        report += "❌ Gemini AI: Unreachable\n";
        issues = true;
    }

    // Configs
    report += process.env.VAPI_PRIVATE_KEY ? "✅ Voice: Configured\n" : "⚠️ Voice: Missing Key\n";
    report += process.env.GOOGLE_SERVICE_ACCOUNT_JSON ? "✅ Google Ops: Configured\n" : "⚠️ Google Ops: Missing Creds\n";
    report += process.env.GOOGLE_MAPS_API_KEY ? "✅ Maps: Configured\n" : "⚠️ Maps: Missing Key\n";

    if (!issues) report += "\nAll systems nominal. I am ready to serve.";
    else report += "\nSome systems are degraded.";

    return report;
}
