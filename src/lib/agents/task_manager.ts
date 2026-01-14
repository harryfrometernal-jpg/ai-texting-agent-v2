import { db } from "@/lib/db";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { normalizePhoneNumber } from "@/lib/utils";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export interface TaskCommand {
  action: 'add_task' | 'complete_task' | 'list_tasks' | 'update_task' | 'delete_task' | 'set_tasks' | null;
  taskDescription?: string;
  taskId?: string;
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  estimatedTime?: number;
  tasks?: string[];
}

export class TaskManager {
  // Parse task management commands
  static async parseCommand(userPhone: string, message: string): Promise<TaskCommand | null> {
    const normalizedPhone = normalizePhoneNumber(userPhone);

    // Check if this is a task completion command (e.g., "call john done", "meeting done")
    const donePattern = /(.+?)\s+done$/i;
    const doneMatch = message.match(donePattern);

    if (doneMatch) {
      const taskDescription = doneMatch[1].trim();
      return {
        action: 'complete_task',
        taskDescription: taskDescription
      };
    }

    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

    const prompt = `
      You are analyzing a message for daily task management commands.

      User Message: "${message}"

      Determine if this is a task management command and extract the relevant information.

      Possible command types:
      1. "add_task" - Adding a single task (e.g., "add task call john", "remind me to send email")
      2. "complete_task" - Marking a task as done (e.g., "call john done", "meeting done")
      3. "list_tasks" - Viewing current tasks (e.g., "show my tasks", "what do I need to do today")
      4. "set_tasks" - Setting multiple tasks for the day (e.g., "My tasks today are: call john, send email, review report")
      5. "update_task" - Modifying an existing task
      6. "delete_task" - Removing a task

      For task descriptions, extract clear, actionable items. Convert vague descriptions into specific tasks.

      Examples:
      - "I need to call john" → add_task: "Call John"
      - "My tasks today: call john, send email, meeting at 3" → set_tasks: ["Call John", "Send email", "Meeting at 3pm"]
      - "show tasks" → list_tasks
      - "meeting done" → complete_task: "meeting"

      Respond ONLY in JSON format:
      {
        "action": "add_task" | "complete_task" | "list_tasks" | "set_tasks" | "update_task" | "delete_task" | null,
        "taskDescription": "single task description",
        "tasks": ["array", "of", "task", "descriptions"],
        "priority": "low" | "medium" | "high" | "urgent",
        "estimatedTime": number_in_minutes
      }

      If this is not a task management command, return {"action": null}
    `;

    try {
      const result = await model.generateContent(prompt);
      const response = result.response.text();
      const cleanText = response.replace(/```json/g, '').replace(/```/g, '').trim();
      const command = JSON.parse(cleanText);

      return command.action ? command : null;
    } catch (error) {
      console.error("Error parsing task command:", error);
      return null;
    }
  }

  // Add a single task
  static async addTask(userPhone: string, taskDescription: string, priority: string = 'medium', estimatedTime?: number): Promise<string> {
    const normalizedPhone = normalizePhoneNumber(userPhone);
    const today = new Date().toISOString().split('T')[0];

    try {
      await db.sql`
        INSERT INTO daily_tasks (user_phone, task_date, task_description, priority, estimated_time)
        VALUES (${normalizedPhone}, ${today}, ${taskDescription}, ${priority}, ${estimatedTime || null})
        ON CONFLICT (user_phone, task_date, task_description)
        DO UPDATE SET priority = ${priority}, estimated_time = ${estimatedTime || null}, updated_at = CURRENT_TIMESTAMP
      `;

      return `✅ Task added: "${taskDescription}"${priority !== 'medium' ? ` (Priority: ${priority})` : ''}`;
    } catch (error) {
      console.error("Error adding task:", error);
      return "❌ Error adding task. Please try again.";
    }
  }

