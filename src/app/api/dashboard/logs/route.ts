import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const phone = searchParams.get('phone');
    const orgId = searchParams.get('org_id');

    if (!orgId) return NextResponse.json({ error: "Missing org_id" }, { status: 400 });

    try {
        if (phone) {
            const { rows } = await db.sql`
                SELECT * FROM conversation_logs 
                WHERE contact_phone = ${phone} AND org_id = ${orgId}
                ORDER BY created_at ASC
            `;
            return NextResponse.json(rows);
        } else {
            // Fetch all logs for the organization
            const { rows } = await db.sql`
                SELECT * FROM conversation_logs 
                WHERE org_id = ${orgId}
                ORDER BY created_at DESC
                LIMIT 500
            `;
            return NextResponse.json(rows);
        }
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

export async function DELETE(req: Request) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    try {
        // Delete all logs for user's orgs
        // Also handle logs with NULL org_id if they belong to this user via inference? 
        // Safer to just delete linked ones.
        await db.sql`
            DELETE FROM conversation_logs 
            WHERE org_id IN (SELECT id FROM organizations WHERE owner_email = ${session.user.email})
        `;
        return NextResponse.json({ success: true });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

export async function POST(req: Request) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    try {
        const body = await req.json();
        const { contact_phone, direction, content, agent_used, channel, org_id } = body;

        await db.sql`
            INSERT INTO conversation_logs (contact_phone, direction, content, agent_used, channel, org_id)
            VALUES (${contact_phone}, ${direction}, ${content}, ${agent_used}, ${channel}, ${org_id})
        `;

        return NextResponse.json({ success: true });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
