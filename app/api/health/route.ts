import { NextResponse } from "next/server";
import { accessSync, constants, existsSync, readFileSync } from "fs";
import { join } from "path";
import { getAgentDir, getSessionsDir } from "@/lib/session-reader";

export const dynamic = "force-dynamic";

type CheckStatus = "ok" | "warn" | "error";

interface HealthCheck {
  name: string;
  status: CheckStatus;
  detail?: string;
}

function packageVersion(packageName: string): string {
  const candidates: string[] = [];
  try {
    candidates.push(require.resolve(`${packageName}/package.json`, { paths: [process.cwd()] }));
  } catch {
    // Some packages do not export package.json.
  }
  candidates.push(join(process.cwd(), "node_modules", packageName, "package.json"));

  for (const pkgPath of candidates) {
    try {
      return (JSON.parse(readFileSync(pkgPath, "utf8")) as { version?: string }).version ?? "unknown";
    } catch {
      // try next candidate
    }
  }
  return "unknown";
}

function appVersion(): string {
  try {
    return (JSON.parse(readFileSync(join(process.cwd(), "package.json"), "utf8")) as { version?: string }).version ?? "unknown";
  } catch {
    return process.env.NEXT_PUBLIC_APP_VERSION ?? "unknown";
  }
}

function readJsonCheck(name: string, path: string, missingStatus: CheckStatus): HealthCheck {
  if (!existsSync(path)) return { name, status: missingStatus, detail: `${path} not found` };
  try {
    JSON.parse(readFileSync(path, "utf8"));
    return { name, status: "ok", detail: path };
  } catch (error) {
    return { name, status: "error", detail: `${path}: ${error instanceof Error ? error.message : String(error)}` };
  }
}

function readableDirCheck(name: string, path: string, missingStatus: CheckStatus): HealthCheck {
  if (!existsSync(path)) return { name, status: missingStatus, detail: `${path} not found` };
  try {
    accessSync(path, constants.R_OK);
    return { name, status: "ok", detail: path };
  } catch (error) {
    return { name, status: "error", detail: `${path}: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export async function GET() {
  const agentDir = getAgentDir();
  const sessionsDir = getSessionsDir();
  const modelsPath = join(agentDir, "models.json");
  const settingsPath = join(agentDir, "settings.json");
  const checks: HealthCheck[] = [
    { name: "node", status: process.versions.node >= "22.19.0" ? "ok" : "warn", detail: process.version },
    { name: "nextBuild", status: existsSync(join(process.cwd(), ".next")) ? "ok" : "warn", detail: join(process.cwd(), ".next") },
    readableDirCheck("agentDir", agentDir, "warn"),
    readableDirCheck("sessionsDir", sessionsDir, "warn"),
    readJsonCheck("modelsJson", modelsPath, "warn"),
    readJsonCheck("settingsJson", settingsPath, "warn"),
  ];
  const ok = !checks.some((check) => check.status === "error");

  return NextResponse.json({
    ok,
    checkedAt: new Date().toISOString(),
    version: {
      app: appVersion(),
      next: packageVersion("next"),
      piCodingAgent: packageVersion("@earendil-works/pi-coding-agent"),
      piAi: packageVersion("@earendil-works/pi-ai"),
      node: process.version,
    },
    paths: {
      agentDir,
      sessionsDir,
      modelsPath,
      settingsPath,
    },
    checks,
  }, { status: ok ? 200 : 500 });
}
