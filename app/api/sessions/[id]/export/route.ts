import { NextResponse } from "next/server";
import { resolveSessionPath, buildSessionContext } from "@/lib/session-reader";
import { messagesToMarkdown, type ExportContext } from "@/lib/export-markdown";
import { SessionManager } from "@earendil-works/pi-coding-agent";
import { listAllSessions } from "@/lib/session-reader";

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

    const sm = SessionManager.open(filePath);
    const entries = sm.getEntries() as never;
    const leafId = sm.getLeafId();
    const context = buildSessionContext(entries, leafId);

    const header = sm.getHeader();
    const allSessions = await listAllSessions();
    const sessionInfo = allSessions.find((s) => s.id === id);

    const exportCtx: ExportContext = {
      name: sm.getSessionName() || sessionInfo?.name || sessionInfo?.firstMessage?.slice(0, 60) || "Session Export",
      cwd: header?.cwd ?? sessionInfo?.cwd ?? "",
      created: sessionInfo?.created ?? header?.timestamp ?? new Date().toISOString(),
      modified: sessionInfo?.modified ?? header?.timestamp ?? new Date().toISOString(),
      messageCount: context.messages.length,
      model: context.model ? `${context.model.provider}/${context.model.modelId}` : undefined,
    };

    const markdown = messagesToMarkdown(context.messages, exportCtx);

    // Return as downloadable file
    const safeName = exportCtx.name.replace(/[^a-zA-Z0-9\u4e00-\u9fff_\-. ]/g, "_").slice(0, 80);
    const filename = `${safeName}.md`;

    return new NextResponse(markdown, {
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
      },
    });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
