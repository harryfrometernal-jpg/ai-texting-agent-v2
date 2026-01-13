import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { normalizePhoneNumber } from '@/lib/utils';

export async function GET(req: Request) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const org_id = searchParams.get('org_id');

    if (!org_id) return NextResponse.json({ error: "Missing org_id" }, { status: 400 });

    try {
        // Verify ownership
        const orgCheck = await db.sql`SELECT id FROM organizations WHERE id = ${org_id} AND owner_email = ${session.user.email}`;
        if (orgCheck.rows.length === 0) return NextResponse.json({ error: "Organization not found or access denied" }, { status: 403 });

        const { rows: contacts } = await db.sql`
            SELECT c.*, g.goal_description as active_goal_description, g.goal_type as active_goal_type 
            FROM contacts c
            LEFT JOIN LATERAL (
                SELECT goal_description, goal_type 
                FROM conversation_goals 
                WHERE contact_phone = c.phone_number AND status = 'active'
                ORDER BY created_at DESC 
                LIMIT 1
            ) g ON true
            WHERE c.org_id = ${org_id}
            ORDER BY c.created_at DESC
        `;

        return NextResponse.json(contacts);
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}


export async function POST(req: Request) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    try {
        const body = await req.json();
        const { phone, org_id } = body;

        if (!phone || !org_id) return NextResponse.json({ error: "Missing phone or org_id" }, { status: 400 });

        const normalizedPhone = normalizePhoneNumber(phone);

        // Verify ownership
        const orgCheck = await db.sql`SELECT id FROM organizations WHERE id = ${org_id} AND owner_email = ${session.user.email}`;
        if (orgCheck.rows.length === 0) return NextResponse.json({ error: "Organization not found or access denied" }, { status: 403 });

        await db.sql`
            INSERT INTO contacts (phone_number, org_id, ai_status)
            VALUES (${normalizedPhone}, ${org_id}, 'active')
            ON CONFLICT (phone_number) DO NOTHING
        `;

        return NextResponse.json({ success: true });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

export async function DELETE(req: Request) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: "Missing ID" }, { status: 400 });

    try {
        // Verify ownership through join
        // Delete only if it links to an org owned by user
        await db.sql`
            DELETE FROM contacts 
            WHERE id = ${id} 
            AND org_id IN (SELECT id FROM organizations WHERE owner_email = ${session.user.email})
        `;

        return NextResponse.json({ success: true });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
