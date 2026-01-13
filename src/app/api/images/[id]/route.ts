
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const runtime = 'nodejs'; // Use node runtime for stream support if needed, though Pollinations is fast

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const resolvedParams = await params;

        // 1. Fetch metadata from DB
        const { rows } = await db.sql`
      SELECT remote_url, expires_at 
      FROM temporary_images 
      WHERE id = ${resolvedParams.id}
    `;

        if (rows.length === 0) {
            return new NextResponse('Image not found', { status: 404 });
        }

        const { remote_url, expires_at } = rows[0];

        // 2. Check Expiration
        if (new Date() > new Date(expires_at)) {
            return new NextResponse('Link expired. This image is no longer available.', { status: 410 });
        }

        // 3. Proxy Valid Image
        const imageRes = await fetch(remote_url);
        if (!imageRes.ok) {
            return new NextResponse('Failed to fetch remote image', { status: 502 });
        }

        const blob = await imageRes.blob();

        return new NextResponse(blob, {
            headers: {
                'Content-Type': imageRes.headers.get('Content-Type') || 'image/jpeg',
                'Cache-Control': 'public, max-age=3600' // Cache for 1 hour locally
            }
        });

    } catch (error) {
        console.error("Image Proxy Error:", error);
        return new NextResponse('Internal Server Error', { status: 500 });
    }
}
