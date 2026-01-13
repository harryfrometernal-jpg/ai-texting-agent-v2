
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { normalizePhoneNumber } from '@/lib/utils';

export async function POST(req: Request) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    try {
        const body = await req.json();
        const { phone, name, role, org_id } = body;

        console.log("Admin whitelist POST:", {
            phone,
            name,
            role,
            org_id,
            email: session.user.email
        });

        if (!phone || !org_id) return NextResponse.json({ error: "Missing phone or org_id" }, { status: 400 });

        const normalizedPhone = normalizePhoneNumber(phone);

        // Verify ownership
        const orgCheck = await db.sql`SELECT id FROM organizations WHERE id = ${org_id} AND owner_email = ${session.user.email}`;
        console.log("Organization check:", { org_id, email: session.user.email, found: orgCheck.rows.length });

        if (orgCheck.rows.length === 0) return NextResponse.json({ error: "Organization not found or access denied" }, { status: 403 });

        await db.sql`
            INSERT INTO whitelist (phone_number, name, org_id, role, ai_status)
            VALUES (${normalizedPhone}, ${name || 'Admin'}, ${org_id}, ${role || 'member'}, 'active')
            ON CONFLICT (phone_number) DO UPDATE SET name = EXCLUDED.name, role = EXCLUDED.role
        `;

        console.log("User added to whitelist successfully:", normalizedPhone);
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
        await db.sql`
            DELETE FROM whitelist 
            WHERE id = ${id} 
            AND org_id IN (SELECT id FROM organizations WHERE owner_email = ${session.user.email})
        `;

        return NextResponse.json({ success: true });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
