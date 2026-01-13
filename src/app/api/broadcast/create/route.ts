
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function POST(req: Request) {
    try {
        const { goal, contactIds } = await req.json();

        if (!goal) return NextResponse.json({ error: "Goal is required" }, { status: 400 });

        // 1. Fetch Contacts
        // 1. Fetch Contacts
        let contacts;
        if (contactIds && contactIds.length > 0) {
            // Need to handle array param for IN clause safely
            // Vercel SDK doesn't support array directly in template well sometimes, or does it?
            // "postgres" library supports it.
            // Workaround: loop or specific construction. 
            // Or simpler: just get all and filter in JS if list is small, OR use manual string construction carefully (risky).
            // Better: use ANY()
            // const { rows } = await db.sql`SELECT id, phone_number FROM whitelisted_numbers WHERE id = ANY(${contactIds})`; 
            // Wait, standard pg param for arrays is usually valid.
            const { rows } = await db.query(`SELECT id, phone_number FROM contacts WHERE id = ANY($1)`, [contactIds]);
            contacts = rows;
        } else {
            // Get all
            const { rows } = await db.sql`SELECT id, phone_number FROM contacts`;
            contacts = rows;
        }

        if (!contacts || contacts.length === 0) {
            return NextResponse.json({ message: "No contacts found." });
        }

        // 2. Create Campaign
        // 2. Create Campaign
        const { rows: campRows } = await db.sql`
            INSERT INTO campaigns (goal, total_contacts, status)
            VALUES (${goal}, ${contacts.length}, 'active')
            RETURNING id
        `;
        const campaign = campRows[0];

        // if (campError) throw new Error(campError.message);

        // 3. Bulk Insert into Queue
        // Vercel/postgres doesn't have easy bulk insert. Loop for now (fine for <100 contacts).
        // Or construct one big query.
        for (const c of contacts) {
            await db.sql`
                INSERT INTO campaign_queue (campaign_id, contact_id, phone_number, status)
                VALUES (${campaign.id}, ${c.id}, ${c.phone_number}, 'pending')
             `;
        }
        // if (queueError) throw new Error(queueError.message);

        return NextResponse.json({ success: true, campaignId: campaign.id, count: contacts.length });

    } catch (e: any) {
        console.error("Broadcast Creation Error:", e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
