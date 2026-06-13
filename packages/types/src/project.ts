import { z } from "zod";
import { AuthProviderSchema } from "./auth";

// A project: a user's GitHub repo paired with the website to fix.
export interface Project {
  id: string;
  slug: string;
  githubRepoId: number;
  name: string;
  fullName: string;
  owner: string;
  private: boolean;
  htmlUrl: string;
  cloneUrl: string;
  defaultBranch: string;
  description: string | null;
  language: string | null;
  websiteUrl: string | null;
  websiteVerified: boolean;
  brandName: string | null;
  faviconUrl: string | null;
  logoUrl: string | null;
  brandUpdatedAt: string | null;
  selected: boolean;
  createdAt: string;
  updatedAt: string;
}

// Payload to create a project from a repo the user picked. A repo (its fields)
// and a website URL are both required.
export const CreateProjectRequestSchema = z.object({
  githubRepoId: z.number().int(),
  name: z.string().min(1),
  fullName: z.string().min(1),
  owner: z.string().min(1),
  private: z.boolean(),
  htmlUrl: z.string().url(),
  cloneUrl: z.string().url(),
  defaultBranch: z.string().min(1),
  description: z.string().nullable().optional(),
  language: z.string().nullable().optional(),
  websiteUrl: z.string().url("Enter a valid website URL (https://...)"),
});
export type CreateProjectRequest = z.infer<typeof CreateProjectRequestSchema>;

export interface ProjectResponse {
  project: Project;
}

export interface ListProjectsResponse {
  projects: Project[];
}

// A provider linked to the current user (for "GitHub connected?" checks).
export interface LinkedAccount {
  provider: z.infer<typeof AuthProviderSchema>;
  username: string | null;
  email: string | null;
  avatarUrl: string | null;
}

export interface ListAccountsResponse {
  accounts: LinkedAccount[];
}
