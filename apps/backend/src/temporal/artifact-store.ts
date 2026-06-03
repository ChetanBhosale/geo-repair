import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export interface ArtifactRef {
  store: "file";
  key: string;
  bytes: number;
}

const ARTIFACT_DIR = path.resolve(process.cwd(), ".artifacts");

function pathForKey(key: string): string {
  const safe = key.replace(/[^a-zA-Z0-9._-]/g, "_");
  return path.join(ARTIFACT_DIR, `${safe}.json`);
}

export async function putArtifact(key: string, value: unknown): Promise<ArtifactRef> {
  const json = JSON.stringify(value);
  await mkdir(ARTIFACT_DIR, { recursive: true });
  await writeFile(pathForKey(key), json, "utf8");
  return { store: "file", key, bytes: Buffer.byteLength(json, "utf8") };
}

export async function getArtifact<T>(ref: ArtifactRef): Promise<T> {
  const json = await readFile(pathForKey(ref.key), "utf8");
  return JSON.parse(json) as T;
}
