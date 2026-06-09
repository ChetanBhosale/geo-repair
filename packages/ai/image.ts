import { GoogleAuth } from "google-auth-library";
import Secrets from "@repo/secrets/backend";
import { getAiClient } from "./index";
import type { AgentTool } from "./agent";

// Image generation. Two providers:
//  - "openrouter" (default): uses the SAME OPEN_ROUTER_KEY via the chat
//    completions API with modalities: ["image","text"] on an image-output model
//    (e.g. google/gemini-2.5-flash-image). No extra credentials.
//  - "vertex": Google Vertex AI Imagen :predict (needs a GCP service account).

export type ImageProvider = "openrouter" | "vertex";

export type ImageAspectRatio = "1:1" | "16:9" | "9:16" | "4:3" | "3:4";

export interface GeneratedImage {
  base64: string;
  mimeType: string;
}

export interface GenerateImageOptions {
  prompt: string;
  negativePrompt?: string;
  aspectRatio?: ImageAspectRatio;
  count?: number;
  model?: string;
  provider?: ImageProvider;
  // Vertex-only overrides.
  project?: string;
  location?: string;
}

// Default OpenRouter image-output model ("Nano Banana").
export const DEFAULT_OPENROUTER_IMAGE_MODEL = "google/gemini-2.5-flash-image";

interface OpenRouterImage {
  image_url?: { url?: string };
  type?: string;
}

function dataUrlToImage(url: string): GeneratedImage | null {
  const m = /^data:(.*?);base64,(.*)$/s.exec(url);
  if (!m) return null;
  return { base64: m[2]!, mimeType: m[1] || "image/png" };
}

// --- OpenRouter ------------------------------------------------------------

async function generateImageOpenRouter(opts: GenerateImageOptions): Promise<GeneratedImage[]> {
  const client = getAiClient();
  const prompt = opts.aspectRatio
    ? `${opts.prompt}\n\nAspect ratio: ${opts.aspectRatio}.`
    : opts.prompt;

  // The OpenAI SDK types don't model image output, so we pass `modalities` as an
  // extra field and read `message.images` off the response.
  const res = await client.chat.completions.create({
    model: opts.model ?? DEFAULT_OPENROUTER_IMAGE_MODEL,
    messages: [{ role: "user", content: prompt }],
    modalities: ["image", "text"],
  } as unknown as Parameters<typeof client.chat.completions.create>[0]);

  const msg = (res as { choices?: { message?: { images?: OpenRouterImage[] } }[] }).choices?.[0]?.message;
  const images = msg?.images ?? [];
  const out: GeneratedImage[] = [];
  for (const im of images) {
    const url = im.image_url?.url;
    const parsed = url ? dataUrlToImage(url) : null;
    if (parsed) out.push(parsed);
  }
  if (out.length === 0) {
    throw new Error("OpenRouter returned no image (the model or prompt may not support image output).");
  }
  return out;
}

// --- Vertex AI Imagen ------------------------------------------------------

const VERTEX_SCOPE = "https://www.googleapis.com/auth/cloud-platform";
let vertexAuth: GoogleAuth | null = null;

function getVertexAuth(): GoogleAuth {
  if (vertexAuth) return vertexAuth;
  const inline = Secrets.GOOGLE_VERTEX_CREDENTIALS;
  if (inline) {
    let credentials: Record<string, unknown>;
    try {
      credentials = JSON.parse(inline);
    } catch {
      throw new Error("GOOGLE_VERTEX_CREDENTIALS is not valid JSON.");
    }
    vertexAuth = new GoogleAuth({ credentials, scopes: [VERTEX_SCOPE] });
  } else {
    vertexAuth = new GoogleAuth({ scopes: [VERTEX_SCOPE] });
  }
  return vertexAuth;
}

interface VertexPredictResponse {
  predictions?: { bytesBase64Encoded?: string; mimeType?: string }[];
  error?: { message?: string };
}

