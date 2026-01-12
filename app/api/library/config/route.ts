import { NextResponse } from 'next/server';

export async function GET() {
    return NextResponse.json({
        path: process.env.LIBRARY_PATH || null
    });
}
