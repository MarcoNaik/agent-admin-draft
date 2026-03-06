import { NextResponse } from "next/server"

export const dynamic = "force-static"

export async function GET() {
  return NextResponse.redirect(new URL("/llms.txt", "https://struere.dev"))
}
