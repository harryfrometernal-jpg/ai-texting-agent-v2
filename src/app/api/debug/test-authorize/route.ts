import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function POST(req: Request) {
    try {
        // Simulate what the dashboard does when authorizing a user
        const testPhone = '+15551234567'; // Test phone number
        const testName = 'Test User';

        // Get the organization (like the dashboard would)
        const { rows: orgs } = await db.sql`
            SELECT id FROM organizations WHERE owner_email = 'harrycastaner@gmail.com' LIMIT 1
        `;

        if (orgs.length === 0) {
            return NextResponse.json({
                success: false,
                error: 'No organization found'
            });
        }

        const orgId = orgs[0].id;

        // Test the actual admin-whitelist endpoint logic
        await db.sql`
            INSERT INTO whitelist (phone_number, name, org_id, role, ai_status)
            VALUES (${testPhone}, ${testName}, ${orgId}, 'member', 'active')
            ON CONFLICT (phone_number) DO UPDATE SET name = EXCLUDED.name, role = EXCLUDED.role
        `;

        // Verify it was added
        const { rows: verification } = await db.sql`
            SELECT * FROM whitelist WHERE phone_number = ${testPhone}
        `;

        return NextResponse.json({
            success: true,
            message: 'Test user authorization successful',
            user_added: verification[0] || null
        });

    } catch (error: any) {
        console.error('Test authorization error:', error);
        return NextResponse.json({
            success: false,
            error: error.message
        }, { status: 500 });
    }
}

// Clean up test user
export async function DELETE(req: Request) {
    try {
        const testPhone = '+15551234567';

        await db.sql`
            DELETE FROM whitelist WHERE phone_number = ${testPhone}
        `;

        return NextResponse.json({
            success: true,
            message: 'Test user removed'
        });

    } catch (error: any) {
        return NextResponse.json({
            success: false,
            error: error.message
        }, { status: 500 });
    }
}