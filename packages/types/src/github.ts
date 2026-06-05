// A GitHub repository, trimmed to what the dashboard needs to list + pick one.
export interface GithubRepo {
  id: number;
  name: string;
  fullName: string;
  private: boolean;
  htmlUrl: string;
  cloneUrl: string;
  description: string | null;
  defaultBranch: string;
  language: string | null;
  updatedAt: string;
  owner: {
    login: string;
    avatarUrl: string;
  };
}

// GET /api/github/repos response.
export interface ListReposResponse {
  repos: GithubRepo[];
}

// Payload to save the repo the user picked (POST /api/github/repos/select).
export interface SelectRepoRequest {
  githubRepoId: number;
  name: string;
  fullName: string;
  owner: string;
  private: boolean;
  htmlUrl: string;
  cloneUrl: string;
  defaultBranch: string;
  description?: string | null;
  language?: string | null;
}

// A repository saved in our DB (what a sandbox will later clone + PR against).
export interface SavedRepository {
  id: string;
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
  selected: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SelectRepoResponse {
  repository: SavedRepository;
}

export interface ListSavedReposResponse {
  repositories: SavedRepository[];
}
