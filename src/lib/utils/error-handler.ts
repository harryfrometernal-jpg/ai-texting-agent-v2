import { AdminNotificationService } from '@/lib/services/admin_notifications';

export interface ErrorContext {
  from: string;
  orgId?: string;
  agent?: string;
  originalMessage?: string;
}

export class ErrorHandler {
  static async handleAgentError(
    error: Error | any,
    context: ErrorContext,
    fallbackMessage?: string
  ): Promise<string> {
    const errorMessage = error?.message || 'Unknown error occurred';
    const timestamp = new Date().toISOString();

    console.error(`[Agent Error] ${context.agent}:`, {
      error: errorMessage,
      from: context.from,
      orgId: context.orgId,
      timestamp,
      stack: error?.stack
    });

    // For critical agents, alert admin
    const criticalAgents = ['vapi', 'calendar', 'goal_tracker'];
    if (context.agent && criticalAgents.includes(context.agent)) {
      await AdminNotificationService.createNotification(
        'system_alert',
        `🚨 ${context.agent} agent failure: ${errorMessage}`,
        'high',
        context.from,
        undefined,
        true,
        context.orgId
      );
    }

    // Return user-friendly message
    if (fallbackMessage) {
      return fallbackMessage;
    }

    switch (context.agent) {
      case 'calendar':
        return "I'm having trouble accessing the calendar right now. Please try again in a moment or contact support.";
      case 'vapi':
        return "I can't place calls at the moment. A team member will reach out to you directly.";
      case 'vision':
        return "I'm having trouble processing images right now. Please try again later.";
      case 'docs':
        return "I can't create documents at the moment. Please try again or contact support.";
      case 'zoom':
        return "I'm having trouble creating Zoom meetings right now. Please try again later.";
      default:
        return "I encountered an issue processing your request. Please try again or a team member will help you shortly.";
    }
  }

  static async handleCriticalError(
    error: Error | any,
    context: ErrorContext
  ): Promise<void> {
    console.error(`[Critical Error]:`, {
      error: error?.message,
      from: context.from,
      orgId: context.orgId,
      timestamp: new Date().toISOString(),
      stack: error?.stack
    });

    // Always alert admin for critical errors
    await AdminNotificationService.createNotification(
      'system_alert',
      `🚨 CRITICAL: System error in webhook - ${error?.message || 'Unknown error'}`,
      'urgent',
      context.from,
      undefined,
      true,
      context.orgId
    );
  }

  static async retryWithBackoff<T>(
    operation: () => Promise<T>,
    maxRetries: number = 3,
    baseDelay: number = 1000
  ): Promise<T> {
    let lastError: any;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;

        if (attempt === maxRetries) {
          throw lastError;
        }

        const delay = baseDelay * Math.pow(2, attempt);
        console.log(`Retry attempt ${attempt + 1}/${maxRetries + 1} after ${delay}ms delay`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    throw lastError;
  }
}