
import axios from 'axios';

// Define Interface (Simplified)
export interface VapiCall {
    id: string;
    status: string;
    startedAt: string;
    endedAt: string;
    cost: number;
    customer: {
        number: string;
    };
    recordingUrl?: string;
    analysis?: {
        summary?: string;
    }
}

export const VapiService = {
    getCalls: async (): Promise<VapiCall[]> => {
        const apiKey = process.env.VAPI_PRIVATE_KEY;
        // Note: For client-side calls in Dashboard, we normally shouldn't expose Private Key.
        // Ideally checking 'process.env' in a component works in Next.js ONLY if accessing server-side or if NEXT_PUBLIC prefixed.
        // BUT, since we are doing a quick prototype, we might need a Proxy API Route (e.g. /api/vapi/calls) to keep key secret.
        // Accessing this directly from `page.tsx` (Client Component) won't work with secret vars unless we pass them or use a Server Action.
        // Let's create a Server Action or API Route. 
        // For simplicity: We will create this as a helper, but call it from a Server Component or API route.

        if (!apiKey) return [];

        try {
            const response = await axios.get('https://api.vapi.ai/call', {
                headers: { 'Authorization': `Bearer ${apiKey}` },
                params: { limit: 20 }
            });
            return response.data || [];
        } catch (error) {
            console.error("Vapi Fetch Error:", error);
            return [];
        }
    }
};
