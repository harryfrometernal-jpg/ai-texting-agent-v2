import { GoogleGenerativeAI } from "@google/generative-ai";
import { IncomingMessageContext, AgentType, VapiAssistant } from "./types";
import { db } from "@/lib/db";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export async function routeMessage(context: IncomingMessageContext): Promise<{ type: AgentType; vapiAssistantId?: string; sentiment?: string }> {
  // 0. Check for Attachments (MMS)
  // If GHL/Twilio sends "NumMedia" > 0, it's an image message
  const numMedia = parseInt((context as any).numMedia || '0');
  if (numMedia > 0) {
    console.log("Router detected MMS/Image. Routing to Vision Agent.");
    return { type: 'vision' as AgentType }; // We need to add 'vision' to AgentType
  }

  // 0.3. Check for task management patterns (daily goals, accountability, progress updates)
  // PRIORITY: Check for numbered goal lists first (common accountability responses)
  const goalListingPattern = /^\s*(\d+[\.\)]\s*.+\s*){2,}/s;  // 2+ numbered items
  const hasMultipleGoals = goalListingPattern.test(context.body);

  // Check for goal/task keywords
  const taskKeywords = [
    /(?:my|today's|daily)\s*(?:goals?|tasks?|priorities|plan)/i,
    /(?:want to|need to|going to)\s*(?:accomplish|finish|complete|do)/i,
    /(?:plan to|hoping to|trying to)/i,
    /(?:1\.|2\.|3\.|\d+\.)\s*(?!.*(?:pm|am|o'clock|hour|minute|time))/i, // numbered without time references
    /^(?:today|my goals?|priorities)/i,
    /(?:finished?|completed?|done)\s*(?:task|goal|workout|project)/i,
    /(?:task|goal)\s*(?:update|progress|status)/i,
    /(?:working on|still need)/i
  ];

  // Check if message contains time references (to avoid scheduler conflicts)
  const timeReferences = [
    /(?:at|by|around|before|after)\s*\d+/i,
    /(?:am|pm|o'clock)/i,
    /(?:morning|afternoon|evening|tonight|tomorrow|later|soon)/i,
    /(?:remind|schedule|set)/i
  ];

  const hasTimeReference = timeReferences.some(pattern => pattern.test(context.body));
  const hasTaskKeywords = taskKeywords.some(pattern => pattern.test(context.body));

  // If it has multiple numbered goals and no time references, it's definitely task management
  // If it has task keywords but time references, let AI decide later
  const isTaskMessage = hasMultipleGoals || (hasTaskKeywords && !hasTimeReference);
  if (isTaskMessage) {
    console.log("Router detected task management pattern. Routing to Task Manager.");
    return { type: 'task_manager' as AgentType, sentiment: 'neutral' };
  }

  // 0.5. Check for explicit contact manager patterns (phone numbers)
  const phonePattern = /(?:text|call|contact|reach out to|check in on|message)\s*(?:phone\s*)?(?:number\s*)?(\+?1?[-.\s]?\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4})/i;
  if (phonePattern.test(context.body)) {
    console.log("Router detected phone number pattern. Routing to Contact Manager.");
    return { type: 'contact_manager' as AgentType, sentiment: 'neutral' };
  }

  // Check for recent contact manager context to route follow-ups
  const { db } = await import("@/lib/db");
  const { normalizePhoneNumber } = await import("@/lib/utils");

  try {
    const normalizedFrom = normalizePhoneNumber(context.from);
    const { rows: contextRows } = await db.sql`
      SELECT created_at FROM admin_notifications
      WHERE contact_phone = ${normalizedFrom}
        AND type = 'contact_context'
        AND created_at > NOW() - INTERVAL '10 minutes'
      ORDER BY created_at DESC
      LIMIT 1
    `;

    if (contextRows.length > 0) {
      console.log("Router detected recent contact context. Routing to Contact Manager for follow-up.");
      return { type: 'contact_manager' as AgentType, sentiment: 'neutral' };
    }
  } catch (error) {
    console.error("Router context check error:", error);
  }

  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

  // Updated to use gemini-2.0-flash as 1.5 was unavailable for the current API key.

  // Fetch Vapi assistants to include in the prompt
  // Fetch Vapi assistants
  const { rows: assistants } = await db.sql`SELECT * FROM vapi_assistants`;
  const assistantList = assistants?.map(a => `- Name: ${a.name}, Description: ${a.description}, ID: ${a.assistant_id}`).join('\n') || "No specific Vapi agents registered.";

  const prompt = `
    You are an intelligent router for an AI texting platform.
    Your goal is to classify the user's incoming SMS into one of the following agents:
    
    1. 'knowledge': General questions about the business, services, pricing, or "who are you" type questions. (Utilizes RAG/Knowledge Base).
    2. 'calendar': Requests to schedule, check, or modify calendar events, or asking for availability.
    3. 'docs': Requests to create documents, SOPs, or write content to a file.
    4. 'vapi': Requests to have an AI CALL someone.
    5. 'followup_scheduler': Requests to set up a reminder or future follow-up.
    6. 'picasso': Requests to generate, draw, or create an image/picture/logo.
    7. 'campaigner': Requests to send mass messages, blasts, or text multiple people/tags.
    8. 'concierge': Requests to find places, restaurants, locations, or directions (Maps).
    9. 'system': Requests for "System Status", "Health Check", or "Diagnostic".
    10. 'scheduler': Requests to schedule a message/text for later. (e.g. "Remind me to text Bob tomorrow").
    11. 'zoom': Requests to create Zoom meetings, get meeting links, or video calls.
    12. 'contact_manager': Admin commands to add contacts, find contacts, or text specific people/phone numbers directly. Includes commands like "text [phone number]", "text [number] and [message]", "add contact [name] [phone]", "contact management", or any instruction to send a text to a specific phone number.
    13. 'task_manager': Responses to daily accountability prompts, task updates, goal setting, or productivity-related messages. Includes messages like setting daily goals, reporting task progress, or responding to morning accountability check-ins.

    Also analyze the user's sentiment: 'positive', 'neutral', 'negative', 'frustrated'.

    For 'vapi' (Call) requests, you must also pick the best matching Vapi Assistant ID from this list:
    ${assistantList}

    User Message: "${context.body}"
    
    Respond strictly in JSON format:
    {
      "type": "agent_type", // One of: 'knowledge', 'calendar', 'docs', 'vapi', 'followup_scheduler', 'picasso', 'campaigner', 'concierge', 'system', 'scheduler', 'zoom', 'contact_manager', 'task_manager'
      "sentiment": "sentiment_value", // 'positive', 'neutral', 'negative', 'frustrated'
      "vapiAssistantId": "id_if_vapi_agent_selected_or_null",
      "reason": "short explanation"
    }
  `;

  try {
    const result = await model.generateContent(prompt);
    const response = result.response;
    const text = response.text();
    // Clean code blocks if present
    const cleanText = text.replace(/```json/g, '').replace(/```/g, '').trim();
    const json = JSON.parse(cleanText);

    return {
      type: json.type,
      vapiAssistantId: json.vapiAssistantId,
      sentiment: json.sentiment
    };
  } catch (error) {
    console.error("Router Error:", error);
    return { type: 'general' }; // Fallback
  }
}
