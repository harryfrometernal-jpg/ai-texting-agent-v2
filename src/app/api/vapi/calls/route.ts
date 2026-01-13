import { NextResponse } from 'next/server';
import { VapiService } from '@/lib/services/vapi';

export async function GET() {
    // This runs on server, so can access VAPI_PRIVATE_KEY
    const calls = await VapiService.getCalls();
    return NextResponse.json(calls);
}
