import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { getSignedFileUrl } from "@/app/lib/s3";
import { MediaType, Prisma } from "@prisma/client";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const type = searchParams.get("type")?.toUpperCase() as MediaType | null;
    const tag = searchParams.get("tag");
    const search = searchParams.get("search");
    const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
    const limit = Math.min(50, parseInt(searchParams.get("limit") || "20"));
    const signed = searchParams.get("signed") === "true"; // return signed URLs

    const where: Prisma.MediaWhereInput = {
      isActive: true,
      ...(type && Object.values(MediaType).includes(type) && { type }),
      ...(tag && { tags: { has: tag } }),
      ...(search && {
        OR: [
          { title: { contains: search, mode: "insensitive" } },
          { description: { contains: search, mode: "insensitive" } },
          { tags: { has: search } },
        ],
      }),
    };

    const [items, total] = await Promise.all([
      prisma.media.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          title: true,
          description: true,
          fileName: true,
          fileSize: true,
          mimeType: true,
          type: true,
          s3Key: true,
          s3Url: true,
          tags: true,
          createdAt: true,
        },
      }),
      prisma.media.count({ where }),
    ]);

    const data = signed
      ? await Promise.all(
          items.map(async (item) => ({
            ...item,
            url: await getSignedFileUrl(item.s3Key),
          }))
        )
      : items.map((item) => ({ ...item, url: item.s3Url }));

    return NextResponse.json({
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Media fetch error:", error);
    return NextResponse.json({ error: "Failed to fetch media" }, { status: 500 });
  }
}
