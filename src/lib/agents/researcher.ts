
import { GoogleGenerativeAI } from "@google/generative-ai";
import * as cheerio from 'cheerio';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

export async function runResearcherAgent(url: string, context?: any): Promise<string> {
    try {
        // 1. Scrape Website
        // Simple fetch. For complex sites, Puppeteer is needed but heavier.
        const res = await fetch(url.startsWith('http') ? url : `https://${url}`);
        const html = await res.text();
        const $ = cheerio.load(html);

        // Extract key text sections
        const title = $('title').text();
        const metaDesc = $('meta[name="description"]').attr('content') || "";
        const h1 = $('h1').map((i, el) => $(el).text()).get().join('; ');
        const bodyText = $('body').text().replace(/\s+/g, ' ').substring(0, 3000); // Limit context

        // 2. Analyze & Generate Opener
        const prompt = `
        You are a top-tier Sales Development Rep.
        Target Website: ${title} (${url})
        Description: ${metaDesc}
        Key Headings: ${h1}
        Page Content: ${bodyText}

        Goal: Write a hyper-personalized "Cold Opener" SMS (under 160 chars) to the owner of this business.
        
        Rules:
        - Identify a likely pain point or compliment their specific work.
        - Don't sound like a bot.
        - End with a low-friction question.
        - Context: I provide ${context?.myBusinessDesc || "AI automation services"}.
        `;

        const result = await model.generateContent(prompt);
        return result.response.text().trim();

    } catch (e: any) {
        console.error("Headhunter Error:", e);
        return "I couldn't access that website. It might be blocking bots or the URL is invalid.";
    }
}
