/**
 * Model provider adapter.
 *
 * Stages 1 and 3 only need "send a system prompt plus messages, get raw text
 * back", so the pipeline is provider-agnostic. Anthropic Claude is the default
 * and the highest-quality path; Google Gemini is a free-tier alternative so an
 * open-source build can run at zero cost.
 *
 * Stage 2 never calls a model, so the scoring stays deterministic whichever
 * provider is configured — swapping providers can change what the model *sees*
 * and how it *words* things, never how the score is computed.
 */
import Anthropic from "@anthropic-ai/sdk";

export type ModelPart =
  | { type: "text"; text: string }
  | { type: "image"; url: string; mediaType: string };

export type ModelMessage = {
  role: "user" | "assistant";
  content: string | ModelPart[];
};

export type ProviderKind = "anthropic" | "google";

export type Provider = {
  kind: ProviderKind;
  /** Model id, as the provider names it. */
  model: string;
  apiKey: string;
};

export type ModelCall = {
  system: string;
  maxTokens: number;
  messages: ModelMessage[];
};

/** Upstream provider failure — the route answers 502 and never fabricates. */
export class ModelRequestError extends Error {
  readonly status: number | "network";
  constructor(status: number | "network", detail?: string) {
    super(detail ?? `model request failed (${status})`);
    this.name = "ModelRequestError";
    this.status = status;
  }
}

/** Free-tier default. Override with GOOGLE_MODEL as Google's lineup moves. */
const DEFAULT_GOOGLE_MODEL = "gemini-2.5-flash";

/** Inline image cap — Gemini takes bytes inline, so keep the payload sane. */
const MAX_INLINE_IMAGE_BYTES = 6 * 1024 * 1024;

// Temperature 0 is the required deterministic setting, but Opus 4.7+ /
// Sonnet 5 / Fable-class models reject sampling params with a 400 — omit it
// there; those models are deterministic-enough by default at this task shape.
const SAMPLING_REMOVED = /^claude-(fable-5|mythos-5|opus-5|opus-4-7|opus-4-8|sonnet-5)/;

/**
 * Which provider this deployment is configured for, or null when neither is
 * fully configured. Explicit AI_PROVIDER wins; otherwise Anthropic is preferred
 * and Google is used only when it is the sole key present.
 */
export function resolveProvider(): Provider | null {
  const explicit = process.env.AI_PROVIDER?.trim().toLowerCase();
  const googleKey = process.env.GOOGLE_API_KEY?.trim();
  const anthropicKey = process.env.ANTHROPIC_API_KEY?.trim();

  const wantsGoogle =
    explicit === "google" || (explicit === undefined && !anthropicKey && !!googleKey);

  if (wantsGoogle) {
    if (!googleKey) return null;
    return {
      kind: "google",
      model: process.env.GOOGLE_MODEL?.trim() || DEFAULT_GOOGLE_MODEL,
      apiKey: googleKey,
    };
  }

  const model = process.env.ANTHROPIC_MODEL?.trim();
  if (!anthropicKey || !model) return null;
  return { kind: "anthropic", model, apiKey: anthropicKey };
}

/**
 * One provider call. Returns the raw assistant text, or null when the model
 * refused. Schema validation and the retry loop stay with the caller so both
 * providers get identical guardrails.
 */
export async function callProvider(
  provider: Provider,
  call: ModelCall,
): Promise<string | null> {
  return provider.kind === "google"
    ? callGoogle(provider, call)
    : callAnthropic(provider, call);
}

// ------------------------------------------------------------------- anthropic

async function callAnthropic(provider: Provider, call: ModelCall): Promise<string | null> {
  const client = new Anthropic({ apiKey: provider.apiKey });
  try {
    const response = await client.messages.create({
      model: provider.model,
      max_tokens: call.maxTokens,
      system: call.system,
      messages: call.messages.map(toAnthropicMessage),
      // Structured extraction doesn't need deep deliberation, and the whole
      // pipeline must finish well inside serverless duration limits.
      output_config: { effort: "medium" },
      ...(SAMPLING_REMOVED.test(provider.model) ? {} : { temperature: 0 }),
    });
    if (response.stop_reason === "refusal") return null;
    return response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n");
  } catch (error) {
    if (error instanceof Anthropic.APIError) {
      throw new ModelRequestError(error.status ?? "network");
    }
    throw error;
  }
}

function toAnthropicMessage(message: ModelMessage): Anthropic.MessageParam {
  if (typeof message.content === "string") {
    return { role: message.role, content: message.content };
  }
  return {
    role: message.role,
    content: message.content.map((part): Anthropic.ContentBlockParam =>
      part.type === "text"
        ? { type: "text", text: part.text }
        : { type: "image", source: { type: "url", url: part.url } },
    ),
  };
}

// ---------------------------------------------------------------------- google

/**
 * Gemini cannot fetch our signed photo URLs itself, so images are inlined as
 * base64. The signed URL is short-lived and server-side only, exactly as with
 * the Anthropic path.
 */
async function callGoogle(provider: Provider, call: ModelCall): Promise<string | null> {
  const contents = await Promise.all(call.messages.map(toGoogleContent));

  const endpoint =
    "https://generativelanguage.googleapis.com/v1beta/models/" +
    encodeURIComponent(provider.model) +
    ":generateContent";

  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": provider.apiKey,
      },
      body: JSON.stringify({
        contents,
        system_instruction: { parts: [{ text: call.system }] },
        generationConfig: {
          temperature: 0,
          maxOutputTokens: call.maxTokens,
          responseMimeType: "application/json",
        },
      }),
    });
  } catch {
    throw new ModelRequestError("network");
  }

  if (!response.ok) throw new ModelRequestError(response.status);

  const body = (await response.json()) as GoogleResponse;
  const candidate = body.candidates?.[0];
  // A non-STOP finish (SAFETY, RECITATION, MAX_TOKENS) is a refusal or a
  // truncation, never a usable result — the caller must fail cleanly.
  if (!candidate || (candidate.finishReason && candidate.finishReason !== "STOP")) {
    return null;
  }
  const text = (candidate.content?.parts ?? [])
    .map((part) => part.text ?? "")
    .filter((t) => t.length > 0)
    .join("\n");
  return text.length > 0 ? text : null;
}

type GoogleResponse = {
  candidates?: Array<{
    finishReason?: string;
    content?: { parts?: Array<{ text?: string }> };
  }>;
};

async function toGoogleContent(message: ModelMessage) {
  // Gemini names the assistant turn "model".
  const role = message.role === "assistant" ? "model" : "user";
  if (typeof message.content === "string") {
    return { role, parts: [{ text: message.content }] };
  }
  const parts = await Promise.all(
    message.content.map(async (part) =>
      part.type === "text"
        ? { text: part.text }
        : {
            inline_data: {
              mime_type: part.mediaType,
              data: await fetchAsBase64(part.url),
            },
          },
    ),
  );
  return { role, parts };
}

async function fetchAsBase64(url: string): Promise<string> {
  let response: Response;
  try {
    response = await fetch(url);
  } catch {
    throw new ModelRequestError("network", "could not read photo for analysis");
  }
  if (!response.ok) throw new ModelRequestError(response.status, "could not read photo");

  const bytes = await response.arrayBuffer();
  if (bytes.byteLength > MAX_INLINE_IMAGE_BYTES) {
    throw new ModelRequestError(413, "photo too large for inline analysis");
  }
  return Buffer.from(bytes).toString("base64");
}
