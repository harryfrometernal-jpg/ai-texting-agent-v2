import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function POST(req: Request) {
    try {
        console.log('Creating Whitelist Table...');

        // Enable UUID extension
        await db.sql`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`;

        // Create 'whitelist' table designed for Admins/Team Members
        await db.sql`
            CREATE TABLE IF NOT EXISTS whitelist (
                id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
                phone_number TEXT UNIQUE NOT NULL,
                name TEXT,
                org_id UUID REFERENCES organizations(id),
                role TEXT DEFAULT 'member',
                ai_status TEXT DEFAULT 'active',
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            )
        `;

        console.log('Whitelist table created successfully');

        // Check if admin exists
        const { rows: existingAdmin } = await db.sql`
            SELECT id FROM whitelist WHERE phone_number = '+18569936360' LIMIT 1
        `;

        if (existingAdmin.length === 0) {
            console.log('Adding default admin to whitelist...');

            // Get organization for the admin
            const { rows: orgs } = await db.sql`
                SELECT id FROM organizations WHERE owner_email = 'harrycastaner@gmail.com' LIMIT 1
            `;

            let orgId = null;
            if (orgs.length > 0) {
                orgId = orgs[0].id;
            }

            if (orgId) {
                await db.sql`
                    INSERT INTO whitelist (phone_number, name, role, ai_status, org_id)
                    VALUES ('+18569936360', 'Harry Castaner', 'admin', 'active', ${orgId})
                    ON CONFLICT (phone_number) DO NOTHING
                `;
            } else {
                await db.sql`
                    INSERT INTO whitelist (phone_number, name, role, ai_status)
                    VALUES ('+18569936360', 'Harry Castaner', 'admin', 'active')
                    ON CONFLICT (phone_number) DO NOTHING
                `;
            }
        }

        // Verify the setup
        const { rows: verification } = await db.sql`
            SELECT w.*, o.name as org_name
            FROM whitelist w
            LEFT JOIN organizations o ON w.org_id = o.id
            WHERE w.phone_number = '+18569936360'
        `;

        return NextResponse.json({
            success: true,
            message: 'Whitelist table created and admin configured',
            admin_setup: verification[0] || null
        });

    } catch (error: any) {
        console.error('Migration failed:', error);
        return NextResponse.json({
            success: false,
            error: error.message
        }, { status: 500 });
    }
}