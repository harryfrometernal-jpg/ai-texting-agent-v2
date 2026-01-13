// Test script for direct phone number texting functionality
// Simulates the message: "Text 8566883958 and check in on them"

const testDirectTexting = async () => {
  console.log('Testing direct phone number texting...');

  try {
    // Test the contact manager parsing
    const response = await fetch('https://ai-texting-agent.vercel.app/api/webhook/ghl/incoming', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        From: '+18569936360', // Admin phone number (you'd need to use yours)
        Body: 'Text 8566883958 and check in on them',
        contact_name: 'Admin User'
      })
    });

    const result = await response.json();
    console.log('Response:', result);

    if (result.response && result.response.includes('Message sent')) {
      console.log('✅ SUCCESS: Direct texting worked!');
    } else {
      console.log('❌ FAILED: Response:', result.response);
    }

  } catch (error) {
    console.error('❌ ERROR:', error.message);
  }
};

// Note: This is just a test - replace the admin phone with your actual whitelisted number
console.log('To test your direct texting:');
console.log('1. Make sure your phone number is in the whitelist table');
console.log('2. Send a text to your AI agent: "Text 8566883958 and check in on them"');
console.log('3. The system should parse this, extract the phone and message, and send immediately');

// Uncomment to run test (but use your actual admin number)
// testDirectTexting();