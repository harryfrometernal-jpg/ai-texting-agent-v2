import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function POST() {
  try {
    console.log('🚀 Initializing task management system...');

    // Create daily_tasks table
    await db.sql`
      CREATE TABLE IF NOT EXISTS daily_tasks (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        user_phone TEXT NOT NULL,
        task_date DATE NOT NULL,
        task_description TEXT NOT NULL,
        status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),
        priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
        estimated_time INTEGER,
        completed_at TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        notes TEXT,
        UNIQUE(user_phone, task_date, task_description)
      )
    `;

    // Create task_checkins table
    await db.sql`
      CREATE TABLE IF NOT EXISTS task_checkins (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        user_phone TEXT NOT NULL,
        task_date DATE NOT NULL,
        checkin_type TEXT NOT NULL CHECK (checkin_type IN ('daily_prompt', 'progress_check', 'recommendation', 'completion')),
        checkin_time TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        message_sent TEXT,
        user_response TEXT,
        ai_recommendation TEXT,
        tasks_completed INTEGER DEFAULT 0,
        tasks_total INTEGER DEFAULT 0,
        productivity_score INTEGER,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `;

    // Create task_preferences table
    await db.sql`
      CREATE TABLE IF NOT EXISTS task_preferences (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        user_phone TEXT UNIQUE NOT NULL,
        daily_prompt_time TIME DEFAULT '08:00:00',
        timezone TEXT DEFAULT 'America/New_York',
        checkin_frequency INTEGER DEFAULT 4,
        max_daily_checkins INTEGER DEFAULT 3,
        weekend_mode BOOLEAN DEFAULT false,
        notification_style TEXT DEFAULT 'supportive' CHECK (notification_style IN ('supportive', 'direct', 'motivational')),
        auto_scheduling BOOLEAN DEFAULT true,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `;

    console.log('✅ Tables created successfully');

    // Create indexes
    await db.sql`CREATE INDEX IF NOT EXISTS idx_daily_tasks_user_date ON daily_tasks(user_phone, task_date)`;
    await db.sql`CREATE INDEX IF NOT EXISTS idx_daily_tasks_status ON daily_tasks(status)`;
    await db.sql`CREATE INDEX IF NOT EXISTS idx_task_checkins_user_date ON task_checkins(user_phone, task_date)`;
    await db.sql`CREATE INDEX IF NOT EXISTS idx_task_checkins_type ON task_checkins(checkin_type)`;

    console.log('✅ Indexes created successfully');

    // Set up user preferences for 8 AM prompts
    const userPhone = '+18569936360';

    await db.sql`
      INSERT INTO task_preferences (user_phone, daily_prompt_time, timezone, notification_style)
      VALUES (${userPhone}, '08:00:00', 'America/New_York', 'motivational')
      ON CONFLICT (user_phone)
      DO UPDATE SET
        daily_prompt_time = EXCLUDED.daily_prompt_time,
        notification_style = EXCLUDED.notification_style,
        updated_at = CURRENT_TIMESTAMP
    `;

    console.log('✅ User preferences configured for 8:00 AM EST');

    // Verify setup
    const { rows: prefRows } = await db.sql`
      SELECT * FROM task_preferences WHERE user_phone = ${userPhone}
    `;

    const { rows: whitelistRows } = await db.sql`
      SELECT * FROM whitelist WHERE phone_number = ${userPhone}
    `;

    // Test the task manager by generating a sample prompt
    const { TaskManager } = await import('@/lib/agents/task_manager');
    const samplePrompt = await TaskManager.sendDailyPrompt(userPhone);

    console.log('🎉 Task management system setup complete!');

    return NextResponse.json({
      success: true,
      message: 'Task management system initialized successfully!',
      setup_summary: {
        user_phone: userPhone,
        morning_prompt_time: prefRows[0]?.daily_prompt_time || '08:00:00',
        timezone: prefRows[0]?.timezone || 'America/New_York',
        notification_style: prefRows[0]?.notification_style || 'motivational',
        whitelisted: whitelistRows.length > 0,
        tables_created: ['daily_tasks', 'task_checkins', 'task_preferences'],
        sample_prompt: samplePrompt
      },
      next_steps: [
        'Your first morning accountability text will arrive tomorrow at 8:00 AM EST',
        'Reply with your daily goals to start tracking',
        'The system will check in with you throughout the day',
        'View progress in the dashboard at /dashboard/tasks'
      ]
    });

  } catch (error) {
    console.error('❌ Error setting up task system:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    }, { status: 500 });
  }
}