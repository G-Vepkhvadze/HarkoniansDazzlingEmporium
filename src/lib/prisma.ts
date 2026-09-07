import { PrismaClient } from "@prisma/client";

// PrismaClient is attached to the `global` object in development to prevent
// exhausting your database connection limit.
// Learn more: https://pris.ly/d/help/next-js-best-practices

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// Create Prisma client with optimized configuration for Vercel
// In Vercel serverless functions, each function invocation gets its own container,
// so we need to limit connections per instance to avoid hitting PostgreSQL's pool_size limit
const createPrismaClient = () => {
  return new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error"],
    // Configure connection pooling via the datasource URL
    // For production, we add connection pool parameters to the URL
    datasources: {
      db: {
        url: process.env.DATABASE_URL + 
             (process.env.NODE_ENV === "production" 
               ? "?pool_timeout=30&max_lifetime=60&idle_in_transaction_session_timeout=10" 
               : ""),
      },
    },
  });
};

export const prisma: PrismaClient =
  globalForPrisma.prisma ?? createPrismaClient();

// Always set global in development for hot reload support.
if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

// Recommended by Vercel to prevent connection leaks in serverless environments
// https://www.prisma.io/docs/guides/performance-and-optimization/connection-management
// Note: $on is not available in the standard PrismaClient, so we use process events instead
process.on("beforeExit", async () => {
  try {
    await prisma.$disconnect();
  } catch (error) {
    console.error("Error disconnecting Prisma client:", error);
  }
});

export default prisma;