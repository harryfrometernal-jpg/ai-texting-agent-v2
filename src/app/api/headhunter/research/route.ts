
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
    try {
        const { url, myBusinessDesc } = await req.json();

        if (!url) return NextResponse.json({ error: "URL is required" }, { status: 400 });

        const { runResearcherAgent } = await import('@/lib/agents/researcher');
        const opener = await runResearcherAgent(url, { myBusinessDesc });

        return NextResponse.json({ opener });

    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
