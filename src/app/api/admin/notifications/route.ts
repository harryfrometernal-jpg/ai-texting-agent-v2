import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const action = searchParams.get('action');

    switch (action) {
      case 'summary':
        const { AdminNotificationService } = await import('@/lib/services/admin_notifications');
        const summary = await AdminNotificationService.getPendingNotificationsSummary();
        return NextResponse.json(summary);

      case 'pending':
        const { rows: pending } = await db.sql`
          SELECT * FROM admin_notifications
          WHERE sent_to_admin = false
          ORDER BY priority DESC, created_at ASC
          LIMIT 50
        `;
        return NextResponse.json(pending);

      case 'recent':
        const { rows: recent } = await db.sql`
          SELECT * FROM admin_notifications
          ORDER BY created_at DESC
          LIMIT 20
        `;
        return NextResponse.json(recent);

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error: any) {
    console.error('Notifications API Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { action, notificationId, type, message, priority, contactPhone, contactName } = body;

    switch (action) {
      case 'send':
        if (!notificationId) {
          return NextResponse.json({ error: 'Missing notificationId' }, { status: 400 });
        }
        const { AdminNotificationService: AdminNotificationService2 } = await import('@/lib/services/admin_notifications');
        const sent = await AdminNotificationService2.sendNotification(notificationId);
        return NextResponse.json({ success: sent });

      case 'send_pending_high':
        const { AdminNotificationService: AdminNotificationService3 } = await import('@/lib/services/admin_notifications');
        const sentCount = await AdminNotificationService3.sendPendingHighPriorityNotifications();
        return NextResponse.json({ sent: sentCount });

      case 'create':
        if (!type || !message) {
          return NextResponse.json({ error: 'Missing type or message' }, { status: 400 });
        }
        const { AdminNotificationService: AdminNotificationService4 } = await import('@/lib/services/admin_notifications');
        const id = await AdminNotificationService4.createNotification(
          type,
          message,
          priority || 'normal',
          contactPhone,
          contactName
        );
        return NextResponse.json({ id, success: true });

      case 'mark_sent':
        if (!notificationId) {
          return NextResponse.json({ error: 'Missing notificationId' }, { status: 400 });
        }
        await db.sql`
          UPDATE admin_notifications
          SET sent_to_admin = true, sent_at = NOW()
          WHERE id = ${notificationId}
        `;
        return NextResponse.json({ success: true });

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error: any) {
    console.error('Notifications API Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}