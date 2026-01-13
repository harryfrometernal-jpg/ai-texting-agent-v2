import { listEvents, createEvent } from '@/lib/services/googleCalendar';
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

interface CalendarContext {
    body: string;
    from: string;
    contactName: string;
}

export const runCalendarAgent = async (context: CalendarContext) => {
    // 1. Understand Intent & Extract Slots
    const today = new Date().toISOString();
    const prompt = `
    You are a helpful Calendar Assistant.
    Current Time: ${today}
    User Message: "${context.body}"
    Contact Name: "${context.contactName}"

    Your Goal: Determine if the user wants to "check_availability" or "book_event".
    
    If "check_availability":
    - Extract timeMin and timeMax (ISO strings). If not specified, assume "tomorrow all day".

    If "book_event":
    - Extract summary, startTime, endTime (ISO strings).

    Return ONLY a JSON object:
    {
        "action": "check_availability" | "book_event" | "clarify",
        "data": { ...params },
        "response_text": "text to explain what you are doing"
    }
    `;

    let command;

    try {
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();

        const jsonStr = text.replace(/```json/g, '').replace(/```/g, '').trim();
        command = JSON.parse(jsonStr);
    } catch (e) {
        console.error("Calendar Agent Brain Error", e);
        return "I'm having trouble understanding the date. Could you try again?";
    }

    // 2. Execute Tool
    if (command.action === 'check_availability') {
        try {
            const events = await listEvents(command.data.timeMin, command.data.timeMax);
            if (events && events.length > 0) {
                const busyTimes = events.map((e: any) => `${e.start.dateTime || e.start.date} - ${e.summary}`).join('\n');
                return `Here is what I found on the calendar:\n${busyTimes}`;
            } else {
                const calType = process.env.GOOGLE_CALENDAR_ID ? "Shared" : "Primary";
                return `The calendar (${calType}) looks clear during that time!`;
            }
        } catch (e: any) {
            return `I couldn't check availability. Error: ${e.message}`;
        }
    }

    if (command.action === 'book_event') {
        try {
            await createEvent(command.data.summary || `Meeting with ${context.contactName}`, command.data.startTime, command.data.endTime);
            return `I've booked that for you! "${command.data.summary}" at ${command.data.startTime}.`;
        } catch (e: any) {
            const calType = process.env.GOOGLE_CALENDAR_ID ? "Shared" : "Primary";
            return `I failed to book the event on ${calType} calendar. Error: ${e.message}`;
        }
    }

    return command.response_text || "I'm not sure about the time. specific dates help!";
};
