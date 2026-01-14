import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { db } from '@/lib/db';

export async function GET(req: Request) {
    try {
        const session = await getServerSession();
        if (!session?.user?.email) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // Get user's admin phone
        const { rows: orgRows } = await db.sql`
            SELECT w.phone_number as admin_phone
            FROM organizations o
            LEFT JOIN whitelist w ON w.org_id = o.id AND w.role = 'admin'
            WHERE o.owner_email = ${session.user.email}
            ORDER BY o.created_at DESC
            LIMIT 1
        `;

        if (orgRows.length === 0 || !orgRows[0].admin_phone) {
            return NextResponse.json({ error: "Admin phone not configured" }, { status: 400 });
        }

        const adminPhone = orgRows[0].admin_phone;

        // Get or create preferences
        const { rows: preferences } = await db.sql`
            SELECT *
            FROM task_preferences
            WHERE user_phone = ${adminPhone}
        `;

        if (preferences.length === 0) {
            // Create default preferences
            const { rows: newPrefs } = await db.sql`
                INSERT INTO task_preferences (
                    user_phone, daily_prompt_time, timezone, notification_style
                ) VALUES (
                    ${adminPhone}, '07:30:00', 'America/New_York', 'supportive'
                )
                RETURNING *
            `;
            return NextResponse.json({ preferences: newPrefs[0] });
        }

        return NextResponse.json({ preferences: preferences[0] });

    } catch (error: any) {
        console.error("Error fetching task preferences:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const session = await getServerSession();
        if (!session?.user?.email) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const updates = await req.json();

        // Get user's admin phone
        const { rows: orgRows } = await db.sql`
            SELECT w.phone_number as admin_phone
            FROM organizations o
            LEFT JOIN whitelist w ON w.org_id = o.id AND w.role = 'admin'
            WHERE o.owner_email = ${session.user.email}
            ORDER BY o.created_at DESC
            LIMIT 1
        `;

        if (orgRows.length === 0 || !orgRows[0].admin_phone) {
            return NextResponse.json({ error: "Admin phone not configured" }, { status: 400 });
        }

        const adminPhone = orgRows[0].admin_phone;

        // Build update query dynamically
        const updateFields = [];
        const values = [];

        if (updates.daily_prompt_time !== undefined) {
            updateFields.push('daily_prompt_time = $' + (values.length + 1));
            values.push(updates.daily_prompt_time);
        }
        if (updates.timezone !== undefined) {
            updateFields.push('timezone = $' + (values.length + 1));
            values.push(updates.timezone);
        }
        if (updates.checkin_frequency !== undefined) {
            updateFields.push('checkin_frequency = $' + (values.length + 1));
            values.push(updates.checkin_frequency);
        }
        if (updates.max_daily_checkins !== undefined) {
            updateFields.push('max_daily_checkins = $' + (values.length + 1));
            values.push(updates.max_daily_checkins);
        }
        if (updates.weekend_mode !== undefined) {
            updateFields.push('weekend_mode = $' + (values.length + 1));
            values.push(updates.weekend_mode);
        }
        if (updates.notification_style !== undefined) {
            updateFields.push('notification_style = $' + (values.length + 1));
            values.push(updates.notification_style);
        }

        if (updateFields.length === 0) {
            return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
        }

        updateFields.push('updated_at = CURRENT_TIMESTAMP');

        // Update preferences
        await db.sql`
            UPDATE task_preferences
            SET ${updateFields.join(', ')}
            WHERE user_phone = ${adminPhone}
        `;

        return NextResponse.json({
            success: true,
            message: "Preferences updated"
        });

    } catch (error: any) {
        console.error("Error updating task preferences:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}