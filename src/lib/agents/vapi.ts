import axios from 'axios';
import { withRetry } from '@/lib/retry';

export async function triggerVapiCall(phoneNumber: string, assistantId: string, contextData?: { name?: string; summary?: string }) {
    const apiKey = process.env.VAPI_PRIVATE_KEY;
    if (!apiKey) {
        console.error("VAPI_PRIVATE_KEY is missing");
        return null;
    }

    if (!assistantId) {
        console.error("No Assistant ID provided for the call.");
        return null;
    }

    const payload: any = {
        assistantId: assistantId,
        customer: {
            number: phoneNumber,
            name: contextData?.name || "Valued Customer",
        },
        assistantOverrides: {
            variableValues: {
                user_name: contextData?.name || "there",
                chat_context: contextData?.summary || "No prior context available."
            }
        }
    };

    if (process.env.VAPI_PHONE_NUMBER_ID) {
        payload.phoneNumberId = process.env.VAPI_PHONE_NUMBER_ID;
    } else {
        console.warn("VAPI_PHONE_NUMBER_ID is missing. Call might fail if assistant isn't linked to a number.");
    }

    try {
        const response = await withRetry(() => axios.post(
            'https://api.vapi.ai/call',
            payload,
            {
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json'
                }
            }
        ));
        return response.data;
    } catch (error: any) {
        console.error("Vapi Call Error:", error.response?.data || error.message);
        // Do not throw, return null to allow fallback text
        return null;
    }
}
