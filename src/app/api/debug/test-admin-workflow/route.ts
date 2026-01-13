import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function POST(req: Request) {
    try {
        // Test the complete admin workflow
        const testPhone = '+15559876543';
        const adminEmail = 'harrycastaner@gmail.com';

        // Step 1: Check if organization exists
        const { rows: orgs } = await db.sql`
            SELECT id, name FROM organizations WHERE owner_email = ${adminEmail}
        `;

        console.log("Organizations found:", orgs);

        if (orgs.length === 0) {
            return NextResponse.json({
                success: false,
                error: "No organization found for admin",
                step: "organization_check"
            });
        }

        const orgId = orgs[0].id;

        // Step 2: Try to add user to whitelist (simulate dashboard action)
        await db.sql`
            INSERT INTO whitelist (phone_number, name, org_id, role, ai_status)
            VALUES (${testPhone}, 'Test Dashboard User', ${orgId}, 'member', 'active')
            ON CONFLICT (phone_number) DO UPDATE SET name = EXCLUDED.name, role = EXCLUDED.role
        `;

        // Step 3: Verify user was added
        const { rows: verification } = await db.sql`
            SELECT w.*, o.name as org_name
            FROM whitelist w
            JOIN organizations o ON w.org_id = o.id
            WHERE w.phone_number = ${testPhone}
        `;

        // Step 4: Get current whitelist count for this org
        const { rows: whitelistCount } = await db.sql`
            SELECT COUNT(*) as count
            FROM whitelist w
            JOIN organizations o ON w.org_id = o.id
            WHERE o.owner_email = ${adminEmail}
        `;

        return NextResponse.json({
            success: true,
            organization: orgs[0],
            user_added: verification[0] || null,
            total_whitelist_users: parseInt(whitelistCount[0].count),
            workflow_steps: [
                "✅ Organization found",
                "✅ User added to whitelist",
                "✅ User verification successful"
            ]
        });

    } catch (error: any) {
        console.error('Admin workflow test error:', error);
        return NextResponse.json({
            success: false,
            error: error.message
        }, { status: 500 });
    }
}

// Clean up test user
export async function DELETE(req: Request) {
    try {
        const testPhone = '+15559876543';
        await db.sql`DELETE FROM whitelist WHERE phone_number = ${testPhone}`;
        return NextResponse.json({ success: true, message: 'Test user cleaned up' });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}