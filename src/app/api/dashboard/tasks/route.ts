import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';

export async function GET(req: Request) {
    try {
        const session = await getServerSession();
        if (!session?.user?.email) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // Return empty tasks for now - basic endpoint
        return NextResponse.json({
            tasks: [],
            total: 0
        });

    } catch (error) {
        console.error('Tasks API error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const session = await getServerSession();
        if (!session?.user?.email) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await req.json();

        // Basic task creation endpoint
        return NextResponse.json({
            success: true,
            message: "Task functionality coming soon",
            task: body
        });

    } catch (error) {
        console.error('Task creation error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}