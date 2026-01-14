import { db } from "@/lib/db";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { GoalTracker } from "./goal_tracker";
import { normalizePhoneNumber } from "@/lib/utils";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export interface ContactCommand {
  action: 'text_contact' | 'add_contact' | 'find_contact' | 'confirm_contact' | 'check_status' | 'text_phone';
  contactName?: string;
  contactPhone?: string;
  goalDescription?: string;
  goalType?: string;
  pendingContactId?: string;
  message?: string;
}

export class ContactManager {
  // Store recent contact context for follow-up messages
  static async storeContactContext(adminPhone: string, contactPhone: string): Promise<void> {
    try {
      // First delete any existing context for this admin to avoid duplicates
      await db.sql`
        DELETE FROM admin_notifications
        WHERE contact_phone = ${adminPhone} AND type = 'contact_context'
      `;

      // Insert new context
      await db.sql`
        INSERT INTO admin_notifications (
          type, contact_phone, message, priority
        ) VALUES (
          'contact_context',
          ${adminPhone},
          ${`Last contacted: ${contactPhone}`},
          'low'
        )
      `;

      console.log('✅ ContactManager: Stored context for', adminPhone, 'contacting', contactPhone);
    } catch (error) {
      console.error("❌ Error storing contact context:", error);
    }
  }

  // Get recent contact context for follow-up detection
  static async getRecentContactContext(adminPhone: string): Promise<string | null> {
    try {
      console.log('🔍 ContactManager: Looking for context for admin', adminPhone);

      const { rows } = await db.sql`
        SELECT message, created_at FROM admin_notifications
        WHERE contact_phone = ${adminPhone}
          AND type = 'contact_context'
          AND created_at > NOW() - INTERVAL '10 minutes'
        ORDER BY created_at DESC
        LIMIT 1
      `;

      console.log('🔍 ContactManager: Found', rows.length, 'context records');

      if (rows.length > 0) {
        console.log('🔍 ContactManager: Context message:', rows[0].message);
        const message = rows[0].message;
        const phoneMatch = message.match(/Last contacted: (\+?\d+)/);
        const extractedPhone = phoneMatch ? phoneMatch[1] : null;
        console.log('🔍 ContactManager: Extracted phone:', extractedPhone);
        return extractedPhone;
      }
      return null;
    } catch (error) {
      console.error("❌ Error getting contact context:", error);
      return null;
    }
  }

  // Parse admin commands for contact management
  static async parseCommand(adminPhone: string, message: string): Promise<ContactCommand | null> {
    // Normalize the incoming phone number first
    const normalizedAdminPhone = normalizePhoneNumber(adminPhone);

    console.log('🔍 ContactManager: Checking admin access', {
      originalPhone: adminPhone,
      normalizedPhone: normalizedAdminPhone,
      message: message.substring(0, 50) + '...'
    });

    // Check if this is from an admin (whitelisted user)
    const { rows: adminCheck } = await db.sql`
      SELECT id, phone_number, role FROM whitelist WHERE phone_number = ${normalizedAdminPhone} LIMIT 1
    `;

    console.log('🔍 ContactManager: Admin check result', {
      normalizedPhone: normalizedAdminPhone,
      foundRecords: adminCheck.length,
      adminData: adminCheck[0] || null
    });

    if (adminCheck.length === 0) {
      console.log('❌ ContactManager: Phone not found in whitelist');
      return null; // Not an admin
    }

    console.log('✅ ContactManager: Admin access confirmed');

    // Check for follow-up message pattern first
    const recentContactPhone = await this.getRecentContactContext(normalizedAdminPhone);

    if (recentContactPhone) {
      console.log('🔍 ContactManager: Found recent contact context:', recentContactPhone);

      // Check if this message looks like a follow-up (not a new command)
      const isFollowUpMessage = !message.toLowerCase().includes('text') &&
                               !message.toLowerCase().includes('add contact') &&
                               !message.toLowerCase().includes('find') &&
                               message.length > 5; // Allow shorter messages for follow-ups

      if (isFollowUpMessage) {
        console.log('✅ ContactManager: Detected follow-up message to', recentContactPhone);
        return {
          action: 'text_phone',
          contactPhone: recentContactPhone,
          message: message.trim(),
          goalDescription: 'Follow-up message'
        };
      }
    }

    // Check if this is just a phone number (setup for next message)
    const phoneOnlyPattern = /^(\+?1?[-.\s]?\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4})$/;
    if (phoneOnlyPattern.test(message.trim())) {
      console.log('📱 ContactManager: Detected phone number only, storing context');
      const phoneNumber = normalizePhoneNumber(message.trim());
      await this.storeContactContext(normalizedAdminPhone, phoneNumber);
      return {
        action: 'confirm_contact',
        contactPhone: phoneNumber,
        message: 'Phone number noted. Send your message next.'
      };
    }

    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

