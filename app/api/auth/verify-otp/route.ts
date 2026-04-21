import { NextResponse } from 'next/server';
import * as speakeasy from 'speakeasy';

export async function POST(request: Request) {
  try {
    const { token } = await request.json();
    const rawSecret = process.env.NEXT_PUBLIC_TOTP_SECRET || 'KVKX2Z33K5SQ6GRY';
    const TOTP_SECRET = rawSecret.replace(/[^a-zA-Z2-7]/g, '').toUpperCase().slice(0, 32) || 'KVKX2Z33K5SQ6GRY';

    if (!token) {
      return NextResponse.json({ error: 'Token is required' }, { status: 400 });
    }

    // Verify against SERVER time (Server time is NTP synchronized)
    const isValid = speakeasy.totp.verify({
      secret: TOTP_SECRET,
      encoding: 'base32',
      token: token.trim(),
      window: 6 // Allow 3 minutes for time drift relative to server
    });

    if (isValid) {
      return NextResponse.json({ success: true });
    } else {
      return NextResponse.json({ success: false, error: 'Invalid token' }, { status: 401 });
    }
  } catch (error) {
    console.error('OTP Verification Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
