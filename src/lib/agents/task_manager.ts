import { GoogleGenerativeAI } from "@google/generative-ai";
import { db } from "@/lib/db";
import { IncomingMessageContext } from "./types";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

export interface TaskPreferences {
  user_phone: string;
  daily_prompt_time: string;
  timezone: string;
  notification_style: 'supportive' | 'direct' | 'motivational';
  weekend_mode: boolean;
  checkin_frequency: number;
  max_daily_checkins: number;
}

export interface DailyTask {
  id: string;
  user_phone: string;
  task_date: string;
  task_description: string;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  estimated_time: number;
  notes?: string;
}

export class TaskManager {
  // Send daily morning prompt
  static async sendDailyPrompt(userPhone: string): Promise<string> {
    try {
      // Get user preferences
      const { rows: prefRows } = await db.sql`
        SELECT * FROM task_preferences WHERE user_phone = ${userPhone}
      `;

      if (prefRows.length === 0) {
        console.log(`No task preferences found for ${userPhone}`);
        return "";
      }

      const prefs = prefRows[0] as TaskPreferences;

      // Check if weekend mode and it's weekend
      const today = new Date();
      const isWeekend = today.getDay() === 0 || today.getDay() === 6;

      if (prefs.weekend_mode && isWeekend) {
        console.log(`Weekend mode enabled for ${userPhone}, skipping prompt`);
        return "";
      }

      // Get recent tasks for context
      const { rows: recentTasks } = await db.sql`
        SELECT * FROM daily_tasks
        WHERE user_phone = ${userPhone}
        AND task_date >= CURRENT_DATE - INTERVAL '3 days'
        ORDER BY task_date DESC, created_at ASC
        LIMIT 10
      `;

      // Generate personalized morning prompt
      const promptStyle = this.getPromptStyle(prefs.notification_style);
      const taskContext = recentTasks.length > 0 ? this.formatTaskContext(recentTasks) : "This is a fresh start!";

      const aiPrompt = `
        You are a motivational accountability coach. Generate a personalized morning prompt for someone starting their day.

        User Style Preference: ${prefs.notification_style}
        Today: ${today.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}

        Recent Task Context:
        ${taskContext}

        Create a ${promptStyle} morning message that:
        1. Acknowledges the new day
        2. References their recent progress (if any)
        3. Asks them what their top 3 priorities are for today
        4. Encourages them to make it a great day

        Keep it under 160 characters if possible, but prioritize being engaging over brevity.
        End with asking them to reply with their daily goals.
      `;

      const result = await model.generateContent(aiPrompt);
      const morningMessage = result.response.text().trim();

      // Log the check-in
      const todayDate = today.toISOString().split('T')[0];

      const { rows: checkinRows } = await db.sql`
        INSERT INTO task_checkins (
          user_phone, task_date, checkin_type, message_sent
        ) VALUES (
          ${userPhone}, ${todayDate}, 'daily_prompt', ${morningMessage}
        )
        RETURNING id, checkin_time
      `;

      // Schedule follow-up call if no response after 2 hours
      const checkinId = checkinRows[0].id;
      await this.scheduleFollowUpCall(userPhone, checkinId, 120); // 120 minutes = 2 hours

      console.log(`Morning prompt sent to ${userPhone}: ${morningMessage.substring(0, 50)}...`);
      return morningMessage;

    } catch (error) {
      console.error("Error sending daily prompt:", error);
      return "Good morning! What are your top 3 priorities for today? Reply with your goals and let's make it a productive day! 💪";
    }
  }

