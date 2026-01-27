import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { db } from '@/lib/db';
import { TaskManager } from '@/lib/agents/task_manager';

export async function GET(req: Request) {
    try {
        const session = await getServerSession();
        if (!session?.user?.email) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // Get user's phone number from admin config (for now, hardcoded)
        const userPhone = '+18569936360';

        // Get today's tasks
        const tasks = await TaskManager.getTodaysTasks(userPhone);

        // Get task preferences
        const { rows: prefRows } = await db.sql`
            SELECT * FROM task_preferences WHERE user_phone = ${userPhone}
        `;

        // Get recent check-ins
        const { rows: checkIns } = await db.sql`
            SELECT * FROM task_checkins
            WHERE user_phone = ${userPhone}
            AND task_date >= CURRENT_DATE - INTERVAL '7 days'
            ORDER BY checkin_time DESC
            LIMIT 10
        `;

        return NextResponse.json({
            tasks,
            total: tasks.length,
            preferences: prefRows[0] || null,
            recentCheckIns: checkIns,
            stats: {
                completed: tasks.filter(t => t.status === 'completed').length,
                pending: tasks.filter(t => t.status === 'pending').length,
                inProgress: tasks.filter(t => t.status === 'in_progress').length
            }
        });

    } catch (error) {
        console.error('Tasks API error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const session = await getServerSession();
        if (!session?.user?.email) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await req.json();
        const userPhone = '+18569936360';

        if (body.action === 'create_task') {
            // Create a new task
            const { description, priority = 'medium', estimated_time = 30 } = body;
            const today = new Date().toISOString().split('T')[0];

            const { rows } = await db.sql`
                INSERT INTO daily_tasks (
                    user_phone, task_date, task_description, priority, estimated_time
                ) VALUES (
                    ${userPhone}, ${today}, ${description}, ${priority}, ${estimated_time}
                )
                RETURNING *
            `;

            return NextResponse.json({
                success: true,
                message: "Task created successfully",
                task: rows[0]
            });

        } else if (body.action === 'update_task') {
            // Update task status
            const { taskId, status } = body;
            const success = await TaskManager.updateTaskStatus(userPhone, taskId, status);

            return NextResponse.json({
                success,
                message: success ? "Task updated successfully" : "Failed to update task"
            });

        } else if (body.action === 'send_test_prompt') {
            // Send a test daily prompt
            const message = await TaskManager.sendDailyPrompt(userPhone);

            return NextResponse.json({
                success: true,
                message: "Test prompt generated",
                prompt: message
            });
        }

        return NextResponse.json({
            success: false,
            message: "Invalid action"
        }, { status: 400 });

    } catch (error) {
        console.error('Task operation error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}