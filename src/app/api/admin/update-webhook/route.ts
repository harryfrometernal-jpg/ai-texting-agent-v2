import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function POST() {
  try {
    console.log('🔧 Updating webhook configuration...');

    const webhookUrl = 'https://services.leadconnectorhq.com/hooks/R0DbCDcJdSd6Bd4e4qwT/webhook-trigger/cd7fa8f7-6835-489f-84d1-4eb347020bba';

    // Update organization webhook URL
    const { rows: orgs } = await db.sql`
      UPDATE organizations
      SET ghl_webhook_url = ${webhookUrl}
      WHERE owner_email = 'harrycastaner@gmail.com'
      RETURNING *
    `;

    if (orgs.length === 0) {
      // Create organization if it doesn't exist
      await db.sql`
        INSERT INTO organizations (name, owner_email, ghl_webhook_url, api_key)
        VALUES ('Harry Castaner Organization', 'harrycastaner@gmail.com', ${webhookUrl}, 'default-key-' || extract(epoch from now()))
        ON CONFLICT (owner_email) DO UPDATE SET
          ghl_webhook_url = EXCLUDED.ghl_webhook_url
      `;
      console.log('✅ Created organization with webhook URL');
    } else {
      console.log(`✅ Updated webhook URL for organization: ${orgs[0].name}`);
    }

    // Test the webhook immediately
    const testResponse = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phone: '+18569936360',
        message: '🎉 SUCCESS! Your AI accountability system is now fully configured and ready! You\'ll get your first morning prompt tomorrow at 8:00 AM EST.',
        source: 'system_configuration_test'
      })
    });

    const testResult = await testResponse.text();

    return NextResponse.json({
      success: true,
      message: 'Webhook configuration updated successfully!',
      webhook_url: webhookUrl,
      test_result: testResult,
      organization_updated: orgs.length > 0 ? orgs[0] : 'created',
      next_steps: [
        'Your system is now fully configured',
        'Morning accountability texts will be sent at 8:00 AM EST daily',
        'Follow-up calls will trigger if no response within 2 hours',
        'Check your phone for a success confirmation text'
      ]
    });

  } catch (error) {
    console.error('❌ Error updating webhook config:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}