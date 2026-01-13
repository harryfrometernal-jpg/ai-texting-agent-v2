import { NextResponse } from 'next/server';

export async function GET(req: Request) {
    try {
        // Show current auth configuration
        return NextResponse.json({
            admin_email: process.env.ADMIN_EMAIL,
            admin_password_set: !!process.env.ADMIN_PASSWORD,
            admin_password_length: process.env.ADMIN_PASSWORD?.length || 0,
            nextauth_url: process.env.NEXTAUTH_URL,
            nextauth_secret_set: !!process.env.NEXTAUTH_SECRET
        });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}