import { POST } from '../src/app/api/webhook/ghl/incoming/route';
import { NextRequest } from 'next/server';

// Mock payload for testing
const payload = {
    type: 'InboundMessage',
    contactId: 'contact_123',
    From: '+15550100', // Whitelisted number
    Body: 'I am interested in buying a house in Miami', // Should trigger General/Real Estate logic
    workflowId: 'workflow_123'
};

const nonWhitelistedPayload = {
    ...payload,
    From: '+1999999999'
};

async function testDirectHandler(data: any, name: string) {
    console.log(`\n--- Testing ${name} ---`);
    try {
        const req = new NextRequest('http://localhost/api/webhook/ghl/incoming', {
            method: 'POST',
            body: JSON.stringify(data),
            headers: { 'Content-Type': 'application/json' }
        });

        const response = await POST(req);
        const text = await response.text();

        console.log(`Status: ${response.status}`);
        console.log(`Response: ${text}`);

        if (response.status === 200) {
            console.log("✅ Success!");
        } else {
            console.log("❌ Failed/Error response");
        }
    } catch (error: any) {
        console.error("❌ Exception:", error.message);
        if (error.cause) console.error("Cause:", error.cause);
    }
}

async function run() {
    // 1. Test Whitelisted (should succeed)
    console.log("Testing Whitelisted Number...");
    await testDirectHandler(payload, "Whitelisted Number");

    // 2. Test Non-Whitelisted
    console.log("Testing Non-Whitelisted Number...");
    await testDirectHandler(nonWhitelistedPayload, "Non-Whitelisted Number");
}

run();
