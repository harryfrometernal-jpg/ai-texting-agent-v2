import { GoogleGenerativeAI } from "@google/generative-ai";
import { IncomingMessageContext } from "./types";
import axios from 'axios';
import { withRetry } from '@/lib/retry';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

export async function runConciergeAgent(context: IncomingMessageContext): Promise<string> {
    // 1. Parse Request
    const prompt = `
    User Request: "${context.body}"
    
    Extract:
    1. query: What are they looking for? (e.g. "Sushi", "Gas Station")
    2. location: Did they specify a city? If not, valid city is null.
    
    Respond in JSON:
    { "query": "sushi", "location": "Austin, TX" }
    `;

    try {
        const result = await model.generateContent(prompt);
        const text = result.response.text().replace(/```json/g, '').replace(/```/g, '').trim();
        const data = JSON.parse(text);

        const apiKey = process.env.GOOGLE_MAPS_API_KEY;
        const location = data.location || "your area";

        if (apiKey) {
            // Real API Call (Places API New)
            try {
                const searchUrl = `https://places.googleapis.com/v1/places:searchText`;
                const res = await withRetry(() => axios.post(searchUrl, {
                    textQuery: `${data.query} in ${location}`
                }, {
                    headers: {
                        'Content-Type': 'application/json',
                        'X-Goog-Api-Key': apiKey,
                        'X-Goog-FieldMask': 'places.displayName,places.formattedAddress,places.rating'
                    }
                }));

                if (res.data.places && res.data.places.length > 0) {
                    // Get top 3
                    const top3 = res.data.places.slice(0, 3).map((r: any) =>
                        `📍 ${r.displayName.text} (${r.rating || 'N/A'}⭐)\n${r.formattedAddress}`
                    ).join('\n\n');

                    return `Here are the top spots for "${data.query}" in ${location}:\n\n${top3}\n\n[Open Maps](https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(data.query + ' ' + location)})`;
                }
            } catch (err) {
                console.error("Maps API Error:", err);
            }
        }

        // Fallback or No Key
        return `I found some options for "${data.query}" in ${location}. Check them out here:\n\nhttps://www.google.com/maps/search/?api=1&query=${encodeURIComponent(data.query + ' in ' + location)}`;

    } catch (e) {
        console.error("Concierge Error:", e);
        return "I can't find my map right now.";
    }
}
