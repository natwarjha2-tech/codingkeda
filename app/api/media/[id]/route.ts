import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { getSignedFileUrl } from "@/app/lib/s3";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const signed = req.nextUrl.searchParams.get("signed") === "true";

    const media = await prisma.media.findUnique({
      where: { id, isActive: true },
    });

    if (!media) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const url = signed ? await getSignedFileUrl(media.s3Key) : media.s3Url;

    return NextResponse.json({ ...media, url });
  } catch (error) {
    console.error("Media fetch error:", error);
    return NextResponse.json({ error: "Failed to fetch media" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    await prisma.media.update({
      where: { id },
      data: { isActive: false },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Media delete error:", error);
    return NextResponse.json({ error: "Failed to delete media" }, { status: 500 });
  }
}