  // Set multiple tasks for the day (replaces existing tasks)
  static async setDailyTasks(userPhone: string, tasks: string[]): Promise<string> {
    const normalizedPhone = normalizePhoneNumber(userPhone);
    const today = new Date().toISOString().split('T')[0];

    try {
      // Clear existing pending tasks for today
      await db.sql`
        UPDATE daily_tasks
        SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP
        WHERE user_phone = ${normalizedPhone}
          AND task_date = ${today}
          AND status = 'pending'
      `;

      // Add new tasks
      for (const task of tasks) {
        if (task.trim()) {
          await db.sql`
            INSERT INTO daily_tasks (user_phone, task_date, task_description, priority)
            VALUES (${normalizedPhone}, ${today}, ${task.trim()}, 'medium')
            ON CONFLICT (user_phone, task_date, task_description)
            DO UPDATE SET status = 'pending', updated_at = CURRENT_TIMESTAMP
          `;
        }
      }

      return `✅ Daily tasks set! Added ${tasks.length} tasks for today:\n${tasks.map((t, i) => `${i + 1}. ${t}`).join('\n')}`;
    } catch (error) {
      console.error("Error setting daily tasks:", error);
      return "❌ Error setting daily tasks. Please try again.";
    }
  }

  // Complete a task
  static async completeTask(userPhone: string, taskDescription: string): Promise<string> {
    const normalizedPhone = normalizePhoneNumber(userPhone);
    const today = new Date().toISOString().split('T')[0];

    try {
      // Find matching task (fuzzy search)
      const { rows: tasks } = await db.sql`
        SELECT id, task_description FROM daily_tasks
        WHERE user_phone = ${normalizedPhone}
          AND task_date = ${today}
          AND status IN ('pending', 'in_progress')
          AND LOWER(task_description) LIKE ${'%' + taskDescription.toLowerCase() + '%'}
        ORDER BY
          CASE WHEN LOWER(task_description) = ${taskDescription.toLowerCase()} THEN 1 ELSE 2 END,
          LENGTH(task_description)
        LIMIT 5
      `;

      if (tasks.length === 0) {
        return `❌ No pending task found matching "${taskDescription}". Use "list tasks" to see your current tasks.`;
      }

      if (tasks.length === 1) {
        // Mark the task as completed
        await db.sql`
          UPDATE daily_tasks
          SET status = 'completed', completed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
          WHERE id = ${tasks[0].id}
        `;

        // Log the completion
        await this.logTaskCheckin(normalizedPhone, 'completion', `Task completed: ${tasks[0].task_description}`);

        return `🎉 Task completed: "${tasks[0].task_description}"`;
      }

      // Multiple matches - ask user to be more specific
      return `🤔 Multiple tasks match "${taskDescription}":\n${tasks.map((t, i) => `${i + 1}. ${t.task_description}`).join('\n')}\n\nPlease be more specific.`;

    } catch (error) {
      console.error("Error completing task:", error);
      return "❌ Error completing task. Please try again.";
    }
  }

  // List current tasks
  static async listTasks(userPhone: string): Promise<string> {
    const normalizedPhone = normalizePhoneNumber(userPhone);
    const today = new Date().toISOString().split('T')[0];

    try {
      const { rows: tasks } = await db.sql`
        SELECT task_description, status, priority, estimated_time, completed_at
        FROM daily_tasks
        WHERE user_phone = ${normalizedPhone}
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
          END
      `;

      if (tasks.length === 0) {
        return "📋 No tasks for today. Text me your tasks to get started!";
      }

      const pending = tasks.filter(t => t.status === 'pending' || t.status === 'in_progress');
      const completed = tasks.filter(t => t.status === 'completed');

      let response = `📋 **Today's Tasks** (${completed.length}/${tasks.length} completed)\n\n`;

      if (pending.length > 0) {
        response += "**Pending:**\n";
        pending.forEach((task, i) => {
          const priorityEmoji = task.priority === 'urgent' ? '🔴' : task.priority === 'high' ? '🟡' : '';
          const timeEst = task.estimated_time ? ` (~${task.estimated_time}min)` : '';
          response += `${i + 1}. ${priorityEmoji} ${task.task_description}${timeEst}\n`;
        });
        response += '\n';
      }

      if (completed.length > 0) {
        response += "**Completed:**\n";
        completed.forEach((task, i) => {
          response += `✅ ${task.task_description}\n`;
        });
      }

      response += `\nTo complete a task, text: "[task name] done"`;

      return response;
    } catch (error) {
      console.error("Error listing tasks:", error);
      return "❌ Error retrieving tasks. Please try again.";
    }
  }

