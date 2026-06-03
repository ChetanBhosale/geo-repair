import { PrismaPg } from "@prisma/adapter-pg";
import secrets from "@repo/secrets/backend";
import { PrismaClient } from "./generated/prisma/client";

const adapter = new PrismaPg({ connectionString: secrets.DATABASE_URL });

const prisma = new PrismaClient({ adapter });

export default prisma;
export { prisma };