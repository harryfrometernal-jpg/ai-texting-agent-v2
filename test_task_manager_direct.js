// Test the task manager directly via webhook with a simulated morning prompt response
const https = require('https');

const data = JSON.stringify({
  "From": "+18569936360",
  "Body": "Today I want to accomplish: 1. Finish the client proposal by 2pm 2. Hit the gym for 45 minutes 3. Review quarterly budget numbers 4. Call mom to check in",
  "contact_name": "Harry Castaner"
});

const options = {
  hostname: 'ai-texting-agent.vercel.app',
  port: 443,
  path: '/api/webhook/ghl/incoming',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length
  }
};

const req = https.request(options, (res) => {
  console.log(`Status: ${res.statusCode}`);

  let body = '';
  res.on('data', (chunk) => {
    body += chunk;
  });

  res.on('end', () => {
    try {
      const response = JSON.parse(body);
      console.log('Response:', JSON.stringify(response, null, 2));
    } catch (e) {
      console.log('Raw response:', body);
    }
  });
});

req.on('error', (e) => {
  console.error(`Problem with request: ${e.message}`);
});

req.write(data);
req.end();