  // Process task management command
  static async processCommand(command: TaskCommand, userPhone: string): Promise<string> {
    try {
      switch (command.action) {
        case 'add_task':
          if (!command.taskDescription) {
            return "Please provide a task description. Example: 'add task call john'";
          }
          return await this.addTask(userPhone, command.taskDescription, command.priority, command.estimatedTime);

        case 'set_tasks':
          if (!command.tasks || command.tasks.length === 0) {
            return "Please provide your tasks for today. Example: 'My tasks: call john, send email, review report'";
          }
          return await this.setDailyTasks(userPhone, command.tasks);

        case 'complete_task':
          if (!command.taskDescription) {
            return "Please specify which task to complete. Example: 'call john done'";
          }
          return await this.completeTask(userPhone, command.taskDescription);

        case 'list_tasks':
          return await this.listTasks(userPhone);

        default:
          return "❌ Unknown task command.";
      }
    } catch (error) {
      console.error("Error processing task command:", error);
      return "❌ Error processing task command.";
    }
  }

  // Log task check-in
  static async logTaskCheckin(userPhone: string, type: string, message: string, userResponse?: string, recommendation?: string): Promise<void> {
    const normalizedPhone = normalizePhoneNumber(userPhone);
    const today = new Date().toISOString().split('T')[0];

    try {
      // Get task stats for today
      const { rows: stats } = await db.sql`
        SELECT
          COUNT(*) as total_tasks,
          COUNT(*) FILTER (WHERE status = 'completed') as completed_tasks
        FROM daily_tasks
        WHERE user_phone = ${normalizedPhone} AND task_date = ${today}
      `;

      const totalTasks = parseInt(stats[0]?.total_tasks) || 0;
      const completedTasks = parseInt(stats[0]?.completed_tasks) || 0;

      await db.sql`
        INSERT INTO task_checkins (
          user_phone, task_date, checkin_type, message_sent, user_response,
          ai_recommendation, tasks_completed, tasks_total
        ) VALUES (
          ${normalizedPhone}, ${today}, ${type}, ${message},
          ${userResponse || null}, ${recommendation || null},
          ${completedTasks}, ${totalTasks}
        )
      `;
    } catch (error) {
      console.error("Error logging task checkin:", error);
    }
  }

  // Send daily task prompt
  static async sendDailyPrompt(userPhone: string): Promise<string> {
    const normalizedPhone = normalizePhoneNumber(userPhone);
    const today = new Date().toISOString().split('T')[0];

    try {
      // Check if prompt already sent today
      const { rows: existing } = await db.sql`
        SELECT id FROM task_checkins
        WHERE user_phone = ${normalizedPhone}
          AND task_date = ${today}
          AND checkin_type = 'daily_prompt'
      `;

      if (existing.length > 0) {
        return "Daily prompt already sent today.";
      }

      const promptMessage = `🌅 Good morning! Ready to tackle a productive day?\n\nPlease tell me what tasks you'd like to accomplish today. You can list them like:\n\n"My tasks today: call john, review proposal, gym workout, team meeting"\n\nI'll help keep you on track throughout the day! 💪`;

      // Log the prompt
      await this.logTaskCheckin(normalizedPhone, 'daily_prompt', promptMessage);

      return promptMessage;
    } catch (error) {
      console.error("Error sending daily prompt:", error);
      return "❌ Error sending daily prompt.";
    }
  }

