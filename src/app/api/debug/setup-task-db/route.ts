import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
  try {
    console.log('🚀 Setting up task management database...');

    // Create tables
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

    // Create indexes
    await db.sql`CREATE INDEX IF NOT EXISTS idx_daily_tasks_user_date ON daily_tasks(user_phone, task_date)`;
    await db.sql`CREATE INDEX IF NOT EXISTS idx_task_checkins_user_date ON task_checkins(user_phone, task_date)`;

    // Set up user preferences
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

    // Check results
    const { rows: prefs } = await db.sql`
      SELECT * FROM task_preferences WHERE user_phone = ${userPhone}
    `;

    return NextResponse.json({
      success: true,
      message: 'Task management system setup complete! Morning accountability texts will start at 8:00 AM EST.',
      preferences: prefs[0] || null,
      tables_created: ['daily_tasks', 'task_checkins', 'task_preferences'],
      cron_schedule: '13:00 UTC daily (8:00 AM EST)'
    });

  } catch (error) {
    console.error('Setup error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}