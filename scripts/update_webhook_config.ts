import { db } from '../src/lib/db';

async function updateWebhookConfig() {
  console.log('🔧 Updating webhook configuration...');

  try {
    // Update organization webhook URL
    const webhookUrl = 'https://services.leadconnectorhq.com/hooks/R0DbCDcJdSd6Bd4e4qwT/webhook-trigger/cd7fa8f7-6835-489f-84d1-4eb347020bba';

    const { rows: orgs } = await db.sql`
      UPDATE organizations
      SET ghl_webhook_url = ${webhookUrl}
      WHERE owner_email = 'harrycastaner@gmail.com'
      RETURNING *
    `;

    if (orgs.length > 0) {
      console.log(`✅ Updated webhook URL for organization: ${orgs[0].name}`);
    } else {
      // Create organization if it doesn't exist
      await db.sql`
        INSERT INTO organizations (name, owner_email, ghl_webhook_url, api_key)
        VALUES ('Harry Castaner Organization', 'harrycastaner@gmail.com', ${webhookUrl}, 'default-key-' || extract(epoch from now()))
        ON CONFLICT (owner_email) DO UPDATE SET
          ghl_webhook_url = EXCLUDED.ghl_webhook_url
      `;
      console.log('✅ Created/updated organization with webhook URL');
    }

    console.log(`🎯 Webhook URL configured: ${webhookUrl}`);
    console.log('📱 Morning accountability texts will now be sent to your phone!');

    return true;
  } catch (error) {
    console.error('❌ Error updating webhook config:', error);
    return false;
  }
}

// Export for use in API endpoint
export { updateWebhookConfig };