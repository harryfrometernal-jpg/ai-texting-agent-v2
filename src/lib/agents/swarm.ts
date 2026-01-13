import { generateText } from '@/lib/rag/gemini';

interface SwarmResult {
    finalResponse: string;
    thoughtProcess: string[];
}

export async function runSwarmAgent(userMessage: string, context: any): Promise<SwarmResult> {
    console.log("🐝 The Hive: Swarm Activated for:", userMessage);
    const discussionLog: string[] = [];

    // 1. Sales Agent (The Aggressor)
    const salesPrompt = `
        You are the Sales Agent. Your ONLY goal is to close the deal and get money.
        Be aggressive, offer discounts if needed (fake ones are fine for this debate), and push for a call.
        User says: "${userMessage}"
        Draft a short, punchy SMS response.
    `;
    const salesDraft = await generateText(salesPrompt);
    discussionLog.push(`💰 Sales Agent: ${salesDraft}`);

    // 2. Risk/Policy Agent (The Protector)
    const riskPrompt = `
        You are the Risk & Compliance Agent.
        Critique the following draft from the Sales Agent.
        Draft: "${salesDraft}"
        
        Is it too pushy? Does it promise things we can't do?
        If it's fine, say "Clean". If not, point out the specific flaw. Do NOT rewrite it yet.
    `;
    const riskCritique = await generateText(riskPrompt);
    discussionLog.push(`🛡️ Risk Agent: ${riskCritique}`);

    // 3. The Manager (The Synthesizer)
    const managerPrompt = `
        You are the Manager Agent. You make the final decision.
        
        User Input: "${userMessage}"
        
        Sales Agent proposed: "${salesDraft}"
        Risk Agent critiqued: "${riskCritique}"
        
        Synthesize a FINAL response that balances closing the deal with being professional and safe.
        It must be under 160 characters (SMS).
        Return ONLY the final message text.
    `;
    const finalResponse = await generateText(managerPrompt);
    discussionLog.push(`👔 Manager: ${finalResponse}`);

    console.log("🐝 Hive Decision:", finalResponse);
    return {
        finalResponse,
        thoughtProcess: discussionLog
    };
}
