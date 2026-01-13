import { db } from '../src/lib/db';

const ADMIN_PHONE = '+18569936360';
const ADMIN_EMAIL = 'harrycastaner@gmail.com';
const ADMIN_NAME = 'Harry Castaner';

async function setupAdminPhone() {
    console.log('Setting up admin phone number...');

    try {
        // 1. First ensure organization exists
        const { rows: orgRows } = await db.sql`
            INSERT INTO organizations (name, owner_email, plan, status)
            VALUES ('Eternal Consulting', ${ADMIN_EMAIL}, 'unlimited', 'active')
            ON CONFLICT (owner_email) DO UPDATE SET name = EXCLUDED.name
            RETURNING id
        `;

        const orgId = orgRows[0].id;
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
        } else {
            console.error('❌ Failed to verify admin setup');
        }

        // 4. Also check contact manager compatibility
        console.log('\n🔍 Testing contact manager access...');
        const { rows: accessCheck } = await db.sql`
            SELECT id FROM whitelist WHERE phone_number = ${ADMIN_PHONE} LIMIT 1
        `;

        if (accessCheck.length > 0) {
            console.log('✅ Contact manager will recognize this admin');
        } else {
            console.log('❌ Contact manager will NOT recognize this admin');
        }

    } catch (error) {
        console.error('Error setting up admin:', error);
    }
}

setupAdminPhone();