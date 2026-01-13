
import axios from 'axios';
import { db } from '@/lib/db';

async function main() {
    const appUrl = 'http://localhost:3000';
    const remoteUrl = 'https://picsum.photos/200/300';

    console.log('🧪 Starting Ephemeral Image Verification...');

    try {
        // 1. Create Image Record
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
        const { rows } = await db.sql`
      INSERT INTO temporary_images (remote_url, expires_at)
      VALUES (${remoteUrl}, ${expiresAt})
      RETURNING id;
    `;
        const id = rows[0].id;
        console.log(`✅ Created Image Record: ${id}`);

        // 2. Test Active Link
        console.log('Testing Active Link...');
        try {
            const res = await axios.get(`${appUrl}/api/images/${id}`);
            if (res.status === 200) {
                console.log('✅ Active Link works (200 OK)');
            }
        } catch (e: any) {
            console.error('❌ Active Link Failed:', e.message);
        }

        // 3. Expire the Image
        console.log('Expiring Image...');
        await db.sql`
        UPDATE temporary_images 
        SET expires_at = NOW() - INTERVAL '1 hour'
        WHERE id = ${id}
    `;

        // 4. Test Expired Link
        console.log('Testing Expired Link...');
        try {
            await axios.get(`${appUrl}/api/images/${id}`);
            console.error('❌ Expired Link should have failed but returned 200');
        } catch (e: any) {
            if (e.response?.status === 410) {
                console.log('✅ Expired Link correctly returned 410 Gone');
            } else {
                console.error(`❌ Expired Link returned unexpected status: ${e.response?.status}`);
            }
        }

    } catch (error) {
        console.error('Test Failed:', error);
    } finally {
        process.exit(0);
    }
}

main();