async function generateImageVertex(opts: GenerateImageOptions): Promise<GeneratedImage[]> {
  const project = opts.project ?? Secrets.GOOGLE_VERTEX_PROJECT;
  const location = opts.location ?? Secrets.GOOGLE_VERTEX_LOCATION;
  const model = opts.model ?? Secrets.GOOGLE_VERTEX_IMAGE_MODEL;
  if (!project) throw new Error("GOOGLE_VERTEX_PROJECT is not set.");

  const auth = await getVertexAuth().getClient();
  const token = (await auth.getAccessToken()).token;
  if (!token) throw new Error("Could not obtain a Vertex AI access token.");

  const url = `https://${location}-aiplatform.googleapis.com/v1/projects/${project}/locations/${location}/publishers/google/models/${model}:predict`;
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      instances: [{ prompt: opts.prompt }],
      parameters: {
        sampleCount: Math.min(Math.max(opts.count ?? 1, 1), 4),
        ...(opts.aspectRatio ? { aspectRatio: opts.aspectRatio } : {}),
        ...(opts.negativePrompt ? { negativePrompt: opts.negativePrompt } : {}),
      },
    }),
  });
  const body = (await res.json().catch(() => ({}))) as VertexPredictResponse;
  if (!res.ok) {
    throw new Error(`Vertex Imagen failed (${res.status}): ${body.error?.message ?? "unknown error"}`);
  }
  const out: GeneratedImage[] = (body.predictions ?? [])
    .filter((p) => p.bytesBase64Encoded)
    .map((p) => ({ base64: p.bytesBase64Encoded!, mimeType: p.mimeType ?? "image/png" }));
  if (out.length === 0) throw new Error("Vertex Imagen returned no image.");
  return out;
}

// --- Public API ------------------------------------------------------------

// Generate image(s) from a prompt. Defaults to OpenRouter (same key you already
// use); pass provider: "vertex" to use Imagen instead.
export async function generateImage(opts: GenerateImageOptions): Promise<GeneratedImage[]> {
  const provider = opts.provider ?? "openrouter";
  return provider === "vertex" ? generateImageVertex(opts) : generateImageOpenRouter(opts);
}

export interface ImageToolOptions {
  // Persist the generated image and return a short result string for the model.
  onImage: (
    image: GeneratedImage,
    args: { prompt: string; path?: string; aspectRatio?: ImageAspectRatio },
  ) => Promise<string> | string;
  provider?: ImageProvider;
  model?: string;
}

// An AgentTool the model can call to generate an image from a prompt.
export function imageTool(opts: ImageToolOptions): AgentTool {
  return {
    name: "generate_image",
    description:
      "Generate an image from a text prompt (e.g. an Open Graph / social share image when none exists). Give a clear, detailed prompt and the repo-relative path to save the PNG to (e.g. 'public/og.png').",
    parameters: {
      type: "object",
      properties: {
        prompt: { type: "string", description: "Detailed description of the image to generate." },
        path: { type: "string", description: "Repo-relative path to save the image, e.g. public/og.png" },
        aspectRatio: {
          type: "string",
          enum: ["1:1", "16:9", "9:16", "4:3", "3:4"],
          description: "Image aspect ratio. Use 16:9 for Open Graph / social images.",
        },
        negativePrompt: { type: "string", description: "What to avoid in the image (optional)." },
      },
      required: ["prompt", "path"],
    },
    execute: async (args) => {
      const prompt = String(args.prompt ?? "");
      if (!prompt) return "Error: prompt is required.";
      const path = args.path ? String(args.path) : undefined;
      const aspectRatio = args.aspectRatio as ImageAspectRatio | undefined;
      try {
        const images = await generateImage({
          prompt,
          aspectRatio: aspectRatio ?? "16:9",
          negativePrompt: args.negativePrompt ? String(args.negativePrompt) : undefined,
          count: 1,
          provider: opts.provider,
          model: opts.model,
        });
        return await opts.onImage(images[0]!, { prompt, path, aspectRatio });
      } catch (err) {
        return `Error generating image: ${err instanceof Error ? err.message : String(err)}`;
      }
    },
  };
}
