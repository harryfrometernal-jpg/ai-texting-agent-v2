
import puppeteer from 'puppeteer';
import { db } from '@/lib/db';

interface Lead {
    business_name: string;
    phone: string;
    address?: string;
}

export async function runMapsScraper(niche: string, city: string, orgId: string, webhookUrl?: string): Promise<Lead[]> {
    console.log(`🗺️ Headhunter: Scraping '${niche}' in '${city}'... Webhook: ${webhookUrl ? 'ACTIVE' : 'OFF'}`);
    const browser = await puppeteer.launch({ headless: true }); // Headless for server
    const page = await browser.newPage();
    const leads: Lead[] = [];

    try {
        await page.goto(`https://www.google.com/maps/search/${niche}+in+${city}`);
        await page.setViewport({ width: 1920, height: 1080 });

        // Wait for results
        try {
            await page.waitForSelector('div[role="feed"]', { timeout: 10000 });
        } catch (e) {
            console.log("No feed found. May have 0 results.");
            await browser.close();
            return [];
        }

        // Scroll feed to load more
        for (let i = 0; i < 3; i++) {
            await page.evaluate(() => {
                const feed = document.querySelector('div[role="feed"]');
                if (feed) feed.scrollTop = feed.scrollHeight;
            });
            await new Promise(r => setTimeout(r, 2000));
        }

        // Extract Data
        const items = await page.evaluate(() => {
            const results: any[] = [];

            // Selector strategy: Maps classes change often, look for aria-labels or common structures
            const links = document.querySelectorAll('a[href*="https://www.google.com/maps/place"]');

            links.forEach((link: any) => {
                const text = link.ariaLabel; // Usually "Business Name"
                if (!text) return;

                // Simple heuristic: Phone numbers often appear in the text or aria-label of sibling buttons?
                // Actually, extraction from the list view is hard without clicking.
                // For speed/stability in this v1, we only take the name and dummy phone if not found, 
                // OR deeper: click each item.

                results.push({ business_name: text, href: link.href });
            });
            return results;
        });

        console.log(`Found ${items.length} potential leads.`);

        // Limit to 5 for speed in this demo
        for (const item of items.slice(0, 5)) {
            try {
                await page.goto(item.href);
                await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 5000 }).catch(() => { });

                // Extract Phone
                const phone = await page.evaluate(() => {
                    const buttons = Array.from(document.querySelectorAll('button'));
                    const phoneBtn = buttons.find(b => b.ariaLabel?.includes("Phone:") || (b.textContent && /\\(\\d{3}\\) \\d{3}-\\d{4}/.test(b.textContent)));
                    if (phoneBtn) {
                        return phoneBtn.ariaLabel?.replace("Phone:", "").trim() || phoneBtn.textContent?.trim();
                    }
                    return null;
                });

                if (phone) {
                    leads.push({
                        business_name: item.business_name,
                        phone: phone
                    });

                    // Add to Campaign Queue
                    // Add to Campaign Queue
                    await db.sql`
                        INSERT INTO campaign_queue (org_id, phone_number, name, status, source)
                        VALUES (${orgId}, ${phone}, ${item.business_name}, 'pending', 'headhunter_maps')
                    `;

                    // GHL Webhook Trigger
                    if (webhookUrl) {
                        try {
                            console.log(`Pushing ${item.business_name} to GHL...`);
                            await fetch(webhookUrl, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                    name: item.business_name,
                                    phone: phone,
                                    email: "", // Scraper doesn't get email yet
                                    tags: ["ai-sourced", `niche:${niche}`, `city:${city}`],
                                    niche,
                                    city
                                })
                            });
                        } catch (err) {
                            console.error("Failed to push to GHL webhook:", err);
                        }
                    }
                }
            } catch (e) { console.error("Error processing item", e); }
        }

    } catch (error) {
        console.error("Headhunter Scraper Error:", error);
    } finally {
        await browser.close();
    }

    return leads;
}
