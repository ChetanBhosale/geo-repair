import { describe, expect, test } from "bun:test"
import type { GithubRepo } from "@repo/types/github"

import {
  findAutoCreateRepoForWebsite,
  stripProtocol,
  websiteInputFromUrl,
} from "./project-handoff"

function repo(name: string, id = 1): GithubRepo {
  return {
    id,
    name,
    fullName: `ajay/${name}`,
    private: false,
    htmlUrl: `https://github.com/ajay/${name}`,
    cloneUrl: `https://github.com/ajay/${name}.git`,
    description: null,
    defaultBranch: "main",
    language: "TypeScript",
    updatedAt: "2026-06-12T00:00:00.000Z",
    owner: {
      login: "ajay",
      avatarUrl: "https://github.com/ajay.png",
    },
  }
}

describe("websiteInputFromUrl", () => {
  test("normalizes full URLs to hostnames", () => {
    expect(websiteInputFromUrl("https://www.linkrunner.io/path")).toBe(
      "www.linkrunner.io"
    )
    expect(stripProtocol(" https://linkrunner.io/path")).toBe(
      "linkrunner.io/path"
    )
  })
})

describe("findAutoCreateRepoForWebsite", () => {
  test("matches an exact product website repo", () => {
    expect(
      findAutoCreateRepoForWebsite("https://linkrunner.io", [
        repo("linkrunner-website", 1),
        repo("linkrunner-dashboard", 2),
      ])?.name
    ).toBe("linkrunner-website")
  })

  test("matches a host split by dot", () => {
    expect(
      findAutoCreateRepoForWebsite("https://geo.repair", [
        repo("geo-repair", 1),
      ])?.name
    ).toBe("geo-repair")
  })

  test("does not choose when there is no deterministic match", () => {
    expect(
      findAutoCreateRepoForWebsite("https://linkrunner.io", [
        repo("linkrunner-dashboard", 1),
      ])
    ).toBeNull()
  })
})
