import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

export async function POST(req: Request) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    try {
        const body = await req.json();
        const { id, name, brand_color, logo_url, ghl_webhook_url } = body;

        // If ID provided, Update
        if (id) {
            const result = await db.sql`
                UPDATE organizations 
                SET brand_color = ${brand_color}, logo_url = ${logo_url}, ghl_webhook_url = ${ghl_webhook_url}, updated_at = NOW()
                WHERE id = ${id} AND owner_email = ${session.user.email}
                RETURNING *
            `;
            if (result.rows.length === 0) return NextResponse.json({ error: "Org not found or denied" }, { status: 403 });
            return NextResponse.json(result.rows[0]);
        }
        // Create New
        else if (name) {
            const result = await db.sql`
                INSERT INTO organizations (name, owner_email, brand_color, logo_url, ghl_webhook_url)
                VALUES (${name}, ${session.user.email}, ${brand_color}, ${logo_url}, ${ghl_webhook_url})
                RETURNING *
            `;
            return NextResponse.json(result.rows[0]);
        }

        return NextResponse.json({ error: "Invalid Request" }, { status: 400 });

    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
