/*
  Warnings:

  - The values [SWAP_IN,SWAP_OUT,SWAP_FEE] on the enum `TransactionType` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `idempotencyKey` on the `Transaction` table. All the data in the column will be lost.
  - You are about to drop the column `tokensInvolved` on the `Transaction` table. All the data in the column will be lost.
  - You are about to alter the column `balance` on the `Wallet` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(65,30)`.
  - You are about to alter the column `btcBalance` on the `Wallet` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(65,30)`.
  - You are about to alter the column `ethBalance` on the `Wallet` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(65,30)`.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "TransactionType_new" AS ENUM ('DEPOSIT', 'SWAP', 'WITHDRAWAL');
ALTER TABLE "Transaction" ALTER COLUMN "type" TYPE "TransactionType_new" USING ("type"::text::"TransactionType_new");
ALTER TYPE "TransactionType" RENAME TO "TransactionType_old";
ALTER TYPE "TransactionType_new" RENAME TO "TransactionType";
DROP TYPE "public"."TransactionType_old";
COMMIT;

-- DropIndex
DROP INDEX "Transaction_idempotencyKey_key";

-- AlterTable
ALTER TABLE "Transaction" DROP COLUMN "idempotencyKey",
DROP COLUMN "tokensInvolved",
ADD COLUMN     "amount" DECIMAL(65,30),
ADD COLUMN     "fee" DECIMAL(65,30),
ADD COLUMN     "tokenFrom" TEXT,
ADD COLUMN     "tokenTo" TEXT;

-- AlterTable
ALTER TABLE "Wallet" ALTER COLUMN "balance" SET DATA TYPE DECIMAL(65,30),
ALTER COLUMN "btcBalance" SET DATA TYPE DECIMAL(65,30),
ALTER COLUMN "ethBalance" SET DATA TYPE DECIMAL(65,30);
