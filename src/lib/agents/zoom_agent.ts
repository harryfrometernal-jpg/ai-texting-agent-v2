import { ZoomService } from "@/lib/services/zoom";
import { ContactManager } from "./contact_manager";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { db } from "@/lib/db";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

interface ZoomContext {
  from: string;
  body: string;
  contactName: string;
}

export async function runZoomAgent(context: ZoomContext): Promise<string> {
  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

  // Check if this is from admin
  const isAdmin = context.from === "+18569936360";

  const prompt = `
    You are a Zoom meeting assistant. Analyze the user's request and determine what they want.

    User Message: "${context.body}"
    Is Admin: ${isAdmin}
    Contact Name: ${context.contactName}

    Possible actions:
    1. "create_meeting" - User wants to create a Zoom meeting
    2. "share_link" - User wants to send a Zoom link to someone
    3. "join_info" - User wants information about joining a meeting

    For create_meeting, extract:
    - topic: Meeting topic/title
    - recipientName: Who to send the link to (if mentioned)

    Respond ONLY in JSON format:
    {
      "action": "create_meeting" | "share_link" | "join_info" | "clarify",
      "topic": "meeting topic",
      "recipientName": "person to send link to",
      "response": "what to say to the user"
    }
  `;

  try {
    const result = await model.generateContent(prompt);
    const response = result.response.text();
    const cleanText = response.replace(/```json/g, '').replace(/```/g, '').trim();
    const analysis = JSON.parse(cleanText);

    switch (analysis.action) {
      case 'create_meeting':
        return await createAndShareMeeting(
          analysis.topic || 'Quick Meeting',
          analysis.recipientName,
          context.from,
          isAdmin
        );

      case 'share_link':
        if (!isAdmin) {
          return "I can help create Zoom meetings, but only admins can share meeting links. Would you like me to create a new meeting?";
        }
        return "Please specify who you'd like to send a Zoom link to and what the meeting is about.";

      case 'join_info':
        return "To join a Zoom meeting, you'll need the meeting link or Meeting ID. If you have either, just click the link or go to zoom.us/join and enter the Meeting ID.";

      default:
        return analysis.response || "I can help create Zoom meetings and share meeting links. What would you like to do?";
    }

  } catch (error) {
    console.error("Zoom Agent Error:", error);
    return "I'm having trouble with Zoom integration right now. Please try again later.";
  }
}

async function createAndShareMeeting(
  topic: string,
  recipientName: string | null,
  requestorPhone: string,
  isAdmin: boolean
): Promise<string> {
  try {
    // Create the Zoom meeting
    const meeting = await ZoomService.createMeeting(topic);

    let response = `✅ Zoom meeting created!\n\n📋 **${topic}**\n🔗 Join: ${meeting.join_url}`;

    if (isAdmin) {
      response += `\n🎯 Start: ${meeting.start_url}`;
    }

    // If recipient is specified and this is from admin, try to send to them
    if (recipientName && isAdmin) {
      try {
        const contacts = await ContactManager.findContact(recipientName);

        if (contacts.length === 1) {
          const contact = contacts[0];

          // Send the meeting link to the contact
          const messageToContact = `Hi ${contact.name}! You're invited to a Zoom meeting.\n\n📋 **${topic}**\n🔗 Join here: ${meeting.join_url}\n\nSee you there!`;

          // Log this as an outbound message
          await db.sql`
            INSERT INTO conversation_logs (contact_phone, direction, content, agent_used)
            VALUES (${contact.phone_number}, 'outbound', ${messageToContact}, 'zoom')
          `;

          response += `\n\n📤 Meeting link sent to ${contact.name} (${contact.phone_number})`;

          // Create admin notification
          await db.sql`
            INSERT INTO admin_notifications (
              type, contact_phone, contact_name, message, priority
            ) VALUES (
              'system_alert',
              ${contact.phone_number},
              ${contact.name},
              'Zoom meeting link sent: ${topic}',
              'normal'
            )
          `;

          // TODO: Here you would integrate with your SMS/messaging service
          // to actually send the message to the contact

        } else if (contacts.length > 1) {
          response += `\n\n⚠️ Multiple contacts found for "${recipientName}". Please be more specific.`;
        } else {
          response += `\n\n❌ Contact "${recipientName}" not found. You can share the link manually.`;
        }

      } catch (error) {
        console.error("Error sending meeting to contact:", error);
        response += `\n\n⚠️ Meeting created but couldn't send to ${recipientName}. You can share the link manually.`;
      }
    }

    return response;

  } catch (error) {
    console.error("Error creating Zoom meeting:", error);
    return "❌ Failed to create Zoom meeting. Please check your Zoom integration settings.";
  }
}