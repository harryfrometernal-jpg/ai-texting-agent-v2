import { db } from "@/lib/db";
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export interface GoalContext {
  contact_phone: string;
  contact_name: string;
  goal_description: string;
  goal_type?: string;
}

export interface GoalProgress {
  isOnTrack: boolean;
  isCompleted: boolean;
  progressNotes: string;
  shouldAlert: boolean;
  alertReason?: string;
  completionSummary?: string;
}

export class GoalTracker {
  // Create a new conversation goal
  static async createGoal(context: GoalContext): Promise<string> {
    try {
      const { rows } = await db.sql`
        INSERT INTO conversation_goals (
          contact_phone, contact_name, goal_description, goal_type
        ) VALUES (
          ${context.contact_phone},
          ${context.contact_name},
          ${context.goal_description},
          ${context.goal_type || 'custom'}
        )
        RETURNING id
      `;

      // Create admin notification
      await db.sql`
        INSERT INTO admin_notifications (type, contact_phone, contact_name, message, priority)
        VALUES (
          'goal_completion',
          ${context.contact_phone},
          ${context.contact_name},
          'New goal created: ${context.goal_description}',
          'normal'
        )
      `;

      return rows[0].id;
    } catch (error) {
      console.error("Error creating goal:", error);
      throw error;
    }
  }

  // Check if contact has an active goal
  static async getActiveGoal(contactPhone: string): Promise<any> {
    try {
      const { rows } = await db.sql`
        SELECT * FROM conversation_goals
        WHERE contact_phone = ${contactPhone}
        AND status = 'active'
        ORDER BY created_at DESC
        LIMIT 1
      `;

      return rows[0] || null;
    } catch (error) {
      console.error("Error getting active goal:", error);
      return null;
    }
  }

  // Analyze conversation progress against goal
  static async analyzeProgress(
    contactPhone: string,
    userMessage: string,
    aiResponse: string
  ): Promise<GoalProgress> {
    const activeGoal = await this.getActiveGoal(contactPhone);

    if (!activeGoal) {
      return {
        isOnTrack: true,
        isCompleted: false,
        progressNotes: "No active goal",
        shouldAlert: false
      };
    }

    // Get recent conversation history
    const { rows: history } = await db.sql`
      SELECT content, direction, created_at
      FROM conversation_logs
      WHERE contact_phone = ${contactPhone}
      ORDER BY created_at DESC
      LIMIT 10
    `;

    const conversationHistory = history
      .map(log => `${log.direction === 'inbound' ? 'User' : 'AI'}: ${log.content}`)
      .reverse()
      .join('\n');

    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

    const prompt = `
      You are analyzing a conversation to track progress toward a specific goal.

      GOAL: ${activeGoal.goal_description}
      GOAL TYPE: ${activeGoal.goal_type}
      CONTACT: ${activeGoal.contact_name}

      CONVERSATION HISTORY:
      ${conversationHistory}

      LATEST USER MESSAGE: ${userMessage}
      LATEST AI RESPONSE: ${aiResponse}

      Analyze this conversation and determine:
      1. Is the conversation staying on track toward the goal?
      2. Has the goal been completed?
      3. Is the user going off-topic or being unresponsive?
      4. Should an admin be alerted?

      For Eternal Consulting goals, consider completed if:
      - User expresses interest in booking a call
      - User asks for pricing or more information
      - User provides contact details for follow-up
      - Clear positive engagement with the service offering

      Respond ONLY in JSON format:
      {
        "isOnTrack": boolean,
        "isCompleted": boolean,
        "progressNotes": "brief analysis of progress",
        "shouldAlert": boolean,
        "alertReason": "why admin should be alerted (if shouldAlert is true)",
        "completionSummary": "summary if goal is completed"
      }
    `;

    try {
      const result = await model.generateContent(prompt);
      const response = result.response.text();
      const cleanText = response.replace(/```json/g, '').replace(/```/g, '').trim();
      const analysis = JSON.parse(cleanText);

      // Update goal in database
      await db.sql`
        UPDATE conversation_goals
        SET
          progress_notes = ${analysis.progressNotes},
          last_activity_at = NOW(),
          status = ${analysis.isCompleted ? 'completed' : 'active'},
          completed_at = ${analysis.isCompleted ? 'NOW()' : null},
          completion_summary = ${analysis.completionSummary || null}
        WHERE contact_phone = ${contactPhone} AND status = 'active'
      `;

      // Create admin notification if needed
      if (analysis.shouldAlert || analysis.isCompleted) {
        const notificationType = analysis.isCompleted ? 'goal_completion' : 'goal_drift';
        const message = analysis.isCompleted
          ? `Goal completed: ${analysis.completionSummary}`
          : `Goal drift detected: ${analysis.alertReason}`;

        await db.sql`
          INSERT INTO admin_notifications (
            type, contact_phone, contact_name, message, priority
          ) VALUES (
            ${notificationType},
            ${contactPhone},
            ${activeGoal.contact_name},
            ${message},
            ${analysis.isCompleted ? 'high' : 'normal'}
          )
        `;
      }

      return analysis;
    } catch (error) {
      console.error("Error analyzing goal progress:", error);
      return {
        isOnTrack: true,
        isCompleted: false,
        progressNotes: "Error analyzing progress",
        shouldAlert: false
      };
    }
  }

