// Simple test to trigger webhook with database setup
const fetch = require('node-fetch');

async function testTaskSetup() {
  try {
    console.log('Testing webhook with task setup command...');

    const response = await fetch('https://ai-texting-agent.vercel.app/api/webhook/ghl/incoming', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        From: '+18569936360',
        Body: 'Set up my daily tasks for tomorrow: 1. Check emails 2. Work on project 3. Go to gym',
        contact_name: 'Harry Castaner'
      })
    });

    const text = await response.text();
    console.log('Response status:', response.status);
    console.log('Response:', text);

  } catch (error) {
    console.error('Test failed:', error.message);
  }
}

testTaskSetup();