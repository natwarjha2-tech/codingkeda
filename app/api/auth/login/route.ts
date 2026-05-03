import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();

    if (!email || !password)
      return NextResponse.json({ message: "Email and password are required." }, { status: 400 });

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      return NextResponse.json({ message: "Invalid email address." }, { status: 400 });

    // TODO: verify credentials against database
    // Mock: accept any valid email/password for now
    return NextResponse.json({ message: "Login successful.", user: { email } }, { status: 200 });
  } catch {
    return NextResponse.json({ message: "Something went wrong." }, { status: 500 });
  }
}
