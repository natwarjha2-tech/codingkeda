-- AlterTable: Add avatarUrl to User
ALTER TABLE "User" ADD COLUMN "avatarUrl" TEXT;

-- AlterTable: Add createdBy to Course
ALTER TABLE "Course" ADD COLUMN "createdBy" TEXT;
