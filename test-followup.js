// Test follow-up message functionality
const axios = require('axios');

async function testFollowupFlow() {
  try {
    console.log('=== Testing Follow-up Message Flow ===\n');

    // Step 1: Send just a phone number
    console.log('Step 1: Sending just phone number "8566883958"...');
    const phoneResponse = await axios.post(
      'https://ai-texting-agent.vercel.app/api/webhook/ghl/incoming',
      {
        From: '+18569936360',
        Body: '8566883958'
      },
      { headers: { 'Content-Type': 'application/json' } }
    );

    console.log('Response:', phoneResponse.data.response);
    console.log('');

    // Wait a moment for context to be stored
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Step 2: Send a follow-up message
    console.log('Step 2: Sending follow-up message "How\'s the new business plan going for you?"...');
    const followupResponse = await axios.post(
      'https://ai-texting-agent.vercel.app/api/webhook/ghl/incoming',
      {
        From: '+18569936360',
        Body: "How's the new business plan going for you?"
      },
      { headers: { 'Content-Type': 'application/json' } }
    );

    console.log('Response:', followupResponse.data.response);
    console.log('');

    // Step 3: Send another follow-up
    console.log('Step 3: Sending another follow-up message "Let me know if you need any help with implementation."...');
    const followup2Response = await axios.post(
      'https://ai-texting-agent.vercel.app/api/webhook/ghl/incoming',
      {
        From: '+18569936360',
        Body: "Let me know if you need any help with implementation."
      },
      { headers: { 'Content-Type': 'application/json' } }
    );

    console.log('Response:', followup2Response.data.response);

    console.log('\n=== Follow-up Flow Test Complete ===');

  } catch (error) {
    if (error.response) {
      console.error('Error response:', error.response.data);
    } else {
      console.error('Error:', error.message);
    }
  }
}

testFollowupFlow();