  // Complete a goal manually
  static async completeGoal(contactPhone: string, summary: string): Promise<void> {
    try {
      await db.sql`
        UPDATE conversation_goals
        SET
          status = 'completed',
          completed_at = NOW(),
          completion_summary = ${summary}
        WHERE contact_phone = ${contactPhone} AND status = 'active'
      `;

      // Send completion notification to admin
      await db.sql`
        INSERT INTO admin_notifications (
          type, contact_phone, message, priority
        ) VALUES (
          'goal_completion',
          ${contactPhone},
          'Goal completed manually: ${summary}',
          'high'
        )
      `;
    } catch (error) {
      console.error("Error completing goal:", error);
      throw error;
    }
  }

  // Abandon a goal (user went off-track or unresponsive)
  static async abandonGoal(contactPhone: string, reason: string): Promise<void> {
    try {
      await db.sql`
        UPDATE conversation_goals
        SET status = 'abandoned'
        WHERE contact_phone = ${contactPhone} AND status = 'active'
      `;

      // Alert admin about abandonment
      await db.sql`
        INSERT INTO admin_notifications (
          type, contact_phone, message, priority
        ) VALUES (
          'conversation_issue',
          ${contactPhone},
          'Goal abandoned: ${reason}',
          'normal'
        )
      `;
    } catch (error) {
      console.error("Error abandoning goal:", error);
      throw error;
    }
  }

  // Get goal completion summary for admin
  static async getGoalSummary(contactPhone: string): Promise<string> {
    try {
      const { rows } = await db.sql`
        SELECT
          goal_description,
          completion_summary,
          created_at,
          completed_at,
          contact_name
        FROM conversation_goals
        WHERE contact_phone = ${contactPhone}
        AND status = 'completed'
        ORDER BY completed_at DESC
        LIMIT 1
      `;

      if (rows.length === 0) return "No completed goals found.";

      const goal = rows[0];
      const duration = new Date(goal.completed_at).getTime() - new Date(goal.created_at).getTime();
      const durationMinutes = Math.round(duration / (1000 * 60));

      return `
🎯 GOAL COMPLETED

Contact: ${goal.contact_name} (${contactPhone})
Goal: ${goal.goal_description}
Completed: ${new Date(goal.completed_at).toLocaleString()}
Duration: ${durationMinutes} minutes

Summary: ${goal.completion_summary}
      `.trim();
    } catch (error) {
      console.error("Error getting goal summary:", error);
      return "Error retrieving goal summary.";
    }
  }
  // Get concise status for AI reporting
  static async getContactGoalStatus(contactPhone: string): Promise<string> {
    const activeGoal = await this.getActiveGoal(contactPhone);
    if (activeGoal) {
      return `✅ ACTIVE Goal: "${activeGoal.goal_description}"\nSince: ${new Date(activeGoal.created_at).toLocaleDateString()}\nLatest Notes: ${activeGoal.progress_notes || 'None'}`;
    }

    // Check last completed
    const { rows } = await db.sql`
        SELECT * FROM conversation_goals WHERE contact_phone = ${contactPhone} AND status = 'completed' ORDER BY completed_at DESC LIMIT 1
    `;
    if (rows.length > 0) {
      return `🏁 Completed Goal: "${rows[0].goal_description}" on ${new Date(rows[0].completed_at).toLocaleDateString()}.\nSummary: ${rows[0].completion_summary}`;
    }

    return "No active or recent goals found for this contact.";
  }
}