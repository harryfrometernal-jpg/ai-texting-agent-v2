// Test contact manager admin access directly
const axios = require('axios');

async function testContactManagerAuth() {
  try {
    console.log('Testing contact manager admin access...');

    // Test with your exact phone number from the whitelist
    const testPayload = {
      From: '+18569936360',
      Body: 'Text 8566883958 and check in on them. I tried to call you, but I could not connect. A manager will reach out shortly.'
    };

    console.log('Sending test payload:', testPayload);

    const response = await axios.post(
      'https://ai-texting-agent.vercel.app/api/webhook/ghl/incoming',
      testPayload,
      {
        headers: { 'Content-Type': 'application/json' },
        timeout: 30000
      }
    );

    console.log('Response status:', response.status);
    console.log('Response data:', response.data);

  } catch (error) {
    if (error.response) {
      console.error('Error response:', error.response.data);
      console.error('Status:', error.response.status);
    } else {
      console.error('Error:', error.message);
    }
  }
}

testContactManagerAuth();