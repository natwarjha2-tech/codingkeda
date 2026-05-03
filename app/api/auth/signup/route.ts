import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { name, email, password } = await req.json();

    if (!name || !email || !password)
      return NextResponse.json({ message: "All fields are required." }, { status: 400 });

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      return NextResponse.json({ message: "Invalid email address." }, { status: 400 });

    if (password.length < 8)
      return NextResponse.json({ message: "Password must be at least 8 characters." }, { status: 400 });

    // TODO: save user to database
    return NextResponse.json({ message: "Account created successfully.", user: { name, email } }, { status: 201 });
  } catch {
    return NextResponse.json({ message: "Something went wrong." }, { status: 500 });
  }
}
