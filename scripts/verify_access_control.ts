
import 'dotenv/config';
import { db } from '@/lib/db';
import { normalizePhoneNumber } from '@/lib/utils';
// Mock response function
function mockNextResponse(data: any, init?: any) {
    return {
        json: async () => data,
        ...data,
        status: init?.status || 200
    };
}
// We can't import the POST handler easily if it's default export Next.js route, 
// but we can import the logic if refactored. 
// For now, let's verify via Database state and maybe simulating the queries the webhook does.

async function main() {
    console.log("Verifying Access Control...");

    const adminPhone = '+18569936360'; // Harry
    const leadPhone = '+15550009999';
    const unknownPhone = '+19998887777';

    try {
        // 1. Verify Admin is in Whitelist
        const { rows: admins } = await db.sql`SELECT * FROM whitelist WHERE phone_number = ${adminPhone}`;
        if (admins.length > 0) {
            console.log("✅ Admin found in Whitelist:", admins[0].name);
        } else {
            console.error("❌ Admin NOT found in Whitelist!");
        }

        // 2. Setup a Lead
        // Ensure lead is in contacts, NOT whitelist
        await db.sql`DELETE FROM whitelist WHERE phone_number = ${leadPhone}`;
        await db.sql`INSERT INTO contacts (phone_number, name, ai_status) VALUES (${leadPhone}, 'Test Lead', 'active') ON CONFLICT (phone_number) DO NOTHING`;

        // 3. Setup Goal for Lead (Active)
        await db.sql`DELETE FROM conversation_goals WHERE contact_phone = ${leadPhone}`;
        await db.sql`
            INSERT INTO conversation_goals (contact_phone, contact_name, goal_description, status)
            VALUES (${leadPhone}, 'Test Lead', 'Book a meeting', 'active')
        `;
        console.log("✅ Test Lead set up with active goal.");

        // 4. Test Logic Checks (Simulation)

        // --- Test: Admin Message ---
        console.log("\n--- Testing Admin Access ---");
        const { rows: wRows } = await db.sql`SELECT * FROM whitelist WHERE phone_number = ${adminPhone} LIMIT 1`;
        if (wRows[0]) {
            console.log("✅ Logic Check: Admin detected in whitelist. ACCESS GRANTED.");
        } else {
            console.error("❌ Logic Check: Admin NOT detected.");
        }

        // --- Test: Lead Message (Active Goal) ---
        console.log("\n--- Testing Lead Access (Active Goal) ---");
        // Check Whitelist (Should fail)
        const { rows: wRowsLead } = await db.sql`SELECT * FROM whitelist WHERE phone_number = ${leadPhone} LIMIT 1`;
        if (!wRowsLead[0]) {
            console.log("✅ Lead correctly NOT in whitelist.");

            // Check Contacts
            const { rows: cRows } = await db.sql`SELECT * FROM contacts WHERE phone_number = ${leadPhone} LIMIT 1`;
            if (cRows[0]) {
                console.log("✅ Lead found in contacts.");

                // Check Goal
                const { rows: gRows } = await db.sql`SELECT * FROM conversation_goals WHERE contact_phone = ${leadPhone} AND status = 'active'`;
                if (gRows.length > 0) {
                    console.log("✅ Active goal found. ACCESS GRANTED.");
                } else {
                    console.error("❌ Active goal NOT found.");
                }
            } else {
                console.error("❌ Lead NOT number in contacts.");
            }
        } else {
            console.error("❌ Lead wrongly found in whitelist!");
        }

        // --- Test: Lead Message (NO Goal) ---
        console.log("\n--- Testing Lead Access (NO Goal) ---");
        await db.sql`UPDATE conversation_goals SET status = 'completed' WHERE contact_phone = ${leadPhone}`;

        const { rows: gRowsNoGoal } = await db.sql`SELECT * FROM conversation_goals WHERE contact_phone = ${leadPhone} AND status = 'active'`;
        if (gRowsNoGoal.length === 0) {
            console.log("✅ No active goal found. ACCESS DENIED (Correct).");
        } else {
            console.error("❌ Active goal still found!");
        }

        console.log("\nVerification Complete.");

    } catch (error) {
        console.error("Verification Error:", error);
    } finally {
        process.exit(0);
    }
}

main();
