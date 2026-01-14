import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const action = searchParams.get('action');
    const contactPhone = searchParams.get('contact_phone');

    switch (action) {
      case 'active':
        const { rows: active } = await db.sql`
          SELECT * FROM conversation_goals
          WHERE status = 'active'
          ORDER BY last_activity_at DESC
        `;
        return NextResponse.json(active);

      case 'completed':
        const { rows: completed } = await db.sql`
          SELECT * FROM conversation_goals
          WHERE status = 'completed'
          ORDER BY completed_at DESC
          LIMIT 50
        `;
        return NextResponse.json(completed);

      case 'contact_goal':
        if (!contactPhone) {
          return NextResponse.json({ error: 'Missing contact_phone' }, { status: 400 });
        }
        const { GoalTracker } = await import('@/lib/agents/goal_tracker');
        const goal = await GoalTracker.getActiveGoal(contactPhone);
        return NextResponse.json(goal);

      case 'summary':
        if (!contactPhone) {
          return NextResponse.json({ error: 'Missing contact_phone' }, { status: 400 });
        }
        const { GoalTracker: GoalTrackerSummary } = await import('@/lib/agents/goal_tracker');
        const summary = await GoalTrackerSummary.getGoalSummary(contactPhone);
        return NextResponse.json({ summary });

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error: any) {
    console.error('Goals API Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { action, contactPhone, contactName, goalDescription, goalType, summary, reason } = body;

    switch (action) {
      case 'create':
        if (!contactPhone || !contactName || !goalDescription) {
          return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        const { GoalTracker: GoalTracker2 } = await import('@/lib/agents/goal_tracker');
        const goalId = await GoalTracker2.createGoal({
          contact_phone: contactPhone,
          contact_name: contactName,
          goal_description: goalDescription,
          goal_type: goalType
        });

        return NextResponse.json({ goalId, success: true });

      case 'complete':
        if (!contactPhone || !summary) {
          return NextResponse.json({ error: 'Missing contactPhone or summary' }, { status: 400 });
        }

        const { GoalTracker: GoalTracker3 } = await import('@/lib/agents/goal_tracker');
        await GoalTracker3.completeGoal(contactPhone, summary);
        return NextResponse.json({ success: true });

      case 'abandon':
        if (!contactPhone || !reason) {
          return NextResponse.json({ error: 'Missing contactPhone or reason' }, { status: 400 });
        }

        const { GoalTracker: GoalTracker4 } = await import('@/lib/agents/goal_tracker');
        await GoalTracker4.abandonGoal(contactPhone, reason);
        return NextResponse.json({ success: true });

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error: any) {
    console.error('Goals API Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}