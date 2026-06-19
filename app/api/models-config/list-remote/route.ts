import { NextResponse } from "next/server";
import { mkdtempSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { AuthStorage, ModelRegistry } from "@earendil-works/pi-coding-agent";

export const dynamic = "force-dynamic";

const FETCH_TIMEOUT_MS = 15_000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** Strip a trailing slash so we can append /models or /v1/models cleanly. */
function stripTrailingSlash(url: string): string {
  return url.replace(/\/+$/, "");
}

/** Heuristic: is a header value a plain literal or an env-var reference? */
function resolveHeaderValue(value: string, providerEnv?: Record<string, string>): string {
  if (value.startsWith("$")) {
    const key = value.slice(1);
    return providerEnv?.[key] ?? process.env[key] ?? "";
  }
  return value;
}

interface RemoteModel {
  id: string;
  name?: string;
}

interface ListAttempt {
  url: string;
  status?: number;
  error?: string;
}

/**
 * Try to fetch the OpenAI-compatible /models endpoint. Some providers expose
 * /v1/models, some expose /models directly under their baseUrl. We try both.
 */
async function tryListModels(
  baseUrl: string,
  apiKey: string,
  headers: Record<string, string> | undefined,
  signal: AbortSignal,
): Promise<{ ok: true; models: RemoteModel[]; url: string } | { ok: false; attempts: ListAttempt[] }> {
  const trimmed = stripTrailingSlash(baseUrl);
  const candidates: string[] = [];
  // If the user already pointed us at /v1, only that path; otherwise try both.
  if (/\/v\d+$/.test(trimmed)) {
    candidates.push(`${trimmed}/models`);
  } else {
    candidates.push(`${trimmed}/models`);
    candidates.push(`${trimmed}/v1/models`);
  }

  const attempts: ListAttempt[] = [];
  for (const url of candidates) {
    try {
      const response = await fetch(url, {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${apiKey}`,
          ...(headers ?? {}),
        },
        signal,
      });
      if (!response.ok) {
        attempts.push({ url, status: response.status, error: `HTTP ${response.status}` });
        continue;
      }
      const body = (await response.json()) as unknown;
      const list = extractModelList(body);
      if (list.length === 0) {
        attempts.push({ url, status: response.status, error: "Empty model list" });
        continue;
      }
      return { ok: true, models: list, url };
    } catch (error) {
      attempts.push({ url, error: errorMessage(error) });
    }
  }
  return { ok: false, attempts };
}

/**
 * Pull the {id, name?} pairs out of a remote /models response.
 * Supports OpenAI shape ({data:[{id}]}) and a couple of common variants.
 */
function extractModelList(body: unknown): RemoteModel[] {
  const seen = new Set<string>();
  const out: RemoteModel[] = [];
  const push = (raw: unknown) => {
    if (!isRecord(raw)) return;
    const id = typeof raw.id === "string" ? raw.id : typeof raw.model === "string" ? raw.model : "";
    if (!id || seen.has(id)) return;
    seen.add(id);
    const name = typeof raw.name === "string" ? raw.name : typeof raw.display_name === "string" ? raw.display_name : undefined;
    out.push({ id, name });
  };

  if (isRecord(body)) {
    if (Array.isArray(body.data)) body.data.forEach(push);
    else if (Array.isArray(body.models)) body.models.forEach(push);
    else if (Array.isArray(body.result)) body.result.forEach(push);
  } else if (Array.isArray(body)) {
    body.forEach(push);
  }
  out.sort((a, b) => a.id.localeCompare(b.id));
  return out;
}

export async function POST(req: Request) {
  let tempDir: string | undefined;
  try {
    const body = (await req.json()) as { providerName?: unknown; provider?: unknown };
    const providerName = typeof body.providerName === "string" ? body.providerName.trim() : "";
    if (!providerName) return NextResponse.json({ ok: false, error: "providerName is required" }, { status: 400 });
    if (!isRecord(body.provider)) return NextResponse.json({ ok: false, error: "provider is required" }, { status: 400 });

    const baseUrl = typeof body.provider.baseUrl === "string" ? body.provider.baseUrl.trim() : "";
    if (!baseUrl) {
      return NextResponse.json({
        ok: false,
        error: "Provider has no baseUrl. Auto-fetch only works for OpenAI-compatible providers with a configured baseUrl.",
      });
    }

    // Resolve the API key: prefer the (possibly unsaved) inline value the user
    // is editing in the UI, fall back to AuthStorage entries persisted earlier.
    let apiKey = typeof body.provider.apiKey === "string" ? body.provider.apiKey.trim() : "";
    let providerEnv: Record<string, string> | undefined;

    if (!apiKey) {
      // Build an isolated registry pointed at a temp models.json so we can
      // resolve auth via the same code path the agent uses without polluting
      // global config.
      tempDir = mkdtempSync(join(tmpdir(), "pi-web-list-models-"));
      const modelsPath = join(tempDir, "models.json");
      writeFileSync(
        modelsPath,
        JSON.stringify({
          providers: {
            [providerName]: { ...body.provider, models: [{ id: "__probe__" }] },
          },
        }),
        "utf8",
      );

      const authStorage = AuthStorage.create();
      const registry = ModelRegistry.create(authStorage, modelsPath);
      const loadError = registry.getError();
      if (loadError) return NextResponse.json({ ok: false, error: loadError });
      const probeModel = registry.find(providerName, "__probe__");
      if (probeModel) {
        const auth = await registry.getApiKeyAndHeaders(probeModel);
        if (auth.ok && auth.apiKey) apiKey = auth.apiKey;
      }
      providerEnv = authStorage.getProviderEnv(providerName);
    }

    if (!apiKey) {
      return NextResponse.json({
        ok: false,
        error: `No API key found for "${providerName}". Save the provider with an API key first, then try again.`,
      });
    }

    // Resolve any header values that look like $ENV references the same way
    // pi does at request time.
    const headers: Record<string, string> = {};
    if (isRecord(body.provider.headers)) {
      for (const [name, value] of Object.entries(body.provider.headers)) {
        if (typeof value !== "string") continue;
        const resolved = resolveHeaderValue(value, providerEnv);
        if (resolved) headers[name] = resolved;
      }
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const result = await tryListModels(baseUrl, apiKey, headers, controller.signal);
      if (!result.ok) {
        const detail = result.attempts.map((a) => `${a.url} -> ${a.error ?? "unknown"}`).join("; ");
        return NextResponse.json({
          ok: false,
          error: `Could not list models from ${baseUrl}. ${detail}`,
        });
      }
      return NextResponse.json({
        ok: true,
        url: result.url,
        models: result.models,
      });
    } finally {
      clearTimeout(timer);
    }
  } catch (error) {
    return NextResponse.json({ ok: false, error: errorMessage(error) }, { status: 500 });
  } finally {
    if (tempDir) rmSync(tempDir, { recursive: true, force: true });
  }
}
