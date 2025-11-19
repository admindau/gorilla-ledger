import { NextResponse } from "next/server";
import { sendWelcome } from "@/app/actions/sendWelcome";

export async function POST(request: Request) {
  try {
    const { email } = await request.json();

    if (!email || typeof email !== "string") {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    // fire and forget – we don't want signup UX to block on email
    await sendWelcome(email);

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err) {
    console.error("[send-welcome] error:", err);
    // still respond ok so we don't leak anything to the user
    return NextResponse.json({ ok: true }, { status: 200 });
  }
}
