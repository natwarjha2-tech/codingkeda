-- DropForeignKey
ALTER TABLE "Wishlist" DROP CONSTRAINT IF EXISTS "Wishlist_userId_fkey";
ALTER TABLE "Wishlist" DROP CONSTRAINT IF EXISTS "Wishlist_courseId_fkey";

-- DropTable
DROP TABLE IF EXISTS "Wishlist";
