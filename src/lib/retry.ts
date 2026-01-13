/**
 * Retries a promise-returning function with exponential backoff.
 * @param fn The function to execute.
 * @param retries Maximum number of retries (default: 3).
 * @param delay Initial delay in ms (default: 1000).
 */
export async function withRetry<T>(fn: () => Promise<T>, retries = 3, delay = 1000): Promise<T> {
    try {
        return await fn();
    } catch (error) {
        if (retries <= 0) throw error;

        console.warn(`[RetryGuard] Operation failed. Retrying in ${delay}ms... (${retries} left)`);
        await new Promise(res => setTimeout(res, delay));

        return withRetry(fn, retries - 1, delay * 2);
    }
}
