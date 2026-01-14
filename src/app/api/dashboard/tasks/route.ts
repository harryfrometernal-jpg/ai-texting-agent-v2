import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { db } from '@/lib/db';
import { normalizePhoneNumber } from '@/lib/utils';

export async function GET(req: Request) {
    try {
        const session = await getServerSession();
        if (!session?.user?.email) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // Get user's organization and phone
        const { rows: orgRows } = await db.sql`
            SELECT o.*, w.phone_number as admin_phone
            FROM organizations o
            LEFT JOIN whitelist w ON w.org_id = o.id AND w.role = 'admin'
            WHERE o.owner_email = ${session.user.email}
            ORDER BY o.created_at DESC
            LIMIT 1
        `;

        if (orgRows.length === 0) {
            return NextResponse.json({ error: "No organization found" }, { status: 404 });
        }

        const adminPhone = orgRows[0].admin_phone;
        if (!adminPhone) {
            return NextResponse.json({
                tasks: [],
                message: "Admin phone not configured. Set up your phone number first."
            });
        }

        const today = new Date().toISOString().split('T')[0];

        // Get tasks for today
        const { rows: tasks } = await db.sql`
            SELECT *
            FROM daily_tasks
            WHERE user_phone = ${adminPhone}
              AND task_date = ${today}
            ORDER BY
              CASE status
                WHEN 'pending' THEN 1
                WHEN 'in_progress' THEN 2
                WHEN 'completed' THEN 3
                ELSE 4
              END,
              CASE priority
                WHEN 'urgent' THEN 1
                WHEN 'high' THEN 2
                WHEN 'medium' THEN 3
                WHEN 'low' THEN 4
              END,
              created_at ASC
        `;

        return NextResponse.json({
            tasks,
            admin_phone: adminPhone,
            date: today
        });

    } catch (error: any) {
        console.error("Error fetching tasks:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const session = await getServerSession();
        if (!session?.user?.email) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { task_description, priority = 'medium', estimated_time } = await req.json();

        if (!task_description?.trim()) {
            return NextResponse.json({ error: "Task description required" }, { status: 400 });
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
        const today = new Date().toISOString().split('T')[0];

        // Add task
        const { rows: newTask } = await db.sql`
            INSERT INTO daily_tasks (
                user_phone, task_date, task_description, priority, estimated_time
            ) VALUES (
                ${adminPhone}, ${today}, ${task_description.trim()}, ${priority}, ${estimated_time || null}
            )
            ON CONFLICT (user_phone, task_date, task_description)
            DO UPDATE SET
                priority = ${priority},
                estimated_time = ${estimated_time || null},
                updated_at = CURRENT_TIMESTAMP
            RETURNING *
        `;

        return NextResponse.json({
            success: true,
            task: newTask[0]
        });

    } catch (error: any) {
        console.error("Error adding task:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function PATCH(req: Request) {
    try {
        const session = await getServerSession();
        if (!session?.user?.email) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { task_id, status, notes } = await req.json();

        if (!task_id) {
            return NextResponse.json({ error: "Task ID required" }, { status: 400 });
        }

        // Update task
        const { rows: updatedTask } = await db.sql`
            UPDATE daily_tasks
            SET
                status = ${status},
                notes = ${notes || null},
                completed_at = CASE WHEN ${status} = 'completed' THEN CURRENT_TIMESTAMP ELSE completed_at END,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ${task_id}
            RETURNING *
        `;

        if (updatedTask.length === 0) {
            return NextResponse.json({ error: "Task not found" }, { status: 404 });
        }

        return NextResponse.json({
            success: true,
            task: updatedTask[0]
        });

    } catch (error: any) {
        console.error("Error updating task:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function DELETE(req: Request) {
    try {
        const session = await getServerSession();
        if (!session?.user?.email) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { task_id } = await req.json();

        if (!task_id) {
            return NextResponse.json({ error: "Task ID required" }, { status: 400 });
        }

        // Delete task
        await db.sql`
            DELETE FROM daily_tasks
            WHERE id = ${task_id}
        `;

        return NextResponse.json({
            success: true,
            message: "Task deleted"
        });

    } catch (error: any) {
        console.error("Error deleting task:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}