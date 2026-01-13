import { db } from "@/lib/db";

export interface AdminNotification {
  id: string;
  type: string;
  contact_phone?: string;
  contact_name?: string;
  message: string;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  sent_to_admin: boolean;
  created_at: string;
}

export class AdminNotificationService {
  private static readonly ADMIN_PHONE = "+18569936360";

  // Send SMS notification to admin using GoHighLevel
  private static async sendSMSToAdmin(message: string, orgId?: string): Promise<boolean> {
    try {
      console.log(`[ADMIN SMS] To: ${this.ADMIN_PHONE}`);
      console.log(`[ADMIN SMS] Message: ${message}`);

      // Use GHL outgoing webhook to send SMS to admin
      const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/webhook/ghl/outgoing`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contact: {
            name: 'Admin',
            phone: this.ADMIN_PHONE,
            email: 'admin@company.com'
          },
          message: message,
          org_id: orgId
        })
      });

      if (response.ok) {
        console.log(`[ADMIN SMS] Successfully sent to ${this.ADMIN_PHONE} via GHL`);
        return true;
      } else {
        const errorData = await response.text();
        console.error(`[ADMIN SMS] Failed to send via GHL:`, errorData);
        return false;
      }
    } catch (error) {
      console.error("Error sending SMS to admin via GHL:", error);
      return false;
    }
  }

  // Create and optionally send admin notification
  static async createNotification(
    type: string,
    message: string,
    priority: 'low' | 'normal' | 'high' | 'urgent' = 'normal',
    contactPhone?: string,
    contactName?: string,
    sendImmediately: boolean = true,
    orgId?: string
  ): Promise<string> {
    try {
      // Create notification in database
      const { rows } = await db.sql`
        INSERT INTO admin_notifications (
          type, contact_phone, contact_name, message, priority, sent_to_admin, org_id
        ) VALUES (
          ${type},
          ${contactPhone || null},
          ${contactName || null},
          ${message},
          ${priority},
          ${false},
          ${orgId || null}
        )
        RETURNING id
      `;

      const notificationId = rows[0].id;

      // Send immediately if priority is high/urgent or explicitly requested
      if (sendImmediately && (priority === 'high' || priority === 'urgent')) {
        await this.sendNotification(notificationId);
      }

      return notificationId;
    } catch (error) {
      console.error("Error creating admin notification:", error);
      throw error;
    }
  }

  // Send a specific notification
  static async sendNotification(notificationId: string): Promise<boolean> {
    try {
      // Get notification details
      const { rows } = await db.sql`
        SELECT * FROM admin_notifications
        WHERE id = ${notificationId} AND sent_to_admin = false
      `;

      if (rows.length === 0) {
        console.log("Notification already sent or not found");
        return false;
      }

      const notification = rows[0];

      // Format message for SMS
      let smsMessage = `🤖 AI Agent Alert\n\n`;

      if (notification.contact_name && notification.contact_phone) {
        smsMessage += `👤 ${notification.contact_name} (${notification.contact_phone})\n`;
      } else if (notification.contact_phone) {
        smsMessage += `📱 ${notification.contact_phone}\n`;
      }

      smsMessage += `📝 ${notification.message}\n`;
      smsMessage += `⏰ ${new Date(notification.created_at).toLocaleString()}`;

      // Add priority indicator
      if (notification.priority === 'urgent') {
        smsMessage = `🚨 URGENT - ${smsMessage}`;
      } else if (notification.priority === 'high') {
        smsMessage = `⚠️ HIGH - ${smsMessage}`;
      }

      // Send SMS with org context for GHL webhook
      const sent = await this.sendSMSToAdmin(smsMessage, notification.org_id);

      if (sent) {
        // Mark as sent
        await db.sql`
          UPDATE admin_notifications
          SET sent_to_admin = true, sent_at = NOW()
          WHERE id = ${notificationId}
        `;

        console.log(`Admin notification sent: ${notificationId}`);
        return true;
      }

      return false;
    } catch (error) {
      console.error("Error sending admin notification:", error);
      return false;
    }
  }

  // Send all pending high priority notifications
  static async sendPendingHighPriorityNotifications(): Promise<number> {
    try {
      const { rows } = await db.sql`
        SELECT id FROM admin_notifications
        WHERE sent_to_admin = false
        AND priority IN ('high', 'urgent')
        ORDER BY created_at ASC
      `;

      let sentCount = 0;
      for (const notification of rows) {
        const sent = await this.sendNotification(notification.id);
        if (sent) sentCount++;
      }

      return sentCount;
    } catch (error) {
      console.error("Error sending pending notifications:", error);
      return 0;
    }
  }

  // Get pending notifications summary for admin dashboard
  static async getPendingNotificationsSummary(): Promise<{
    total: number;
    byPriority: Record<string, number>;
    recent: AdminNotification[];
  }> {
    try {
      // Get count by priority
      const { rows: counts } = await db.sql`
        SELECT priority, COUNT(*) as count
        FROM admin_notifications
        WHERE sent_to_admin = false
        GROUP BY priority
      `;

      const byPriority = counts.reduce((acc, row) => {
        acc[row.priority] = parseInt(row.count);
        return acc;
      }, {} as Record<string, number>);

      // Get total count
      const { rows: totalRows } = await db.sql`
        SELECT COUNT(*) as total FROM admin_notifications WHERE sent_to_admin = false
      `;
      const total = parseInt(totalRows[0].total);

      // Get recent notifications
      const { rows: recent } = await db.sql`
        SELECT * FROM admin_notifications
        WHERE sent_to_admin = false
        ORDER BY created_at DESC
        LIMIT 10
      `;

      return {
        total,
        byPriority,
        recent: recent as AdminNotification[]
      };

    } catch (error) {
      console.error("Error getting notifications summary:", error);
      return {
        total: 0,
        byPriority: {},
        recent: []
      };
    }
  }

  // Quick notification helpers
  static async goalCompleted(contactPhone: string, contactName: string, summary: string, orgId?: string): Promise<void> {
    await this.createNotification(
      'goal_completion',
      `🎯 Goal completed! ${summary}`,
      'high',
      contactPhone,
      contactName,
      true,
      orgId
    );
  }

  static async goalDrift(contactPhone: string, contactName: string, reason: string, orgId?: string): Promise<void> {
    await this.createNotification(
      'goal_drift',
      `⚠️ Conversation going off-track: ${reason}`,
      'normal',
      contactPhone,
      contactName,
      true,
      orgId
    );
  }

  static async conversationIssue(contactPhone: string, contactName: string, issue: string): Promise<void> {
    await this.createNotification(
      'conversation_issue',
      `❌ Conversation issue: ${issue}`,
      'high',
      contactPhone,
      contactName
    );
  }

  static async contactAdded(contactPhone: string, contactName: string): Promise<void> {
    await this.createNotification(
      'contact_added',
      `➕ New contact added: ${contactName}`,
      'low',
      contactPhone,
      contactName,
      false // Don't send immediately for low priority
    );
  }

  static async systemAlert(message: string, priority: 'normal' | 'high' | 'urgent' = 'normal'): Promise<void> {
    await this.createNotification(
      'system_alert',
      message,
      priority
    );
  }
}