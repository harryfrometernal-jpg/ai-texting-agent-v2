-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Enable pgvector (Requirements: Supabase project must support this)
create extension if not exists vector;

-- Knowledge Base Documents
create table if not exists public.documents (
  id uuid default uuid_generate_v4() primary key,
  content text, -- The actual text chunk
  metadata jsonb, -- e.g. { "filename": "policy.pdf", "page": 1 }
  embedding vector(768), -- Dimensions for Gemini embedding-001
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Search Function (RPC)
create or replace function match_documents (
  query_embedding vector(768),
  match_threshold float,
  match_count int
)
returns table (
  id uuid,
  content text,
  metadata jsonb,
  similarity float
)
language plpgsql
as $$
begin
  return query
  select
    documents.id,
    documents.content,
    documents.metadata,
    1 - (documents.embedding <=> query_embedding) as similarity
  from documents
  where 1 - (documents.embedding <=> query_embedding) > match_threshold
  order by similarity desc
  limit match_count;
end;
$$;

-- scheduled_tasks: For the "Client Follow-up" or "Weekly Breakdown" logic.
create table if not exists public.scheduled_tasks (
  id uuid default uuid_generate_v4() primary key,
  contact_info jsonb not null, -- Stores { name, phone, email }
  scheduled_for timestamp with time zone not null,
  task_type text not null, -- 'followup', 'weekly_breakdown'
  payload text, -- The message content or instructions
  status text default 'pending', -- pending, completed, failed
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Users table (extends Supabase auth.users or standalone if using custom auth, but standard pattern is usually just relying on auth.users.
-- However, for simple admin whitelist, we can just check emails or store a profile)
-- For this simple app, we might just rely on checking the email in NextAuth against a hardcoded admin email or this table.
create table if not exists public.admin_users (
  id uuid default uuid_generate_v4() primary key,
  email text unique not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Whitelisted Numbers
create table if not exists public.whitelisted_numbers (
  id uuid default uuid_generate_v4() primary key,
  phone_number text unique not null,
  name text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Vapi Assistants Registry
create table if not exists public.vapi_assistants (
  id uuid default uuid_generate_v4() primary key,
  assistant_id text unique not null, -- The ID from Vapi Dashboard
  name text not null,
  description text not null, -- Used by Router AI to decide
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Conversation Logs
create table if not exists public.conversation_logs (
  id uuid default uuid_generate_v4() primary key,
  contact_phone text not null,
  direction text not null check (direction in ('inbound', 'outbound')),
  channel text default 'sms' check (channel in ('sms', 'email', 'voice')), -- Multi-Channel Support
  content text,
  agent_used text, -- e.g., 'calendar', 'general', 'vapi'
  sentiment text, -- 'positive', 'neutral', 'negative', 'frustrated'
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- RLS Policies (Enable for security if using client-side libraries, but we are using server-side)
alter table public.admin_users enable row level security;
alter table public.whitelisted_numbers enable row level security;
alter table public.vapi_assistants enable row level security;
alter table public.conversation_logs enable row level security;

-- Insert the default admin user
insert into public.admin_users (email) values ('harrycastaner@gmail.com') on conflict do nothing;

-- Long-Term Memory
create table if not exists public.contact_memories (
  id uuid default uuid_generate_v4() primary key,
  contact_phone text not null,
  memory_key text not null, -- e.g., 'dog_name', 'job_title'
  memory_value text not null, -- e.g., 'Rover', 'Realtor'
  confidence float default 1.0,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(contact_phone, memory_key) -- Prevent duplicate keys for same contact
);
alter table public.contact_memories enable row level security;

-- Phase 5: Human-in-the-Loop
-- Add status to track if AI should reply or if Human has taken over
alter table public.whitelisted_numbers 
add column if not exists ai_status text default 'active' check (ai_status in ('active', 'paused'));

-- Phase 5: Drip Broadcasts
create table if not exists public.organizations (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  owner_email text not null,
  api_key text default gen_random_uuid(), -- for GHL webhook auth
  logo_url text, -- White Label Logo
  brand_color text default '#10b981', -- White Label Color (Default Emerald)
  created_at timestamptz default now()
);

create table if not exists public.campaigns (
  id uuid default gen_random_uuid() primary key,
  goal text not null,
  status text default 'active', -- active, paused, completed
  total_contacts int default 0,
  created_at timestamptz default now()
);

create table if not exists public.campaign_queue (
  id uuid default gen_random_uuid() primary key,
  campaign_id uuid references public.campaigns(id),
  contact_phone text not null,
  contact_id uuid references public.whitelisted_numbers(id),
  status text default 'pending', -- pending, sent, failed
  ai_message text, -- generated message
  sent_at timestamptz,
  created_at timestamptz default now()
);

-- Phase 10: GoHighLevel Integration
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS ghl_webhook_url TEXT;

-- Goal-Based Conversation System
create table if not exists public.conversation_goals (
  id uuid default uuid_generate_v4() primary key,
  contact_phone text not null,
  contact_name text,
  goal_description text not null,
  goal_type text default 'custom', -- custom, book_call, get_info, schedule_meeting
  status text default 'active' check (status in ('active', 'completed', 'abandoned', 'paused')),
  progress_notes text, -- AI notes on conversation progress
  completion_summary text, -- Summary when goal is completed
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  completed_at timestamp with time zone,
  last_activity_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Contact Management for AI Commands
create table if not exists public.contacts (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  phone_number text unique not null,
  email text,
  notes text,
  tags jsonb default '[]', -- for categorization
  added_by_ai boolean default false,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Admin Notifications & Alerts
create table if not exists public.admin_notifications (
  id uuid default uuid_generate_v4() primary key,
  type text not null check (type in ('goal_completion', 'goal_drift', 'conversation_issue', 'contact_added', 'system_alert')),
  contact_phone text,
  contact_name text,
  message text not null,
  priority text default 'normal' check (priority in ('low', 'normal', 'high', 'urgent')),
  sent_to_admin boolean default false,
  org_id uuid references organizations(id),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  sent_at timestamp with time zone
);

-- Zoom Integration
create table if not exists public.zoom_meetings (
  id uuid default uuid_generate_v4() primary key,
  meeting_id text unique not null,
  join_url text not null,
  start_url text not null,
  topic text not null,
  created_for_contact text, -- phone number
  expires_at timestamp with time zone,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- RLS for new tables
alter table public.conversation_goals enable row level security;
alter table public.contacts enable row level security;
alter table public.admin_notifications enable row level security;
alter table public.zoom_meetings enable row level security;
