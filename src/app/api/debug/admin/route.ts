import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(req: Request) {
    try {
        // Check admin setup
        const { rows: adminSetup } = await db.sql`
            SELECT w.*, o.name as org_name, o.owner_email
            FROM whitelist w
            JOIN organizations o ON w.org_id = o.id
            WHERE w.phone_number = '+18569936360'
        `;

        // Check organization setup
        const { rows: orgSetup } = await db.sql`
            SELECT * FROM organizations WHERE owner_email = 'harrycastaner@gmail.com'
        `;

        // Check all whitelist entries for this org
        const { rows: allWhitelist } = await db.sql`
            SELECT w.* FROM whitelist w
            JOIN organizations o ON w.org_id = o.id
            WHERE o.owner_email = 'harrycastaner@gmail.com'
            ORDER BY w.created_at DESC
        `;

        return NextResponse.json({
            admin_setup: adminSetup,
            organization_setup: orgSetup,
            all_whitelist_entries: allWhitelist,
            admin_phone_configured: adminSetup.length > 0,
            org_exists: orgSetup.length > 0,
            total_whitelist_entries: allWhitelist.length
        });

    } catch (error: any) {
        console.error("Debug admin error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}