    const prompt = `
      You are analyzing an admin command for contact management in an AI texting system.

      Admin Message: "${message}"

      Determine if this is a contact management command and extract the relevant information.

      Possible command types:
      1. "text_contact" - Admin wants to text someone by name (e.g., "text John about booking a call")
      2. "text_phone" - Admin wants to text a specific phone number directly (e.g., "text 8566883958 and check in on them")
      3. "add_contact" - Admin wants to add a new contact (e.g., "add contact John Smith 555-123-4567")
      4. "find_contact" - Admin wants to find/confirm a contact (e.g., "who is John?")
      5. "check_status" - Admin wants to know goal progress of a contact (e.g., "status of John", "how is the lead doing?")
      6. "confirm_contact" - Just confirming/noting a phone number for future use

      For text_contact commands, extract:
      - contactName: The name of the person to text
      - goalDescription: What the goal of the text conversation should be
      - goalType: book_call, get_info, schedule_meeting, or custom

      For text_phone commands, extract:
      - contactPhone: The phone number to text
      - message: The specific message to send
      - goalDescription: What the goal of the text conversation should be

      For add_contact commands, extract:
      - contactName: Full name
      - contactPhone: Phone number

      Respond ONLY in JSON format:
      {
        "action": "text_contact" | "text_phone" | "add_contact" | "find_contact" | "check_status" | "confirm_contact" | null,
        "contactName": "extracted name",
        "contactPhone": "extracted phone number",
        "message": "extracted message to send",
        "goalDescription": "extracted goal description",
        "goalType": "book_call" | "get_info" | "schedule_meeting" | "custom"
      }

      If this is not a contact management command, return {"action": null}
    `;