  // Process user's response to daily prompt
  static async processDailyGoals(context: IncomingMessageContext): Promise<string> {
    try {
      const userPhone = context.from;
      const userResponse = context.body;
      const today = new Date().toISOString().split('T')[0];

      // Parse user's goals using AI
      const parsePrompt = `
        Extract daily goals/tasks from this user message: "${userResponse}"

        Convert this into a JSON array of tasks with priorities:
        [
          {
            "description": "clear task description",
            "priority": "high|medium|low",
            "estimated_time": estimated_minutes
          }
        ]

        Return only the JSON array, no other text.
      `;

      const result = await model.generateContent(parsePrompt);
      const tasksText = result.response.text().replace(/```json/g, '').replace(/```/g, '').trim();

      let tasks: any[] = [];
      try {
        tasks = JSON.parse(tasksText);
      } catch (e) {
        // Fallback: create a single task from the full message
        tasks = [{
          description: userResponse.substring(0, 200),
          priority: "medium",
          estimated_time: 30
        }];
      }

      // Save tasks to database
      const createdTasks: DailyTask[] = [];
      for (const task of tasks.slice(0, 5)) { // Limit to 5 tasks
        try {
          const { rows } = await db.sql`
            INSERT INTO daily_tasks (
              user_phone, task_date, task_description, priority, estimated_time
            ) VALUES (
              ${userPhone}, ${today}, ${task.description}, ${task.priority}, ${task.estimated_time}
            )
            ON CONFLICT (user_phone, task_date, task_description) DO NOTHING
            RETURNING *
          `;

          if (rows.length > 0) {
            createdTasks.push(rows[0] as DailyTask);
          }
        } catch (error) {
          console.error("Error creating task:", error);
        }
      }

      // Update check-in with user response
      await db.sql`
        UPDATE task_checkins
        SET user_response = ${userResponse}, tasks_total = ${createdTasks.length}
        WHERE user_phone = ${userPhone}
        AND task_date = ${today}
        AND checkin_type = 'daily_prompt'
        AND user_response IS NULL
      `;

      // Cancel any pending follow-up calls since user responded
      await this.cancelFollowUpCall(userPhone);

      // Generate encouraging response
      const responsePrompt = `
        User has set these goals for today:
        ${createdTasks.map(t => `- ${t.task_description} (${t.priority} priority)`).join('\n')}

        Generate an encouraging, motivational response that:
        1. Acknowledges their goals
        2. Offers a specific tip for staying focused
        3. Reminds them they can text updates throughout the day
        4. Ends with an energizing phrase

        Keep it conversational and under 200 characters.
      `;

      const responseResult = await model.generateContent(responsePrompt);
      return responseResult.response.text().trim();

    } catch (error) {
      console.error("Error processing daily goals:", error);
      return "Great! I've noted your goals for today. Remember to check in throughout the day with your progress. You've got this! 🚀";
    }
  }

  // Send progress check-in
  static async sendProgressCheckIn(userPhone: string): Promise<string> {
    try {
      const today = new Date().toISOString().split('T')[0];

      // Get today's tasks
      const { rows: tasks } = await db.sql`
        SELECT * FROM daily_tasks
        WHERE user_phone = ${userPhone}
        AND task_date = ${today}
        ORDER BY priority DESC, created_at ASC
      `;

      if (tasks.length === 0) {
        return ""; // No tasks, no check-in needed
      }

      // Get user preferences
      const { rows: prefRows } = await db.sql`
        SELECT * FROM task_preferences WHERE user_phone = ${userPhone}
      `;

      const prefs = prefRows[0] as TaskPreferences;

      // Check if we've already sent max check-ins today
      const { rows: checkinCount } = await db.sql`
        SELECT COUNT(*) as count FROM task_checkins
        WHERE user_phone = ${userPhone}
        AND task_date = ${today}
        AND checkin_type = 'progress_check'
      `;

      if (Number(checkinCount[0].count) >= prefs.max_daily_checkins) {
        return ""; // Max check-ins reached
      }

      const completedTasks = tasks.filter(t => t.status === 'completed');
      const pendingTasks = tasks.filter(t => t.status === 'pending' || t.status === 'in_progress');

      const checkInPrompt = `
        Generate a progress check-in message for someone with these tasks today:

        Completed: ${completedTasks.length}
        Pending: ${pendingTasks.length}

        Pending tasks:
        ${pendingTasks.map(t => `- ${t.task_description}`).join('\n')}

        Style: ${prefs.notification_style}

        Create a brief, encouraging message that:
        1. Acknowledges their progress if any
        2. Asks how they're doing with their remaining tasks
        3. Offers gentle motivation
        4. Asks for a quick update

        Keep it under 160 characters and conversational.
      `;

      const result = await model.generateContent(checkInPrompt);
      const checkInMessage = result.response.text().trim();

      // Log the check-in
      await db.sql`
        INSERT INTO task_checkins (
          user_phone, task_date, checkin_type, message_sent,
          tasks_completed, tasks_total
        ) VALUES (
          ${userPhone}, ${today}, 'progress_check', ${checkInMessage},
          ${completedTasks.length}, ${tasks.length}
        )
      `;

      return checkInMessage;

    } catch (error) {
      console.error("Error sending progress check-in:", error);
      return "";
    }
  }

  // Update task status
  static async updateTaskStatus(userPhone: string, taskId: string, status: string): Promise<boolean> {
    try {
      const { rows } = await db.sql`
        UPDATE daily_tasks
        SET status = ${status},
            completed_at = ${status === 'completed' ? 'NOW()' : null},
            updated_at = NOW()
        WHERE id = ${taskId} AND user_phone = ${userPhone}
        RETURNING id
      `;

      return rows.length > 0;
    } catch (error) {
      console.error("Error updating task status:", error);
      return false;
    }
  }

  // Get today's tasks for a user
  static async getTodaysTasks(userPhone: string): Promise<DailyTask[]> {
    try {
      const today = new Date().toISOString().split('T')[0];
      const { rows } = await db.sql`
        SELECT * FROM daily_tasks
        WHERE user_phone = ${userPhone}
        AND task_date = ${today}
        ORDER BY priority DESC, created_at ASC
      `;

      return rows as DailyTask[];
    } catch (error) {
      console.error("Error getting today's tasks:", error);
      return [];
    }
  }

