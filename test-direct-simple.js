// Test just the message sending part directly
const axios = require('axios');

async function testDirectSending() {
  try {
    console.log('Testing direct message sending to GHL webhook...');

    // Get the webhook URL from the organization
    const debugResponse = await axios.get('https://ai-texting-agent.vercel.app/api/debug/admin');
    const orgData = debugResponse.data.organization_setup[0];
    const webhookUrl = orgData?.ghl_webhook_url;

    if (!webhookUrl) {
      console.error('No webhook URL found');
      return;
    }

    console.log('Webhook URL:', webhookUrl);

    // Test direct send to webhook
    console.log('Sending message directly to GHL...');
    const webhookResponse = await axios.post(webhookUrl, {
      phone: '+18566883958',
      message: 'Test message from contact manager debugging',
      source: 'contact_manager_direct'
    });

    console.log('Webhook response status:', webhookResponse.status);
    console.log('Webhook response data:', webhookResponse.data);

  } catch (error) {
    if (error.response) {
      console.error('Error response status:', error.response.status);
      console.error('Error response data:', error.response.data);
    } else {
      console.error('Error:', error.message);
    }
  }
}

testDirectSending();