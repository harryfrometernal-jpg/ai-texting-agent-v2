
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getEmbedding } from '@/lib/rag/embeddings';
import * as cheerio from 'cheerio';

export async function POST(req: Request) {
    try {
        const { url } = await req.json();

        if (!url) return NextResponse.json({ error: "URL is required" }, { status: 400 });

        // 1. Scrape
        let html;
        try {
            const res = await fetch(url.startsWith('http') ? url : `https://${url}`, {
                headers: { 'User-Agent': 'Mozilla/5.0 (AI Bot)' }
            });
            html = await res.text();
            if (!res.ok) throw new Error(`Status ${res.status}`);
        } catch (e) {
            return NextResponse.json({ error: "Failed to fetch URL. Ensure it is public." }, { status: 400 });
        }

        const $ = cheerio.load(html);

        // Cleanup script/style tags
        $('script').remove();
        $('style').remove();
        $('nav').remove();
        $('footer').remove();

        const title = $('title').text().trim() || url;
        const cleanText = $('body').text().replace(/\s+/g, ' ').trim();

        if (cleanText.length < 50) {
            return NextResponse.json({ error: "Not enough text found on page." }, { status: 400 });
        }

        // 2. Chunking (Simple ~1000 chars)
        const chunkSize = 1000;
        const chunks = [];
        for (let i = 0; i < cleanText.length; i += chunkSize) {
            chunks.push(cleanText.substring(i, i + chunkSize));
        }

        // Limit to 10 chunks to avoid timeout/spamming DB in this V1
        const limitedChunks = chunks.slice(0, 10);
        let inserted = 0;

        for (const chunk of limitedChunks) {
            // 3. Embed & Save
            const embedding = await getEmbedding(chunk);
            const embeddingString = `[${embedding.join(',')}]`;

            await db.sql`
                INSERT INTO documents (content, metadata, embedding)
                VALUES (${chunk}, ${JSON.stringify({
                source: url,
                title: title,
                type: 'url_scrape',
                scraped_at: new Date().toISOString()
            })}, ${embeddingString}::vector)
            `;
            inserted++;
        }

        return NextResponse.json({ success: true, chunks: inserted, title });

    } catch (e: any) {
        console.error("Auto-Learner Error:", e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
