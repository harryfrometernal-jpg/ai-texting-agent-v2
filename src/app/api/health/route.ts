import { NextResponse } from 'next/server';
import { db } from "@/lib/db";
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

export async function GET() {
    const status: any = {
        status: 'ok',
        checks: {},
        timestamp: new Date().toISOString()
    };

    // 1. Check Database
    try {
        const start = Date.now();
        await db.sql`SELECT 1`;
        status.checks.database = { status: 'ok', latency: `${Date.now() - start}ms` };
    } catch (e: any) {
        status.status = 'degraded';
        status.checks.database = { status: 'error', error: e.message };
    }

    // 2. Check Gemini AI
    try {
        const start = Date.now();
        await model.generateContent("ping");
        status.checks.ai_engine = { status: 'ok', latency: `${Date.now() - start}ms` };
    } catch (e: any) {
        status.status = 'degraded';
        status.checks.ai_engine = { status: 'error', error: e.message };
    }

    // 3. Check Vapi Config
    if (process.env.VAPI_PRIVATE_KEY) {
        status.checks.voice_agent = { status: 'configured' };
    } else {
        status.checks.voice_agent = { status: 'missing_config' };
    }

    // 4. Check Google Creds
    if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
        status.checks.google_services = { status: 'configured' };
    } else {
        status.checks.google_services = { status: 'missing_config' };
    }

    // 5. Check Maps Key
    if (process.env.GOOGLE_MAPS_API_KEY) {
        status.checks.maps_api = { status: 'configured' };
    } else {
        status.checks.maps_api = { status: 'missing_key' };
    }

    return NextResponse.json(status, { status: status.status === 'ok' ? 200 : 503 });
}
