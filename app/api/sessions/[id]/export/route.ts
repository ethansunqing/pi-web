import { randomUUID } from "crypto";
import { execFile } from "child_process";
import { existsSync, mkdirSync, readFileSync, rmSync } from "fs";
import { tmpdir } from "os";
import { dirname, join } from "path";
import { promisify } from "util";
import { fileURLToPath } from "url";
import { NextResponse } from "next/server";
import { SessionManager } from "@earendil-works/pi-coding-agent";
import { messagesToMarkdown, type ExportContext } from "@/lib/export-markdown";
import {
  buildSessionContext,
  listAllSessions,
  resolveSessionPath,
} from "@/lib/session-reader";

const execFileAsync = promisify(execFile);

export const runtime = "nodejs";

function encodeHeaderValue(value: string): string {
  return encodeURIComponent(value).replace(/[!'()*]/g, (ch) =>
    `%${ch.charCodeAt(0).toString(16).toUpperCase()}`
  );
}

function getAttachmentDisposition(fileName: string): string {
  const fallback = fileName.replace(/[^\x20-\x7E]|["\\;\r\n]/g, "_") || "session.html";
  return `attachment; filename="${fallback}"; filename*=UTF-8''${encodeHeaderValue(fileName)}`;
}

function sanitizeExportBaseName(name: string | undefined): string {
  const normalized = (name ?? "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/[<>:"/\\|?*\r\n\t]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const safeName = normalized
    .replace(/[^a-zA-Z0-9\u4e00-\u9fff_\-. ]/g, "_")
    .replace(/_+/g, "_")
    .trim()
    .slice(0, 80);

  return safeName || "Session Export";
}

async function getExportContext(id: string, filePath: string): Promise<{
  exportContext: ExportContext;
  fileBaseName: string;
}> {
  const sessionManager = SessionManager.open(filePath);
  const entries = sessionManager.getEntries() as never;
  const context = buildSessionContext(entries, sessionManager.getLeafId());
  const header = sessionManager.getHeader();
  const sessions = await listAllSessions();
  const sessionInfo = sessions.find((session) => session.id === id);

  const exportContext: ExportContext = {
    name:
      sessionManager.getSessionName() ||
      sessionInfo?.name ||
      sessionInfo?.firstMessage?.slice(0, 60) ||
      "Session Export",
    cwd: header?.cwd ?? sessionInfo?.cwd ?? "",
    created: sessionInfo?.created ?? header?.timestamp ?? new Date().toISOString(),
    modified: sessionInfo?.modified ?? header?.timestamp ?? new Date().toISOString(),
    messageCount: context.messages.length,
    model: context.model
      ? `${context.model.provider}/${context.model.modelId}`
      : undefined,
  };

  return {
    exportContext,
    fileBaseName: sanitizeExportBaseName(exportContext.name),
  };
}

async function getPiCliPath(): Promise<string> {
  const resolver = (import.meta as ImportMeta & {
    resolve?: (specifier: string) => string | Promise<string>;
  }).resolve;
  if (typeof resolver === "function") {
    const indexUrl = await resolver("@earendil-works/pi-coding-agent");
    return join(dirname(fileURLToPath(indexUrl)), "cli.js");
  }

  return join(
    process.cwd(),
    "node_modules",
    "@earendil-works",
    "pi-coding-agent",
    "dist",
    "cli.js"
  );
}

async function exportMarkdown(id: string, filePath: string): Promise<Response> {
  const { exportContext, fileBaseName } = await getExportContext(id, filePath);
  const sessionManager = SessionManager.open(filePath);
  const entries = sessionManager.getEntries() as never;
  const context = buildSessionContext(entries, sessionManager.getLeafId());
  const markdown = messagesToMarkdown(context.messages, exportContext);

  return new Response(markdown, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Disposition": getAttachmentDisposition(`${fileBaseName}.md`),
      "Cache-Control": "no-cache",
    },
  });
}

/**
 * Patch the exported HTML to fix recursive functions that overflow
 * the call stack on deep linear session trees (e.g., 5000+ entries).
 *
 * pi-coding-agent's template.js uses recursive helpers (sortChildren,
 * mapNodes, markActive) to render/navigate the session tree. On a deep
 * linear chain they recurse thousands of levels deep -> stack overflow.
 * These functions are inlined in the exported HTML, so we patch the
 * generated string before returning it, replacing each with an iterative
 * equivalent. Line endings are normalized (CRLF -> LF) for cross-platform
 * matching. replaceRequired() fail-fasts if the expected match count != 1.
 */
function patchExportHtml(html: string): string {
  const n = (s: string) => s.replace(/\r\n/g, "\n");
  html = n(html);

  const replaceRequired = (source: string, name: string, search: string, replacement: string) => {
    const normalizedSearch = n(search);
    const normalizedReplacement = n(replacement);
    const matches = source.split(normalizedSearch).length - 1;
    if (matches !== 1) {
      throw new Error(`Failed to patch exported HTML: ${name} expected 1 match, found ${matches}`);
    }
    return source.replace(normalizedSearch, normalizedReplacement);
  };

  html = replaceRequired(
    html,
    "sortChildren",
    `        function sortChildren(node) {
          node.children.sort((a, b) =>
            new Date(a.entry.timestamp).getTime() - new Date(b.entry.timestamp).getTime()
          );
          node.children.forEach(sortChildren);
        }`,
    `        function sortChildren(root) {
          const stack = [root];
          while (stack.length) {
            const node = stack.pop();
            node.children.sort((a, b) =>
              new Date(a.entry.timestamp).getTime() - new Date(b.entry.timestamp).getTime()
            );
            for (let i = node.children.length - 1; i >= 0; i--) {
              stack.push(node.children[i]);
            }
          }
        }`
  );

  html = replaceRequired(
    html,
    "mapNodes",
    `          function mapNodes(node) {
            treeNodeMap.set(node.entry.id, node);
            node.children.forEach(mapNodes);
          }
          tree.forEach(mapNodes);`,
    `          const stack = [...tree].reverse();
          while (stack.length) {
            const node = stack.pop();
            treeNodeMap.set(node.entry.id, node);
            for (let i = node.children.length - 1; i >= 0; i--) {
              stack.push(node.children[i]);
            }
          }`
  );

  html = replaceRequired(
    html,
    "markActive",
    `        function markActive(node) {
          let has = activePathIds.has(node.entry.id);
          for (const child of node.children) {
            if (markActive(child)) has = true;
          }
          containsActive.set(node, has);
          return has;
        }`,
    `        function markActive(root) {
          // Post-order traversal using two stacks
          const stack1 = [root];
          const stack2 = [];
          while (stack1.length) {
            const node = stack1.pop();
            stack2.push(node);
            for (const child of node.children) {
              stack1.push(child);
            }
          }
          while (stack2.length) {
            const node = stack2.pop();
            let has = activePathIds.has(node.entry.id);
            for (const child of node.children) {
              if (containsActive.get(child)) has = true;
            }
            containsActive.set(node, has);
          }
        }`
  );

  return html;
}

async function exportHtml(id: string, filePath: string): Promise<Response> {
  const cliPath = await getPiCliPath();
  if (!existsSync(cliPath)) {
    return NextResponse.json({ error: "pi CLI not found" }, { status: 500 });
  }

  const tempDir = join(tmpdir(), "pi-web-export");
  mkdirSync(tempDir, { recursive: true });

  const { fileBaseName } = await getExportContext(id, filePath);
  const fileName = `${fileBaseName}.html`;
  const outputPath = join(tempDir, `${randomUUID()}.html`);

  try {
    await execFileAsync(process.execPath, [cliPath, "--export", filePath, outputPath], {
      cwd: process.cwd(),
      timeout: 30_000,
      env: {
        ...process.env,
        PI_OFFLINE: "1",
        PI_SKIP_VERSION_CHECK: "1",
      },
      maxBuffer: 1024 * 1024,
    });

    const html = readFileSync(outputPath, "utf8");
    const patchedHtml = patchExportHtml(html);
    return new Response(patchedHtml, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Content-Disposition": getAttachmentDisposition(fileName),
        "Cache-Control": "no-cache",
      },
    });
  } finally {
    rmSync(outputPath, { force: true });
  }
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const filePath = await resolveSessionPath(id);
    if (!filePath) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    const format = new URL(req.url).searchParams.get("format");
    return format === "markdown"
      ? exportMarkdown(id, filePath)
      : exportHtml(id, filePath);
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
