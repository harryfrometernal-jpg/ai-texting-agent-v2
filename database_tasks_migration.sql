-- Daily Task Management System Schema

-- Table for daily task lists
CREATE TABLE IF NOT EXISTS daily_tasks (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_phone TEXT NOT NULL,
    task_date DATE NOT NULL,
    task_description TEXT NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),
    priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
    estimated_time INTEGER, -- in minutes
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    notes TEXT,
    UNIQUE(user_phone, task_date, task_description)
);

-- Table for task check-ins and progress tracking
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
    productivity_score INTEGER, -- 1-10 scale
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Table for user task preferences and settings
CREATE TABLE IF NOT EXISTS task_preferences (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_phone TEXT UNIQUE NOT NULL,
    daily_prompt_time TIME DEFAULT '07:30:00',
    timezone TEXT DEFAULT 'America/New_York',
    checkin_frequency INTEGER DEFAULT 4, -- hours between check-ins
    max_daily_checkins INTEGER DEFAULT 3,
    weekend_mode BOOLEAN DEFAULT false,
    notification_style TEXT DEFAULT 'supportive' CHECK (notification_style IN ('supportive', 'direct', 'motivational')),
    auto_scheduling BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_daily_tasks_user_date ON daily_tasks(user_phone, task_date);
CREATE INDEX IF NOT EXISTS idx_daily_tasks_status ON daily_tasks(status);
CREATE INDEX IF NOT EXISTS idx_task_checkins_user_date ON task_checkins(user_phone, task_date);
CREATE INDEX IF NOT EXISTS idx_task_checkins_type ON task_checkins(checkin_type);

-- Insert default preferences for the admin user
INSERT INTO task_preferences (user_phone, daily_prompt_time, timezone, notification_style)
VALUES ('+18569936360', '07:30:00', 'America/New_York', 'supportive')
ON CONFLICT (user_phone) DO NOTHING;