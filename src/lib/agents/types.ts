export type AgentType = 'general' | 'calendar' | 'docs' | 'vapi' | 'followup_scheduler' | 'knowledge' | 'vision' | 'picasso' | 'campaigner' | 'concierge' | 'system' | 'scheduler' | 'zoom' | 'contact_manager' | 'task_manager';

export interface AgentResponse {
    message: string;
    actionTaken?: string;
    data?: any;
}

export interface IncomingMessageContext {
    from: string;
    body: string;
    contactName: string;
    orgId?: string;
    history?: string[];
}

export interface VapiAssistant {
    id: string; // Internal DB ID
    assistant_id: string; // Vapi ID
    name: string;
    description: string;
}
