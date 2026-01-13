
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { normalizePhoneNumber } from '@/lib/utils';
// import vCard from 'vcard-parser'; // We will use a simple regex or dynamic import if needed, or just install it.
// For now, let's implement basic CSV and strict vCard parsing manually or use a library if installed. 
// I'll install vcard-parser in the next step or assume standard format.
// Actually, I'll use a simple vCard regex for now to avoid bulky deps if possible, or just parse text.
// CSV is easier.

export async function POST(req: Request) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    try {
        const formData = await req.formData();
        const file = formData.get('file') as File;
        const orgId = formData.get('org_id') as string;

        if (!file || !orgId) {
            return NextResponse.json({ error: "Missing file or org_id" }, { status: 400 });
        }

        // Verify Org Ownership
        const orgCheck = await db.sql`SELECT id FROM organizations WHERE id = ${orgId} AND owner_email = ${session.user.email}`;
        if (orgCheck.rows.length === 0) return NextResponse.json({ error: "Organization not found" }, { status: 403 });

        const text = await file.text();
        const contactsToInsert: any[] = [];
        let successCount = 0;
        let failCount = 0;

        if (file.name.endsWith('.csv')) {
            // Simple CSV Parser
            // Assume Header: Name, Phone, Email, Tags
            const lines = text.split('\n');
            const headers = lines[0].toLowerCase().split(',').map(h => h.trim());

            const nameIdx = headers.findIndex(h => h.includes('name'));
            const phoneIdx = headers.findIndex(h => h.includes('phone'));
            const emailIdx = headers.findIndex(h => h.includes('email'));
            const tagsIdx = headers.findIndex(h => h.includes('tag'));

            if (phoneIdx === -1) {
                return NextResponse.json({ error: "CSV must have a 'Phone' column" }, { status: 400 });
            }

            for (let i = 1; i < lines.length; i++) {
                if (!lines[i].trim()) continue;
                const cols = lines[i].split(',').map(c => c.trim());

                const phone = cols[phoneIdx];
                if (!phone) {
                    failCount++;
                    continue;
                }

                const name = nameIdx > -1 ? cols[nameIdx] : 'Unknown';
                const email = emailIdx > -1 ? cols[emailIdx] : null;
                const tagsRaw = tagsIdx > -1 ? cols[tagsIdx] : '';
                const tags = tagsRaw ? tagsRaw.split('|').map(t => t.trim()) : [];

                contactsToInsert.push({ name, phone, email, tags });
            }

        } else if (file.name.endsWith('.vcf') || file.name.endsWith('.vcard')) {
            // Simple vCard Parser (Regex based for common formats)
            // Splitting by BEGIN:VCARD
            const cards = text.split('BEGIN:VCARD');
            for (const card of cards) {
                if (!card.trim()) continue;

                const fnMatch = card.match(/FN:(.*)/);
                const telMatch = card.match(/TEL.*:(.*)/);
                const emailMatch = card.match(/EMAIL.*:(.*)/);

                if (telMatch && telMatch[1]) {
                    contactsToInsert.push({
                        name: fnMatch ? fnMatch[1].trim() : 'Unknown',
                        phone: telMatch[1].trim(),
                        email: emailMatch ? emailMatch[1].trim() : null,
                        tags: ['imported-vcard']
                    });
                }
            }
        } else {
            return NextResponse.json({ error: "Unsupported file type. Use .csv or .vcf" }, { status: 400 });
        }

        // Batch Insert (Loop for safety/error handling per row)
        for (const c of contactsToInsert) {
            try {
                const normalized = normalizePhoneNumber(c.phone);
                // Postgres Array syntax for template literal:
                // We'll just cast strictly.

                await db.sql`
                    INSERT INTO contacts (name, phone_number, email, tags, org_id, ai_status)
                    VALUES (${c.name}, ${normalized}, ${c.email}, ${c.tags}, ${orgId}, 'active')
                    ON CONFLICT (phone_number) 
                    DO UPDATE SET name = EXCLUDED.name, email = EXCLUDED.email, tags = contacts.tags || EXCLUDED.tags
                `;
                successCount++;
            } catch (e) {
                console.error("Import Error for " + c.phone, e);
                failCount++;
            }
        }

        return NextResponse.json({
            success: true,
            imported: successCount,
            failed: failCount,
            total: contactsToInsert.length
        });

    } catch (e: any) {
        console.error("Upload Error:", e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
