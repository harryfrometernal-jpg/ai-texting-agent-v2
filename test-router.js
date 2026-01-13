// Test router logic directly
const axios = require('axios');

async function testRouter() {
  try {
    console.log('Testing router decision for contact manager command...');

    const testMessages = [
      'Text 8566883958 and check in on them. I tried to call you, but I could not connect. A manager will reach out shortly.',
      'text 8566883958 and check in on them',
      'Text phone number 8566883958',
      'Contact management: text John',
      'Add contact John Smith 555-123-4567'
    ];

    for (const message of testMessages) {
      console.log(`\n=== Testing message: "${message}" ===`);

      // Test which agent the router chooses
      const context = {
        from: '+18569936360',
        body: message
      };

      // We need to test this by looking at the actual webhook logs
      // Let's send it through the webhook and see what happens
      const response = await axios.post(
        'https://ai-texting-agent.vercel.app/api/webhook/ghl/incoming',
        {
          From: '+18569936360',
          Body: message
        },
        {
          headers: { 'Content-Type': 'application/json' },
          timeout: 30000
        }
      );

      console.log('Response:', response.data);
    }

  } catch (error) {
    if (error.response) {
      console.error('Error response:', error.response.data);
    } else {
      console.error('Error:', error.message);
    }
  }
}

testRouter();