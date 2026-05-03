/**
 * Unit tests — app/lib/courses.ts
 *
 * Tests the pure recommendCourse() function — no mocks needed.
 * Covers every rule branch, boundary inputs, and return shape.
 */

import { recommendCourse, COURSES, type Course } from "@/app/lib/courses";

// ═════════════════════════════════════════════════════════════════════════════
// recommendCourse() — rule engine
// ═════════════════════════════════════════════════════════════════════════════

describe("recommendCourse()", () => {
  // ── Return shape ─────────────────────────────────────────────────────────────

  it("always returns a Course object with required fields", () => {
    const result = recommendCourse({ goal: "web" });
    expect(result).toMatchObject<Partial<Course>>({
      id: expect.any(String),
      title: expect.any(String),
      description: expect.any(String),
      level: expect.stringMatching(/^(beginner|intermediate|advanced)$/),
      tags: expect.any(Array),
    });
  });

  it("returned course id exists in the COURSES catalogue", () => {
    const result = recommendCourse({ goal: "backend" });
    const ids = COURSES.map((c) => c.id);
    expect(ids).toContain(result.id);
  });

  // ── Data / ML branch ─────────────────────────────────────────────────────────

  it("'data' in goal → data-science", () => {
    expect(recommendCourse({ goal: "data" }).id).toBe("data-science");
  });

  it("'ml' in interest → data-science", () => {
    expect(recommendCourse({ interest: "ml" }).id).toBe("data-science");
  });

  it("'ai' in goal → data-science", () => {
    expect(recommendCourse({ goal: "ai" }).id).toBe("data-science");
  });

  it("'python' in interest → data-science", () => {
    expect(recommendCourse({ interest: "python" }).id).toBe("data-science");
  });

  it("mixed data+python → data-science (highest priority)", () => {
    expect(recommendCourse({ goal: "data", interest: "python" }).id).toBe("data-science");
  });

  // ── Fullstack / Advanced branch ───────────────────────────────────────────────

  it("'fullstack' in goal → fullstack-pro", () => {
    expect(recommendCourse({ goal: "fullstack" }).id).toBe("fullstack-pro");
  });

  it("'full stack' (with space) in goal → fullstack-pro", () => {
    expect(recommendCourse({ goal: "full stack" }).id).toBe("fullstack-pro");
  });

  it("'advanced' in experience → fullstack-pro", () => {
    expect(recommendCourse({ experience: "advanced" }).id).toBe("fullstack-pro");
  });

  // ── Backend / Node branch ─────────────────────────────────────────────────────

  it("'backend' in goal → backend-nodejs", () => {
    expect(recommendCourse({ goal: "backend" }).id).toBe("backend-nodejs");
  });

  it("'api' in interest → backend-nodejs", () => {
    expect(recommendCourse({ interest: "api" }).id).toBe("backend-nodejs");
  });

  it("'server' in goal → backend-nodejs", () => {
    expect(recommendCourse({ goal: "server" }).id).toBe("backend-nodejs");
  });

  it("'node' in interest → backend-nodejs", () => {
    expect(recommendCourse({ interest: "node" }).id).toBe("backend-nodejs");
  });

  // ── React / Frontend branch ───────────────────────────────────────────────────

  it("'react' in interest → react-nextjs", () => {
    expect(recommendCourse({ interest: "react" }).id).toBe("react-nextjs");
  });

  it("'next' in interest → react-nextjs", () => {
    expect(recommendCourse({ interest: "next" }).id).toBe("react-nextjs");
  });

  it("'frontend' in goal → react-nextjs", () => {
    expect(recommendCourse({ goal: "frontend" }).id).toBe("react-nextjs");
  });

  it("'intermediate' in experience → react-nextjs", () => {
    expect(recommendCourse({ experience: "intermediate" }).id).toBe("react-nextjs");
  });

  // ── Default / Beginner branch ─────────────────────────────────────────────────

  it("empty answers → web-fundamentals (default)", () => {
    expect(recommendCourse({}).id).toBe("web-fundamentals");
  });

  it("completely unknown keywords → web-fundamentals", () => {
    expect(recommendCourse({ goal: "xyz", experience: "abc", interest: "zzz" }).id).toBe(
      "web-fundamentals"
    );
  });

  it("'beginner' alone → web-fundamentals (not matched by any higher rule)", () => {
    expect(recommendCourse({ experience: "beginner" }).id).toBe("web-fundamentals");
  });

  // ── Priority order (data > fullstack > backend > react > default) ─────────────

  it("data + fullstack → data-science wins (highest priority)", () => {
    expect(recommendCourse({ goal: "data fullstack" }).id).toBe("data-science");
  });

  it("fullstack + backend → fullstack-pro wins over backend", () => {
    expect(recommendCourse({ goal: "fullstack backend" }).id).toBe("fullstack-pro");
  });

  it("backend + react → backend-nodejs wins over react", () => {
    expect(recommendCourse({ goal: "backend react" }).id).toBe("backend-nodejs");
  });

  // ── Case insensitivity ────────────────────────────────────────────────────────

  it("uppercase 'BACKEND' is matched correctly", () => {
    expect(recommendCourse({ goal: "BACKEND" }).id).toBe("backend-nodejs");
  });

  it("mixed case 'DataScience' is matched correctly", () => {
    expect(recommendCourse({ goal: "DataScience" }).id).toBe("data-science");
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// COURSES catalogue integrity
// ═════════════════════════════════════════════════════════════════════════════

describe("COURSES catalogue", () => {
  it("contains exactly 5 courses", () => {
    expect(COURSES).toHaveLength(5);
  });

  it("every course has a unique id", () => {
    const ids = COURSES.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("every course has non-empty title and description", () => {
    COURSES.forEach((c) => {
      expect(c.title.trim()).not.toBe("");
      expect(c.description.trim()).not.toBe("");
    });
  });

  it("every course level is one of beginner | intermediate | advanced", () => {
    const valid = ["beginner", "intermediate", "advanced"];
    COURSES.forEach((c) => {
      expect(valid).toContain(c.level);
    });
  });

  it("every course has at least one tag", () => {
    COURSES.forEach((c) => {
      expect(c.tags.length).toBeGreaterThan(0);
    });
  });

  it("contains expected course ids", () => {
    const ids = COURSES.map((c) => c.id);
    expect(ids).toEqual(
      expect.arrayContaining([
        "web-fundamentals",
        "react-nextjs",
        "backend-nodejs",
        "fullstack-pro",
        "data-science",
      ])
    );
  });
});
