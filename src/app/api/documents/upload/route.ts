import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getEmbedding } from '@/lib/rag/embeddings';

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { content, filename } = body;

        if (!content) {
            return NextResponse.json({ error: "No content provided" }, { status: 400 });
        }

        // 1. Generate Embedding
        const embedding = await getEmbedding(content);

        // 2. Store in Vercel Postgres
        // Format embedding as string representation of vector for SQL
        const embeddingString = `[${embedding.join(',')}]`;

        await db.sql`
            INSERT INTO documents (content, metadata, embedding)
            VALUES (${content}, ${JSON.stringify({ filename: filename || 'uploaded_text' })}, ${embeddingString}::vector)
        `;

        return NextResponse.json({ success: true });

    } catch (error: any) {
        console.error("Upload Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
