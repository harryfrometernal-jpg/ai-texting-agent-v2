
import Stripe from 'stripe';

const stripeClient = process.env.STRIPE_SECRET_KEY
    ? new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2025-12-15.acacia' as any })
    : null;

export const createPaymentLink = async (customerPhone: string) => {
    if (!stripeClient) {
        console.warn("Stripe Key Missing. Using Mock Link.");
        return "https://buy.stripe.com/test_mock_link";
    }

    try {
        // 1. Create Price (Or use existing ID if you have a product catalog)
        // For dynamic "Closer" agent, we might assume a standard service fee or look it up.
        // Let's create a dynamic price for "Consultation / Service Deposit"
        const price = await stripeClient.prices.create({
            currency: 'usd',
            unit_amount: 9900, // $99.00
            product_data: {
                name: 'AI Service Deposit',
            },
        });

        // 2. Create Payment Link
        const session = await stripeClient.paymentLinks.create({
            line_items: [
                {
                    price: price.id,
                    quantity: 1,
                },
            ],
            metadata: {
                customer_phone: customerPhone
            },
            after_completion: {
                type: 'redirect',
                redirect: {
                    url: 'https://your-site.com/thank-you' // Should be env var
                }
            }
        });

        return session.url;

    } catch (e) {
        console.error("Stripe Error:", e);
        return "https://buy.stripe.com/error_fallback";
    }
};
