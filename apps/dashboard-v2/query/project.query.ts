"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import type { CreateProjectRequest } from "@repo/types/project"
import {
  createProject,
  deleteProject,
  getAccounts,
  getProject,
  getProjects,
  getProjectScraping,
  getProjectScrapings,
  getRepos,
  getScraping,
  startScan,
} from "@/lib/api"

// Linked providers for the current user (used to gate the GitHub connect step).
export function useAccounts(enabled = true) {
  return useQuery({
    queryKey: ["accounts"],
    queryFn: getAccounts,
    enabled,
  })
}

export function useIsGithubConnected(enabled = true) {
  const query = useAccounts(enabled)
  return {
    ...query,
    isConnected: !!query.data?.some((a) => a.provider === "GITHUB"),
  }
}

// The user's projects (the "all projects" grid).
export function useProjects(enabled = true) {
  return useQuery({
    queryKey: ["projects"],
    queryFn: getProjects,
    enabled,
  })
}

// Repos from the linked GitHub account (for picking one when creating a project).
export function useGithubRepos(enabled = true) {
  return useQuery({
    queryKey: ["github-repos"],
    queryFn: getRepos,
    enabled,
  })
}

export function useCreateProject() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: CreateProjectRequest) => createProject(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["projects"] })
      // A scan auto-starts on create; refresh the live indicators.
      qc.invalidateQueries({ queryKey: ["worker-status"] })
    },
  })
}

export function useDeleteProject() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteProject(id),
    onSuccess: (_data, id) => {
      // Drop every cache tied to this project so a re-added repo starts clean.
      qc.removeQueries({ queryKey: ["project", id] })
      qc.removeQueries({ queryKey: ["project-scraping", id] })
      qc.removeQueries({ queryKey: ["project-scrapings", id] })
      qc.invalidateQueries({ queryKey: ["projects"] })
      qc.invalidateQueries({ queryKey: ["scraping"] })
      qc.invalidateQueries({ queryKey: ["worker-status"] })
    },
  })
}

// One project's detail.
export function useProject(id: string, enabled = true) {
  return useQuery({
    queryKey: ["project", id],
    queryFn: () => getProject(id),
    enabled: enabled && !!id,
  })
}

// Latest scraping for a project. Polls while a scan is RUNNING/QUEUED.
export function useProjectScraping(projectId: string, enabled = true) {
  return useQuery({
    queryKey: ["project-scraping", projectId],
    queryFn: () => getProjectScraping(projectId),
    enabled: enabled && !!projectId,
    refetchInterval: (query) => {
      const s = query.state.data?.status
      return s === "RUNNING" || s === "QUEUED" ? 2000 : false
    },
  })
}

// Run history for a project (newest first).
export function useProjectScrapings(projectId: string, enabled = true) {
  return useQuery({
    queryKey: ["project-scrapings", projectId],
    queryFn: () => getProjectScrapings(projectId),
    enabled: enabled && !!projectId,
  })
}

// One specific run's detail. Polls while RUNNING/QUEUED.
export function useScraping(scrapingId: string | null | undefined) {
  return useQuery({
    queryKey: ["scraping", scrapingId],
    queryFn: () => getScraping(scrapingId as string),
    enabled: !!scrapingId,
    refetchInterval: (query) => {
      const s = query.state.data?.status
      return s === "RUNNING" || s === "QUEUED" ? 2000 : false
    },
  })
}

export function useStartScan(projectId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => startScan(projectId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["project-scraping", projectId] })
      qc.invalidateQueries({ queryKey: ["project-scrapings", projectId] })
      qc.invalidateQueries({ queryKey: ["worker-status"] })
    },
  })
}
