/**
 * Unit tests — app/lib/live/live-chat.ts  (O10 — chat messaging + sync)
 *
 * Mocked prisma + permissions (no real DB). Covers post validation + moderation
 * + message-type normalization + reply validation, history ordering/filter, and
 * reaction toggle semantics.
 */

jest.mock("@/app/lib/prisma", () => ({
  prisma: {
    liveClass: { findUnique: jest.fn() },
    liveParticipant: { findUnique: jest.fn() },
    liveChatMessage: { create: jest.fn(), findUnique: jest.fn(), findMany: jest.fn() },
    liveChatReaction: { findFirst: jest.fn(), create: jest.fn(), delete: jest.fn() },
    user: { findMany: jest.fn() },
  },
}));

jest.mock("@/app/lib/live/live-permissions", () => ({
  resolveJoinAccess: jest.fn(),
}));

import { prisma } from "@/app/lib/prisma";
import { resolveJoinAccess } from "@/app/lib/live/live-permissions";
import { postChatMessage, getChatMessages, toggleReaction } from "@/app/lib/live/live-chat";

const mFindClass = prisma.liveClass.findUnique as jest.MockedFunction<typeof prisma.liveClass.findUnique>;
const mFindPart = prisma.liveParticipant.findUnique as jest.MockedFunction<typeof prisma.liveParticipant.findUnique>;
const mCreateMsg = prisma.liveChatMessage.create as jest.MockedFunction<typeof prisma.liveChatMessage.create>;
const mFindMsg = prisma.liveChatMessage.findUnique as jest.MockedFunction<typeof prisma.liveChatMessage.findUnique>;
const mFindManyMsg = prisma.liveChatMessage.findMany as jest.MockedFunction<typeof prisma.liveChatMessage.findMany>;
const mFindReaction = prisma.liveChatReaction.findFirst as jest.MockedFunction<typeof prisma.liveChatReaction.findFirst>;
const mCreateReaction = prisma.liveChatReaction.create as jest.MockedFunction<typeof prisma.liveChatReaction.create>;
const mDeleteReaction = prisma.liveChatReaction.delete as jest.MockedFunction<typeof prisma.liveChatReaction.delete>;
const mUsers = prisma.user.findMany as jest.MockedFunction<typeof prisma.user.findMany>;
const mResolveJoin = resolveJoinAccess as jest.MockedFunction<typeof resolveJoinAccess>;

const CLASS = { id: "class-1", courseId: "course-1", hostUserId: "host-1" };

beforeEach(() => {
  jest.clearAllMocks();
  mFindClass.mockResolvedValue(CLASS as never);
  mUsers.mockResolvedValue([] as never);
});

// ═════════════════════════════════════════════════════════════════════════════
// postChatMessage
// ═════════════════════════════════════════════════════════════════════════════

