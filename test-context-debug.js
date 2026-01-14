// Debug the context storage and retrieval
const axios = require('axios');

async function debugContext() {
  try {
    console.log('=== Testing Context Storage Debug ===\n');

    // First store a phone number
    console.log('Step 1: Storing context via phone number message...');
    const phoneResponse = await axios.post(
      'https://ai-texting-agent.vercel.app/api/webhook/ghl/incoming',
      {
        From: '+18569936360',
        Body: '8566883958'
      },
      { headers: { 'Content-Type': 'application/json' } }
    );

    console.log('Response:', phoneResponse.data.response);

    // Check what's in the admin notifications table
    console.log('\nStep 2: Checking admin notifications...');
    const adminResponse = await axios.get('https://ai-texting-agent.vercel.app/api/debug/admin');

    // Look for any notifications related to context
    const notifications = adminResponse.data.admin_notifications || [];
    console.log('Total notifications found:', notifications.length);

    const contextNotifications = notifications.filter(n => n.type === 'contact_context');
    console.log('Context notifications:', contextNotifications);

    // Wait and test follow-up
    console.log('\nStep 3: Testing follow-up detection with explicit contact command...');
    const testResponse = await axios.post(
      'https://ai-texting-agent.vercel.app/api/webhook/ghl/incoming',
      {
        From: '+18569936360',
        Body: 'text 8566883958 test message 2'
      },
      { headers: { 'Content-Type': 'application/json' } }
    );

    console.log('Response:', testResponse.data.response);

  } catch (error) {
    if (error.response) {
      console.error('Error response:', error.response.data);
    } else {
      console.error('Error:', error.message);
    }
  }
}

debugContext();