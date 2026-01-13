
export async function sendEmail(to: string, subject: string, htmlBody: string): Promise<boolean> {
    console.log(`[Email Service] Sending to ${to}...`);
    console.log(`Subject: ${subject}`);
    // In production, use Resend:
    // await resend.emails.send({ ... })

    // Simulate delay
    await new Promise(resolve => setTimeout(resolve, 500));

    console.log(`[Email Service] Sent!`);
    return true;
}