  // Helper methods
  private static getPromptStyle(style: string): string {
    switch (style) {
      case 'motivational':
        return 'energetic and inspiring';
      case 'direct':
        return 'straightforward and focused';
      case 'supportive':
        return 'gentle and encouraging';
      default:
        return 'friendly and balanced';
    }
  }

  private static formatTaskContext(tasks: any[]): string {
    const completedToday = tasks.filter(t => t.status === 'completed' &&
      t.task_date === new Date().toISOString().split('T')[0]);

    if (completedToday.length > 0) {
      return `Yesterday you completed ${completedToday.length} task(s). Great momentum!`;
    }

    if (tasks.length > 0) {
      return `You have some tasks from recent days. Let's build on that progress!`;
    }

    return "Ready for a fresh start!";
  }

  // Schedule a follow-up call if user doesn't respond to accountability prompts
  static async scheduleFollowUpCall(userPhone: string, checkinId: string, delayMinutes: number): Promise<void> {
    try {
      const callTime = new Date();
      callTime.setMinutes(callTime.getMinutes() + delayMinutes);

      // Store the scheduled call in the database
      await db.sql`
        INSERT INTO scheduled_messages (
          target_phone, scheduled_at, message_body, org_id, status
        )
        SELECT
          ${userPhone},
          ${callTime.toISOString()},
          'ACCOUNTABILITY_FOLLOW_UP_CALL',
          w.org_id,
          'pending'
        FROM whitelist w
        WHERE w.phone_number = ${userPhone}
        LIMIT 1
      `;

      console.log(`Scheduled follow-up call for ${userPhone} in ${delayMinutes} minutes if no response to checkin ${checkinId}`);
    } catch (error) {
      console.error("Error scheduling follow-up call:", error);
    }
  }

  // Cancel follow-up call when user responds
  static async cancelFollowUpCall(userPhone: string): Promise<void> {
    try {
      const today = new Date().toISOString().split('T')[0];

      await db.sql`
        UPDATE scheduled_messages
        SET status = 'cancelled'
        WHERE target_phone = ${userPhone}
        AND message_body = 'ACCOUNTABILITY_FOLLOW_UP_CALL'
        AND scheduled_at >= ${today}
        AND status = 'pending'
      `;

      console.log(`Cancelled follow-up calls for ${userPhone} due to response`);
    } catch (error) {
      console.error("Error cancelling follow-up call:", error);
    }
  }

  // Check for users who need follow-up calls (called by cron job)
  static async processFollowUpCalls(): Promise<string[]> {
    try {
      const { rows: scheduledCalls } = await db.sql`
        SELECT * FROM scheduled_messages
        WHERE message_body = 'ACCOUNTABILITY_FOLLOW_UP_CALL'
        AND status = 'pending'
        AND scheduled_at <= NOW()
      `;

      const callsTriggered: string[] = [];

      for (const call of scheduledCalls) {
        try {
          // Trigger voice call through VAPI
          const { triggerVapiCall } = await import('./vapi');

          // Get default assistant for accountability calls
          const { rows: assistants } = await db.sql`
            SELECT * FROM vapi_assistants
            WHERE name ILIKE '%accountability%' OR name ILIKE '%check%'
            LIMIT 1
          `;

          if (assistants.length > 0) {
            const callResult = await triggerVapiCall(call.target_phone, assistants[0].assistant_id, {
              name: 'User',
              summary: 'Follow-up call for daily accountability check-in. User did not respond to morning text prompt.'
            });

            if (callResult) {
              await db.sql`
                UPDATE scheduled_messages
                SET status = 'sent'
                WHERE id = ${call.id}
              `;

              callsTriggered.push(call.target_phone);
              console.log(`✅ Follow-up call triggered for ${call.target_phone}`);
            } else {
              await db.sql`
                UPDATE scheduled_messages
                SET status = 'failed'
                WHERE id = ${call.id}
              `;
              console.log(`❌ Failed to trigger call for ${call.target_phone}`);
            }
          } else {
            console.log(`No accountability assistant found for follow-up call to ${call.target_phone}`);
            // Mark as failed if no assistant
            await db.sql`
              UPDATE scheduled_messages
              SET status = 'failed_no_assistant'
              WHERE id = ${call.id}
            `;
          }
        } catch (error) {
          console.error(`Error processing follow-up call for ${call.target_phone}:`, error);
          await db.sql`
            UPDATE scheduled_messages
            SET status = 'failed'
            WHERE id = ${call.id}
          `;
        }
      }

      return callsTriggered;
    } catch (error) {
      console.error("Error processing follow-up calls:", error);
      return [];
    }
  }
}