import { db } from '../src/lib/db';

async function setupTaskSystem() {
  console.log('🚀 Setting up daily task management system...');

  try {
    // 1. Create task-related tables
    console.log('📊 Creating database tables...');

    // Create daily_tasks table
    await db.sql`
      CREATE TABLE IF NOT EXISTS daily_tasks (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
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
        productivity_score INTEGER, -- 1-10 scale
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
        checkin_frequency INTEGER DEFAULT 4, -- hours between check-ins
        max_daily_checkins INTEGER DEFAULT 3,
        weekend_mode BOOLEAN DEFAULT false,
        notification_style TEXT DEFAULT 'supportive' CHECK (notification_style IN ('supportive', 'direct', 'motivational')),
        auto_scheduling BOOLEAN DEFAULT true,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `;

    console.log('✅ Tables created successfully');

    // 2. Create indexes for better performance
    console.log('📈 Creating database indexes...');

    await db.sql`CREATE INDEX IF NOT EXISTS idx_daily_tasks_user_date ON daily_tasks(user_phone, task_date)`;
    await db.sql`CREATE INDEX IF NOT EXISTS idx_daily_tasks_status ON daily_tasks(status)`;
    await db.sql`CREATE INDEX IF NOT EXISTS idx_task_checkins_user_date ON task_checkins(user_phone, task_date)`;
    await db.sql`CREATE INDEX IF NOT EXISTS idx_task_checkins_type ON task_checkins(checkin_type)`;

    console.log('✅ Indexes created successfully');

    // 3. Set up user preferences for 8 AM prompts
    console.log('⚙️ Setting up user preferences...');

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

    // 4. Add user to whitelist if not already there
    console.log('👤 Ensuring user is whitelisted...');

    const { rows: orgRows } = await db.sql`SELECT id FROM organizations LIMIT 1`;
    if (orgRows.length === 0) {
      console.error('❌ No organization found. Please set up an organization first.');
      return;
    }

    const orgId = orgRows[0].id;

    await db.sql`
      INSERT INTO whitelist (phone_number, name, org_id, ai_status)
      VALUES (${userPhone}, 'Harry Castaner', ${orgId}, 'active')
      ON CONFLICT (phone_number) DO NOTHING
    `;

    console.log('✅ User whitelisted successfully');

    // 5. Verify setup
    console.log('🔍 Verifying setup...');

    const { rows: prefRows } = await db.sql`
      SELECT * FROM task_preferences WHERE user_phone = ${userPhone}
    `;

    const { rows: whitelistRows } = await db.sql`
      SELECT * FROM whitelist WHERE phone_number = ${userPhone}
    `;

    console.log('📋 Setup Summary:');
    console.log(`- User Phone: ${userPhone}`);
    console.log(`- Morning Prompt Time: ${prefRows[0]?.daily_prompt_time || 'Not set'}`);
    console.log(`- Timezone: ${prefRows[0]?.timezone || 'Not set'}`);
    console.log(`- Notification Style: ${prefRows[0]?.notification_style || 'Not set'}`);
    console.log(`- Whitelisted: ${whitelistRows.length > 0 ? 'Yes' : 'No'}`);

    console.log('🎉 Task management system setup complete!');
    console.log('📱 You will receive your first morning accountability text at 8:00 AM EST tomorrow.');

  } catch (error) {
    console.error('❌ Error setting up task system:', error);
    throw error;
  }
}

// Run the setup
setupTaskSystem()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Setup failed:', error);
    process.exit(1);
  });