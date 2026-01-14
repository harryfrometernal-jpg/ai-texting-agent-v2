import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function POST(req: Request) {
    try {
        console.log('🗃️ Setting up task management database tables...');

        // Create daily_tasks table
        await db.sql`
            CREATE TABLE IF NOT EXISTS daily_tasks (
                id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
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
                id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
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
                id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
                user_phone TEXT UNIQUE NOT NULL,
                daily_prompt_time TIME DEFAULT '07:30:00',
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
        await db.sql`CREATE INDEX IF NOT EXISTS idx_daily_tasks_status ON daily_tasks(status)`;
        await db.sql`CREATE INDEX IF NOT EXISTS idx_task_checkins_user_date ON task_checkins(user_phone, task_date)`;
        await db.sql`CREATE INDEX IF NOT EXISTS idx_task_checkins_type ON task_checkins(checkin_type)`;

        // Insert default preferences for the admin user if not exists
        const adminPhone = '+18569936360';
        await db.sql`
            INSERT INTO task_preferences (user_phone, daily_prompt_time, timezone, notification_style)
            VALUES (${adminPhone}, '07:30:00', 'America/New_York', 'supportive')
            ON CONFLICT (user_phone) DO NOTHING
        `;

        console.log('✅ Task management database setup completed');

        return NextResponse.json({
            success: true,
            message: "Task management database tables created successfully",
            tables_created: [
                'daily_tasks',
                'task_checkins',
                'task_preferences'
            ],
            admin_setup: {
                phone: adminPhone,
                default_prompt_time: '07:30:00',
                timezone: 'America/New_York'
            }
        });

    } catch (error: any) {
        console.error("❌ Error setting up task management database:", error);
        return NextResponse.json({
            success: false,
            error: error.message
        }, { status: 500 });
    }
}