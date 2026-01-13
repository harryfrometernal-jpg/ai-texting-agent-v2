import 'dotenv/config';
import { sql } from '@vercel/postgres';

async function main() {
  try {
    console.log('Starting migration...');

    // 1. Organizations
    await sql`
      CREATE TABLE IF NOT EXISTS organizations (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        name TEXT NOT NULL,
        owner_email TEXT NOT NULL,
        api_key TEXT DEFAULT gen_random_uuid(),
        logo_url TEXT,
        brand_color TEXT DEFAULT '#10b981',
        ghl_webhook_url TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `;
    console.log('Created organizations table');

    // 2. Whitelisted Numbers
    await sql`
      CREATE TABLE IF NOT EXISTS whitelisted_numbers (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        phone_number TEXT UNIQUE NOT NULL,
        name TEXT,
        org_id UUID REFERENCES organizations(id),
        ai_status TEXT DEFAULT 'active' CHECK (ai_status IN ('active', 'paused')),
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `;
    console.log('Created whitelisted_numbers table');

    // 3. Conversation Logs
    await sql`
      CREATE TABLE IF NOT EXISTS conversation_logs (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        org_id UUID REFERENCES organizations(id),
        contact_phone TEXT NOT NULL,
        direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
        channel TEXT DEFAULT 'sms' CHECK (channel IN ('sms', 'email', 'voice')),
        content TEXT,
        agent_used TEXT,
        sentiment TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `;
    console.log('Created conversation_logs table');

    // 4. Campaigns
    await sql`
        CREATE TABLE IF NOT EXISTS campaigns (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        org_id UUID REFERENCES organizations(id),
        goal TEXT NOT NULL,
        status TEXT DEFAULT 'active',
        total_contacts INT DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW()
        );
    `;
    console.log('Created campaigns table');

    // 5. Campaign Queue
    await sql`
        CREATE TABLE IF NOT EXISTS campaign_queue (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        campaign_id UUID REFERENCES campaigns(id),
        contact_phone TEXT NOT NULL,
        contact_id UUID REFERENCES whitelisted_numbers(id),
        status TEXT DEFAULT 'pending', 
        ai_message TEXT,
        sent_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW()
        );
    `;
    console.log('Created campaign_queue table');

    // 6. Documents (Knowledge Base)
    // Note: Vector extension must be enabled manually in Neon/Vercel Dashboard or via sql`CREATE EXTENSION vector` if supported.
    try {
      await sql`CREATE EXTENSION IF NOT EXISTS vector;`;
      console.log('Enabled vector extension');
    } catch (e) {
      console.warn('Could not enable vector extension (may already exist or not supported):', e);
    }

    await sql`
      CREATE TABLE IF NOT EXISTS documents (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        org_id UUID REFERENCES organizations(id),
        content TEXT,
        metadata JSONB,
        embedding vector(768),
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `;
    console.log('Created documents table');

    console.log('Migration completed successfully!');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

main();
