import { defineConfig } from "prisma/config";
import secrets from "@repo/secrets/backend";

// Datasource URL comes from the shared secrets package (root .env).
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: secrets.DATABASE_URL,
  },
});
