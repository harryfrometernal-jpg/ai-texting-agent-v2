import { sql } from '@vercel/postgres';

export const db = sql;

// Helper / Types
export type Organization = {
    id: string;
    name: string;
    owner_email: string;
    api_key: string;
    logo_url?: string;
    brand_color?: string;
    ghl_webhook_url?: string;
    created_at: Date;
}

export type WhitelistedNumber = {
    id: string;
    phone_number: string;
    name?: string;
    org_id: string;
    ai_status: 'active' | 'paused';
    created_at: Date;
}

export type ConversationLog = {
    id: string;
    org_id: string;
    contact_phone: string;
    direction: 'inbound' | 'outbound';
    channel: 'sms' | 'email' | 'voice';
    content: string;
    agent_used?: string;
    sentiment?: string;
    created_at: Date;
}
