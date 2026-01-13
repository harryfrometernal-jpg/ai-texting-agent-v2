import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { ContactManager } from '@/lib/agents/contact_manager';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const action = searchParams.get('action');
    const name = searchParams.get('name');

    switch (action) {
      case 'search':
        if (!name) {
          return NextResponse.json({ error: 'Missing name parameter' }, { status: 400 });
        }

        const contacts = await ContactManager.findContact(name);
        return NextResponse.json(contacts);

      case 'all':
        const { rows: allContacts } = await db.sql`
          SELECT * FROM contacts
          ORDER BY created_at DESC
          LIMIT 100
        `;
        return NextResponse.json(allContacts);

      case 'recent':
        const { rows: recentContacts } = await db.sql`
          SELECT * FROM contacts
          WHERE added_by_ai = true
          ORDER BY created_at DESC
          LIMIT 20
        `;
        return NextResponse.json(recentContacts);

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error: any) {
    console.error('Contacts API Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { action, name, phone, email, notes, tags } = body;

    switch (action) {
      case 'add':
        if (!name || !phone) {
          return NextResponse.json({ error: 'Missing name or phone' }, { status: 400 });
        }

        const contactId = await ContactManager.addContact(name, phone, false);

        // Add additional details if provided
        if (email || notes || tags) {
          await db.sql`
            UPDATE contacts
            SET
              email = ${email || null},
              notes = ${notes || null},
              tags = ${JSON.stringify(tags || [])}
            WHERE id = ${contactId}
          `;
        }

        return NextResponse.json({ contactId, success: true });

      case 'update':
        if (!body.id) {
          return NextResponse.json({ error: 'Missing contact id' }, { status: 400 });
        }

        // Update contact fields
        if (name || email || notes || tags) {
          await db.sql`
            UPDATE contacts
            SET
              name = COALESCE(${name}, name),
              email = COALESCE(${email}, email),
              notes = COALESCE(${notes}, notes),
              tags = COALESCE(${tags ? JSON.stringify(tags) : null}, tags),
              updated_at = NOW()
            WHERE id = ${body.id}
          `;
        }

        return NextResponse.json({ success: true });

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error: any) {
    console.error('Contacts API Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Missing contact id' }, { status: 400 });
    }

    await db.sql`DELETE FROM contacts WHERE id = ${id}`;
    return NextResponse.json({ success: true });

  } catch (error: any) {
    console.error('Delete Contact Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}