import { PrismaClient } from "@prisma/client";

export const db = new PrismaClient();

export async function ensureDbReady(): Promise<void> {
  // Prisma will create the SQLite file if it doesn't exist.
  // This verifies the connection is live.
  await db.$connect();
}