describe("postChatMessage()", () => {
  it("400 on empty message", async () => {
    mResolveJoin.mockResolvedValue({ allowed: true, role: "student" });
    const r = await postChatMessage({ requesterId: "stu-1", requesterName: "S", liveClassId: "class-1", message: "   " });
    expect(r.status).toBe(400);
  });

  it("400 on too-long message", async () => {
    mResolveJoin.mockResolvedValue({ allowed: true, role: "student" });
    const r = await postChatMessage({
      requesterId: "stu-1", requesterName: "S", liveClassId: "class-1", message: "x".repeat(5000),
    });
    expect(r.status).toBe(400);
  });

  it("403 when access denied", async () => {
    mResolveJoin.mockResolvedValue({ allowed: false, role: "student" });
    const r = await postChatMessage({ requesterId: "out", requesterName: "O", liveClassId: "class-1", message: "hi" });
    expect(r.status).toBe(403);
  });

  it("403 when a chat-blocked student posts", async () => {
    mResolveJoin.mockResolvedValue({ allowed: true, role: "student" });
    mFindPart.mockResolvedValue({ chatBlocked: true } as never);
    const r = await postChatMessage({ requesterId: "stu-1", requesterName: "S", liveClassId: "class-1", message: "hi" });
    expect(r.status).toBe(403);
  });

  it("teacher is never chat-blocked + stores message", async () => {
    mResolveJoin.mockResolvedValue({ allowed: true, role: "teacher" });
    mCreateMsg.mockResolvedValue({
      id: "m-1", liveClassId: "class-1", senderId: "host-1", senderRole: "teacher",
      message: "hello", messageType: "TEXT", replyToMessageId: null, createdAt: new Date(),
    } as never);
    const r = await postChatMessage({ requesterId: "host-1", requesterName: "T", liveClassId: "class-1", message: "hello" });
    expect(r.ok).toBe(true);
    expect(r.data!.isMine).toBe(true);
    expect(mFindPart).not.toHaveBeenCalled(); // teacher skips the block check
  });

  it("downgrades ANNOUNCEMENT → TEXT for a student", async () => {
    mResolveJoin.mockResolvedValue({ allowed: true, role: "student" });
    mFindPart.mockResolvedValue({ chatBlocked: false } as never);
    (mCreateMsg as unknown as jest.Mock).mockImplementation((args: { data: { messageType: string } }) =>
      Promise.resolve({
        id: "m-2", liveClassId: "class-1", senderId: "stu-1", senderRole: "student",
        message: "q", messageType: args.data.messageType,
        replyToMessageId: null, createdAt: new Date(),
      })
    );
    const r = await postChatMessage({
      requesterId: "stu-1", requesterName: "S", liveClassId: "class-1", message: "q", messageType: "ANNOUNCEMENT",
    });
    expect(r.ok).toBe(true);
    expect(r.data!.messageType).toBe("TEXT");
  });

  it("ignores a reply target from a different class", async () => {
    mResolveJoin.mockResolvedValue({ allowed: true, role: "student" });
    mFindPart.mockResolvedValue({ chatBlocked: false } as never);
    mFindMsg.mockResolvedValue({ liveClassId: "OTHER-class" } as never); // foreign parent
    (mCreateMsg as unknown as jest.Mock).mockImplementation((args: { data: { replyToMessageId: string | null } }) =>
      Promise.resolve({
        id: "m-3", liveClassId: "class-1", senderId: "stu-1", senderRole: "student",
        message: "reply", messageType: "TEXT",
        replyToMessageId: args.data.replyToMessageId,
        createdAt: new Date(),
      })
    );
    const r = await postChatMessage({
      requesterId: "stu-1", requesterName: "S", liveClassId: "class-1", message: "reply", replyToMessageId: "foreign-id",
    });
    expect(r.ok).toBe(true);
    expect(r.data!.replyToMessageId).toBeNull(); // foreign reply silently dropped
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// getChatMessages
// ═════════════════════════════════════════════════════════════════════════════

describe("getChatMessages()", () => {
  it("resolves sender names + marks isMine correctly", async () => {
    mResolveJoin.mockResolvedValue({ allowed: true, role: "student" });
    mFindManyMsg.mockResolvedValue([
      { id: "m1", liveClassId: "class-1", senderId: "stu-1", senderRole: "student", message: "hi", messageType: "TEXT", replyToMessageId: null, createdAt: new Date() },
      { id: "m2", liveClassId: "class-1", senderId: "host-1", senderRole: "teacher", message: "yo", messageType: "TEXT", replyToMessageId: null, createdAt: new Date() },
    ] as never);
    mUsers.mockResolvedValue([{ id: "stu-1", name: "Student" }, { id: "host-1", name: "Teacher" }] as never);

    const r = await getChatMessages({ requesterId: "stu-1", liveClassId: "class-1" });
    expect(r.ok).toBe(true);
    expect(r.data!.messages).toHaveLength(2);
    expect(r.data!.messages[0]).toMatchObject({ senderName: "Student", isMine: true });
    expect(r.data!.messages[1]).toMatchObject({ senderName: "Teacher", isMine: false });
  });

  it("403 when access denied", async () => {
    mResolveJoin.mockResolvedValue({ allowed: false, role: "student" });
    const r = await getChatMessages({ requesterId: "out", liveClassId: "class-1" });
    expect(r.status).toBe(403);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// toggleReaction
// ═════════════════════════════════════════════════════════════════════════════

describe("toggleReaction()", () => {
  it("adds a reaction when none exists", async () => {
    mResolveJoin.mockResolvedValue({ allowed: true, role: "student" });
    mFindMsg.mockResolvedValue({ id: "m-1", liveClassId: "class-1" } as never);
    mFindReaction.mockResolvedValue(null as never);
    mCreateReaction.mockResolvedValue({ id: "r-1" } as never);
    const r = await toggleReaction({ requesterId: "stu-1", liveClassId: "class-1", messageId: "m-1", reaction: "👍" });
    expect(r.ok).toBe(true);
    expect(r.data!.reacted).toBe(true);
  });

  it("removes a reaction when it already exists (toggle off)", async () => {
    mResolveJoin.mockResolvedValue({ allowed: true, role: "student" });
    mFindMsg.mockResolvedValue({ id: "m-1", liveClassId: "class-1" } as never);
    mFindReaction.mockResolvedValue({ id: "r-1" } as never);
    mDeleteReaction.mockResolvedValue({ id: "r-1" } as never);
    const r = await toggleReaction({ requesterId: "stu-1", liveClassId: "class-1", messageId: "m-1", reaction: "👍" });
    expect(r.data!.reacted).toBe(false);
  });

  it("404 when the message belongs to another class", async () => {
    mResolveJoin.mockResolvedValue({ allowed: true, role: "student" });
    mFindMsg.mockResolvedValue({ id: "m-1", liveClassId: "OTHER" } as never);
    const r = await toggleReaction({ requesterId: "stu-1", liveClassId: "class-1", messageId: "m-1", reaction: "👍" });
    expect(r.status).toBe(404);
  });
});
