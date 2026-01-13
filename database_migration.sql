-- AI Texting Agent - New Features Database Migration
-- Run this in your Supabase SQL editor to add all new features

-- 1. Goal-Based Conversation System
CREATE TABLE IF NOT EXISTS public.conversation_goals (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    contact_phone TEXT NOT NULL,
    contact_name TEXT,
    goal_description TEXT NOT NULL,
    goal_type TEXT DEFAULT 'custom' CHECK (goal_type IN ('custom', 'book_call', 'get_info', 'schedule_meeting')),
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'abandoned', 'paused')),
    progress_notes TEXT,
    completion_summary TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    completed_at TIMESTAMP WITH TIME ZONE,
    last_activity_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Contact Management for AI Commands
CREATE TABLE IF NOT EXISTS public.contacts (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name TEXT NOT NULL,
    phone_number TEXT UNIQUE NOT NULL,
    email TEXT,
    notes TEXT,
    tags JSONB DEFAULT '[]',
    added_by_ai BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Admin Notifications & Alerts
CREATE TABLE IF NOT EXISTS public.admin_notifications (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    type TEXT NOT NULL CHECK (type IN ('goal_completion', 'goal_drift', 'conversation_issue', 'contact_added', 'system_alert')),
    contact_phone TEXT,
    contact_name TEXT,
    message TEXT NOT NULL,
    priority TEXT DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
    sent_to_admin BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    sent_at TIMESTAMP WITH TIME ZONE
);

-- 4. Zoom Integration
CREATE TABLE IF NOT EXISTS public.zoom_meetings (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    meeting_id TEXT UNIQUE NOT NULL,
    join_url TEXT NOT NULL,
    start_url TEXT NOT NULL,
    topic TEXT NOT NULL,
    created_for_contact TEXT,
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. Enable RLS for new tables
ALTER TABLE public.conversation_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.zoom_meetings ENABLE ROW LEVEL SECURITY;

-- 6. Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_conversation_goals_contact_phone ON conversation_goals(contact_phone);
CREATE INDEX IF NOT EXISTS idx_conversation_goals_status ON conversation_goals(status);
CREATE INDEX IF NOT EXISTS idx_contacts_phone_number ON contacts(phone_number);
CREATE INDEX IF NOT EXISTS idx_admin_notifications_sent ON admin_notifications(sent_to_admin);
CREATE INDEX IF NOT EXISTS idx_admin_notifications_priority ON admin_notifications(priority);
CREATE INDEX IF NOT EXISTS idx_zoom_meetings_expires ON zoom_meetings(expires_at);

-- 7. Add some sample data to test with (optional)
-- You can uncomment these if you want to test immediately

-- INSERT INTO contacts (name, phone_number, email, added_by_ai) VALUES
-- ('Test Contact', '+15551234567', 'test@example.com', true)
-- ON CONFLICT (phone_number) DO NOTHING;

-- INSERT INTO whitelisted_numbers (phone_number, name, ai_status) VALUES
-- ('+15551234567', 'Test Contact', 'active')
-- ON CONFLICT (phone_number) DO NOTHING;

-- Success message (this will show as a comment in the SQL editor)
-- Migration completed! Your AI texting agent now supports:
-- ✅ Goal-based conversations
-- ✅ Contact management via AI commands
-- ✅ Zoom meeting integration
-- ✅ Enhanced admin notifications