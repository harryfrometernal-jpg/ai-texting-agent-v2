import { NextResponse } from 'next/server';

export async function POST(req: Request) {
    try {
        // Simulate the exact scenario: Admin sends "Text 8566883958 and check in on them. I tried to call you, but I couldn't connect. A manager will reach out shortly."

        const testMessage = 'Text 8566883958 and check in on them. I tried to call you, but I could not connect. A manager will reach out shortly.';
        const adminPhone = '+18569936360';

        // Test the webhook endpoint
        const webhookResponse = await fetch(`${process.env.NEXTAUTH_URL || 'https://ai-texting-agent.vercel.app'}/api/webhook/ghl/incoming`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                From: adminPhone,
                Body: testMessage,
                contact_name: 'Harry Castaner'
            })
        });

        const webhookResult = await webhookResponse.json();

        return NextResponse.json({
            success: webhookResponse.ok,
            status_code: webhookResponse.status,
            webhook_response: webhookResult,
            test_message: testMessage,
            admin_phone: adminPhone
        });

    } catch (error: any) {
        console.error('Direct texting test error:', error);
        return NextResponse.json({
            success: false,
            error: error.message
        }, { status: 500 });
    }
}