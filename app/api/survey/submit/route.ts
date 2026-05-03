import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { name, email, classGroup, experience, interest, recommendedCourse } = await req.json();

    if (!classGroup || !experience || !interest)
      return NextResponse.json({ message: "Survey answers are incomplete." }, { status: 400 });

    // TODO: save survey data to database
    return NextResponse.json({
      message: "Survey submitted successfully.",
      recommendation: recommendedCourse,
      data: { name, email, classGroup, experience, interest },
    }, { status: 200 });
  } catch {
    return NextResponse.json({ message: "Something went wrong." }, { status: 500 });
  }
}
