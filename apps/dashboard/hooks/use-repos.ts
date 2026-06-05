"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import type { SelectRepoRequest } from "@repo/types/github"
import {
  getRepos,
  getSavedRepos,
  selectRepo,
  updateRepoWebsite,
} from "@/lib/api"

// Lazily fetch the user's repos. `enabled` gates the request behind the
// "Show repositories" button click.
export function useRepos(enabled: boolean) {
  return useQuery({
    queryKey: ["repos"],
    queryFn: getRepos,
    enabled,
    staleTime: 60 * 1000,
  })
}

// The user's saved (DB-persisted) repositories.
export function useSavedRepos(enabled = true) {
  return useQuery({
    queryKey: ["saved-repos"],
    queryFn: getSavedRepos,
    enabled,
  })
}

// Save the picked repo to our DB (so a sandbox can later clone + PR it).
export function useSelectRepo() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: SelectRepoRequest) => selectRepo(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["saved-repos"] })
    },
  })
}

export function useUpdateRepoWebsite() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      repositoryId,
      website,
    }: {
      repositoryId: string
      website: string
    }) => updateRepoWebsite(repositoryId, website),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["saved-repos"] })
    },
  })
}
