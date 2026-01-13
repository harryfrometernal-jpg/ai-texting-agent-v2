
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

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

        const { rows: campaigns } = await db.sql`
            SELECT * FROM campaigns 
            WHERE org_id = ${org_id}
            ORDER BY created_at DESC
        `;

        return NextResponse.json(campaigns);
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