  // Generate progress check-in
  static async generateProgressCheckin(userPhone: string): Promise<string | null> {
    const normalizedPhone = normalizePhoneNumber(userPhone);
    const today = new Date().toISOString().split('T')[0];

    try {
      // Check recent checkins to avoid spam
      const { rows: recentCheckins } = await db.sql`
        SELECT checkin_time FROM task_checkins
        WHERE user_phone = ${normalizedPhone}
          AND task_date = ${today}
          AND checkin_type IN ('progress_check', 'recommendation')
        ORDER BY checkin_time DESC
        LIMIT 1
      `;

      const lastCheckin = recentCheckins[0]?.checkin_time;
      if (lastCheckin) {
        const hoursSinceLastCheckin = (Date.now() - new Date(lastCheckin).getTime()) / (1000 * 60 * 60);
        if (hoursSinceLastCheckin < 3) {
          return null; // Too soon for another checkin
        }
      }

      // Get task progress
      const { rows: tasks } = await db.sql`
        SELECT task_description, status, priority, created_at
        FROM daily_tasks
        WHERE user_phone = ${normalizedPhone}
          AND task_date = ${today}
        ORDER BY
          CASE priority
            WHEN 'urgent' THEN 1
            WHEN 'high' THEN 2
            WHEN 'medium' THEN 3
            WHEN 'low' THEN 4
          END
      `;

      if (tasks.length === 0) {
        return null; // No tasks to check on
      }

      const completed = tasks.filter(t => t.status === 'completed');
      const pending = tasks.filter(t => t.status === 'pending' || t.status === 'in_progress');

      if (pending.length === 0) {
        const celebrationMessage = `🎉 Amazing work! You've completed all ${completed.length} tasks for today! Time to relax or tackle some bonus goals? 🌟`;
        await this.logTaskCheckin(normalizedPhone, 'progress_check', celebrationMessage);
        return celebrationMessage;
      }

      // Generate contextual check-in
      const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

      const prompt = `
        Generate a supportive, encouraging check-in message for someone working on their daily tasks.

        Progress: ${completed.length}/${tasks.length} tasks completed

        Completed: ${completed.map(t => t.task_description).join(', ') || 'none yet'}

        Still pending: ${pending.map(t => t.task_description).join(', ')}

        Create a brief (2-3 sentences), motivational message that:
        - Acknowledges their progress (if any)
        - Gently encourages them on remaining tasks
        - Is supportive but not pushy
        - Mentions 1-2 specific pending tasks
        - Ends with asking how they're doing or if they need help

        Keep it casual, friendly, and under 200 characters. Use emojis sparingly.
      `;

      const result = await model.generateContent(prompt);
      const checkinMessage = result.response.text().trim();

      await this.logTaskCheckin(normalizedPhone, 'progress_check', checkinMessage);

      return checkinMessage;

    } catch (error) {
      console.error("Error generating progress checkin:", error);
      return null;
    }
  }

  // Check if user should receive a check-in
  static async shouldSendCheckin(userPhone: string): Promise<boolean> {
    const normalizedPhone = normalizePhoneNumber(userPhone);
    const today = new Date().toISOString().split('T')[0];

    try {
      // Get user preferences
      const { rows: prefs } = await db.sql`
        SELECT checkin_frequency, max_daily_checkins, weekend_mode
        FROM task_preferences
        WHERE user_phone = ${normalizedPhone}
      `;

      const preferences = prefs[0] || { checkin_frequency: 4, max_daily_checkins: 3, weekend_mode: false };

      // Check if it's weekend and weekend mode is off
      const dayOfWeek = new Date().getDay();
      if ((dayOfWeek === 0 || dayOfWeek === 6) && !preferences.weekend_mode) {
        return false;
      }

      // Check if max daily checkins reached
      const { rows: todayCheckins } = await db.sql`
        SELECT COUNT(*) as checkin_count
        FROM task_checkins
        WHERE user_phone = ${normalizedPhone}
          AND task_date = ${today}
          AND checkin_type IN ('progress_check', 'recommendation')
      `;

      const checkinCount = parseInt(todayCheckins[0]?.checkin_count) || 0;
      if (checkinCount >= preferences.max_daily_checkins) {
        return false;
      }

      // Check if tasks exist for today
      const { rows: taskCount } = await db.sql`
        SELECT COUNT(*) as task_count
        FROM daily_tasks
        WHERE user_phone = ${normalizedPhone}
          AND task_date = ${today}
          AND status IN ('pending', 'in_progress')
      `;

      return parseInt(taskCount[0]?.task_count) > 0;

    } catch (error) {
      console.error("Error checking if should send checkin:", error);
      return false;
    }
  }
}