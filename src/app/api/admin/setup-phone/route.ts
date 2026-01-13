import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

const ADMIN_PHONE = '+18569936360';
const ADMIN_EMAIL = 'harrycastaner@gmail.com';
const ADMIN_NAME = 'Harry Castaner';

export async function POST(req: Request) {
    try {
        console.log('Setting up admin phone number...');

        // 1. First check if organization exists, if not create it
        let { rows: orgRows } = await db.sql`
            SELECT id FROM organizations WHERE owner_email = ${ADMIN_EMAIL} LIMIT 1
        `;

        let orgId;
        if (orgRows.length === 0) {
            const { rows: newOrgRows } = await db.sql`
                INSERT INTO organizations (name, owner_email)
                VALUES ('Eternal Consulting', ${ADMIN_EMAIL})
                RETURNING id
            `;
            orgId = newOrgRows[0].id;
        } else {
            orgId = orgRows[0].id;
        }

        console.log(`Organization ID: ${orgId}`);

        // 2. Add admin to whitelist
        const { rows: whitelistRows } = await db.sql`
            INSERT INTO whitelist (phone_number, name, org_id, role, ai_status)
            VALUES (${ADMIN_PHONE}, ${ADMIN_NAME}, ${orgId}, 'admin', 'active')
            ON CONFLICT (phone_number) DO UPDATE SET
                org_id = EXCLUDED.org_id,
                role = EXCLUDED.role,
                ai_status = EXCLUDED.ai_status,
                name = EXCLUDED.name
            RETURNING id
        `;

        const whitelistId = whitelistRows[0].id;
        console.log(`Whitelist ID: ${whitelistId}`);

        // 3. Verify setup
        const { rows: verification } = await db.sql`
            SELECT w.*, o.name as org_name
            FROM whitelist w
            JOIN organizations o ON w.org_id = o.id
            WHERE w.phone_number = ${ADMIN_PHONE}
        `;

        if (verification.length > 0) {
            const admin = verification[0];
            console.log(`✅ Admin setup complete:
            Name: ${admin.name}
            Phone: ${admin.phone_number}
            Role: ${admin.role}
            Organization: ${admin.org_name}
            Status: ${admin.ai_status}
            `);

            return NextResponse.json({
                success: true,
                admin: {
                    name: admin.name,
                    phone: admin.phone_number,
                    role: admin.role,
                    organization: admin.org_name,
                    status: admin.ai_status
                }
            });
        } else {
            return NextResponse.json({
                success: false,
                error: 'Failed to verify admin setup'
            }, { status: 500 });
        }

    } catch (error: any) {
        console.error('Error setting up admin:', error);
        return NextResponse.json({
            success: false,
            error: error.message
        }, { status: 500 });
    }
}