    try {
      const result = await model.generateContent(prompt);
      const response = result.response.text();
      const cleanText = response.replace(/```json/g, '').replace(/```/g, '').trim();
      const command = JSON.parse(cleanText);

      return command.action ? command : null;
    } catch (error) {
      console.error("Error parsing contact command:", error);
      return null;
    }
  }

  // Find contact by name (fuzzy search)
  static async findContact(name: string): Promise<any[]> {
    try {
      // First try exact match from contacts table
      const { rows: exactMatches } = await db.sql`
        SELECT *, 'contacts' as source FROM contacts
        WHERE LOWER(name) = LOWER(${name})
        ORDER BY created_at DESC
      `;

      if (exactMatches.length > 0) {
        return exactMatches;
      }

      // Try partial match from contacts table
      const { rows: partialMatches } = await db.sql`
        SELECT *, 'contacts' as source FROM contacts
        WHERE LOWER(name) LIKE ${'%' + name.toLowerCase() + '%'}
        ORDER BY created_at DESC
        LIMIT 5
      `;

      if (partialMatches.length > 0) {
        return partialMatches;
      }

      // Try whitelisted numbers with names
      return []; // Removed whitelist fallback as it is now contacts
    } catch (error) {
      console.error("Error finding contact:", error);
      return [];
    }
  }

  // Add new contact
  static async addContact(name: string, phone: string, addedByAi: boolean = true): Promise<string> {
    try {
      const normalizedPhone = normalizePhoneNumber(phone);

      // Check if contact already exists
      const { rows: existing } = await db.sql`
        SELECT id FROM contacts WHERE phone_number = ${normalizedPhone}
      `;

      if (existing.length > 0) {
        throw new Error(`Contact with phone ${phone} already exists`);
      }

      // Add to contacts table
      const { rows: newContact } = await db.sql`
        INSERT INTO contacts (name, phone_number)
        VALUES (${name}, ${normalizedPhone})
        ON CONFLICT (phone_number) DO UPDATE SET name = ${name}
        RETURNING id
      `;

      // Create admin notification
      await db.sql`
        INSERT INTO admin_notifications (
          type, contact_phone, contact_name, message, priority
        ) VALUES (
          'contact_added',
          ${normalizedPhone},
          ${name},
          'New contact added: ${name} (${phone})',
          'normal'
        )
      `;

      return newContact[0].id;
    } catch (error) {
      console.error("Error adding contact:", error);
      throw error;
    }
  }

  // Process contact management command
  static async processCommand(command: ContactCommand, adminPhone?: string): Promise<string> {
    try {
      switch (command.action) {
        case 'add_contact':
          if (!command.contactName || !command.contactPhone) {
            return "Please provide both name and phone number. Example: 'add contact John Smith 555-123-4567'";
          }

          try {
            await this.addContact(command.contactName, command.contactPhone, true);
            return `✅ Contact added: ${command.contactName} (${command.contactPhone})`;
          } catch (error: any) {
            return `❌ Error adding contact: ${error.message}`;
          }

        case 'find_contact':
          if (!command.contactName) {
            return "Please provide a name to search for.";
          }

          const contacts = await this.findContact(command.contactName);
          if (contacts.length === 0) {
            return `❌ No contacts found matching "${command.contactName}"`;
          }

          return "📋 Found contacts:\n" + contacts
            .map(contact => `• ${contact.name} (${contact.phone_number})`)
            .join('\n');

        case 'check_status':
          if (!command.contactName) return "Please provide a name.";
          const sContacts = await this.findContact(command.contactName);
          if (sContacts.length === 0) return `❌ Contact "${command.contactName}" not found.`;
          if (sContacts.length > 1) return `🤔 Multiple matches for "${command.contactName}". Please be more specific.`;

          return await GoalTracker.getContactGoalStatus(sContacts[0].phone_number);

        case 'text_contact':
          return await this.initiateContactText(command);

        case 'text_phone':
          return await this.sendDirectMessage(command, adminPhone);

        case 'confirm_contact':
          // Store context for follow-up messages
          if (adminPhone && command.contactPhone) {
            await this.storeContactContext(adminPhone, command.contactPhone);
          }
          return `📱 Phone number ${command.contactPhone} noted. Send your message next and I'll deliver it to them.`;

        default:
          return "❌ Unknown contact command.";
      }
    } catch (error) {
      console.error("Error processing contact command:", error);
      return "❌ Error processing command.";
    }
  }

  // Initiate text conversation with contact
  static async initiateContactText(command: ContactCommand): Promise<string> {
    if (!command.contactName || !command.goalDescription) {
      return "Please provide contact name and goal. Example: 'text John about booking a call'";
    }

    // Find the contact
    const contacts = await this.findContact(command.contactName);

    if (contacts.length === 0) {
      return `❌ Contact "${command.contactName}" not found. Would you like me to add them first?`;
    }

    if (contacts.length > 1) {
      return "🤔 Multiple contacts found:\n" + contacts
        .map((contact, i) => `${i + 1}. ${contact.name} (${contact.phone_number})`)
        .join('\n') + "\n\nPlease be more specific or use the exact phone number.";
    }

    const contact = contacts[0];

    // Create goal for this conversation
    try {
      const goalId = await GoalTracker.createGoal({
        contact_phone: contact.phone_number,
        contact_name: contact.name,
        goal_description: command.goalDescription,
        goal_type: command.goalType || 'custom'
      });

      // Create a notification that we're about to start texting
      await db.sql`
        INSERT INTO admin_notifications (
          type, contact_phone, contact_name, message, priority
        ) VALUES (
          'system_alert',
          ${contact.phone_number},
          ${contact.name},
          'Goal-based conversation initiated: ${command.goalDescription}',
          'normal'
        )
      `;

      return `✅ Goal set for ${contact.name} (${contact.phone_number}): "${command.goalDescription}"\n\nThe AI will now text them with this goal in mind. You'll receive updates as the conversation progresses.`;

    } catch (error) {
      console.error("Error creating goal:", error);
      return "❌ Error setting up goal for contact.";
    }
  }

  // Send direct message to a phone number
  static async sendDirectMessage(command: ContactCommand, adminPhone?: string): Promise<string> {
    if (!command.contactPhone || !command.message) {
      return "Please provide both phone number and message.";
    }

    const normalizedPhone = normalizePhoneNumber(command.contactPhone);

    try {
      // Get the outbound webhook URL from organization settings
      const { rows: orgRows } = await db.sql`
        SELECT ghl_webhook_url FROM organizations
        WHERE ghl_webhook_url IS NOT NULL
        ORDER BY created_at ASC
        LIMIT 1
      `;

      const OUTBOUND_WEBHOOK_URL = orgRows[0]?.ghl_webhook_url || process.env.GHL_OUTBOUND_WEBHOOK_URL;

      if (!OUTBOUND_WEBHOOK_URL) {
        return "❌ SMS sending is not configured. Please contact your administrator.";
      }

      // Import axios dynamically
      const axios = (await import('axios')).default;

      // Send message to the contact
      await axios.post(OUTBOUND_WEBHOOK_URL, {
        phone: normalizedPhone,
        message: command.message,
        source: 'contact_manager_direct'
      });

      // Send confirmation message to the admin
      if (adminPhone) {
        const adminConfirmation = `✅ Message delivered to ${normalizedPhone}: "${command.message}"${command.goalDescription ? `\n\nGoal: ${command.goalDescription}` : ''}`;

        await axios.post(OUTBOUND_WEBHOOK_URL, {
          phone: adminPhone,
          message: adminConfirmation,
          source: 'admin_confirmation'
        });

        // Store contact context for follow-up messages
        await this.storeContactContext(adminPhone, normalizedPhone);
      }

      return `✅ Message sent to ${normalizedPhone}: "${command.message}"${command.goalDescription ? `\n\nGoal set: ${command.goalDescription}` : ''}`;

    } catch (error: any) {
      console.error("Error sending direct message:", error);
      return `❌ Failed to send message: ${error.message || 'Unknown error'}`;
    }
  }

  // Smart contact lookup for AI (when user mentions a name)
  static async smartContactLookup(phoneNumber: string, mentionedName: string): Promise<string | null> {
    // This is used when the AI detects someone mentioning a name and needs to find their contact info
    const contacts = await this.findContact(mentionedName);

    if (contacts.length === 1) {
      return contacts[0].phone_number;
    }

    if (contacts.length > 1) {
      // Create admin notification to resolve ambiguity
      await db.sql`
        INSERT INTO admin_notifications (
          type, contact_phone, message, priority
        ) VALUES (
          'system_alert',
          ${phoneNumber},
          'Ambiguous contact reference: "${mentionedName}". Multiple matches found.',
          'normal'
        )
      `;
    }

    return null;
  }
}