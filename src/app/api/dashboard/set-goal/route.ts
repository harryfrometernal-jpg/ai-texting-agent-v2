
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

export async function POST(req: Request) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const { contactPhone, goalDescription, goalType } = await req.json();

        if (!contactPhone || !goalDescription) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        // 1. Deactivate old active goals for this contact
        await db.sql`
            UPDATE conversation_goals 
            SET status = 'abandoned' 
            WHERE contact_phone = ${contactPhone} AND status = 'active'
        `;

        // 2. Insert new goal
        await db.sql`
            INSERT INTO conversation_goals (contact_phone, goal_description, goal_type, status)
            VALUES (${contactPhone}, ${goalDescription}, ${goalType || 'custom'}, 'active')
        `;

        // 3. (Optional) Log the action
        await db.sql`
            INSERT INTO conversation_logs (contact_phone, direction, content, agent_used)
            VALUES (${contactPhone}, 'outbound', ${'🚨 Admin set a new goal: ' + goalDescription}, 'admin_ui')
        `;

        return NextResponse.json({ success: true });

    } catch (e: any) {
        console.error("Set Goal Error:", e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
