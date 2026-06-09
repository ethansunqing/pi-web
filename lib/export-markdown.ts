/**
 * Converts a session's messages into a Markdown string for export.
 */

import type {
  AgentMessage,
  AssistantMessage,
  TextContent,
  ThinkingContent,
  ToolCallContent,
  ToolResultMessage,
} from "./types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function escapeMdInline(text: string): string {
  return text.replace(/([\\*_`[\]()#+\-.!{|}])/g, "\\$1");
}

function formatTimestamp(ts?: number): string {
  if (!ts) return "";
  const d = new Date(ts);
  return d.toLocaleString();
}

// ---------------------------------------------------------------------------
// Message converters
// ---------------------------------------------------------------------------

function renderUserMessage(msg: { content: string | Array<{ type: string; text?: string }> }): string {
  let text = "";
  if (typeof msg.content === "string") {
    text = msg.content;
  } else if (Array.isArray(msg.content)) {
    text = msg.content
      .filter((b) => b.type === "text")
      .map((b) => b.text ?? "")
      .join("\n\n");
  }
  // Clean up trailing whitespace
  text = text.trim();
  if (!text) return "*(no content)*";

  // If the text is already multi-line Markdown, preserve it.
  return text;
}

function renderAssistantMessage(
  msg: AssistantMessage,
  toolResults?: Map<string, ToolResultMessage>
): string {
  const parts: string[] = [];
  const content = msg.content;

  for (const block of content) {
    if (block.type === "thinking") {
      const thinking = (block as ThinkingContent).thinking.trim();
      if (thinking) {
        parts.push(
          `<details>\n<summary>💭 Thinking</summary>\n\n${thinking}\n\n</details>`
        );
      }
    } else if (block.type === "toolCall") {
      const tc = block as ToolCallContent;
      const input = JSON.stringify(tc.input, null, 2);
      let toolSection = `🔧 **Tool call: \`${tc.toolName}\`**\n\n\`\`\`json\n${input}\n\`\`\``;

      // Include tool result if available
      const result = toolResults?.get(tc.toolCallId);
      if (result) {
        const resultText = result.content
          .map((b) => {
            if (b.type === "text") return (b as TextContent).text;
            return "";
          })
          .join("\n")
          .trim();

        const truncateThreshold = 5000;
        let display = resultText;
        let truncatedMsg = "";
        if (display.length > truncateThreshold) {
          display = display.slice(0, truncateThreshold);
          truncatedMsg = `\n\n*(Result truncated at ${truncateThreshold} characters)*`;
        }

        toolSection += `\n\n**Result:**\n\n\`\`\`\n${display}\n\`\`\`${truncatedMsg}`;
      } else {
        toolSection += `\n\n*(Tool running…)*`;
      }

      parts.push(toolSection);
    } else if (block.type === "text") {
      const text = (block as TextContent).text.trim();
      if (text) parts.push(text);
    }
  }

  if (msg.stopReason) {
    parts.push(`\n*(Stop reason: ${escapeMdInline(msg.stopReason)})*`);
  }
  if (msg.errorMessage) {
    parts.push(`\n❌ **Error:** ${escapeMdInline(msg.errorMessage)}`);
  }

  return parts.join("\n\n") || "*(no content)*";
}

function renderToolUsage(usage: AssistantMessage["usage"]): string {
  if (!usage) return "";
  const lines = [
    `| Tokens | Count | Cost |`,
    `|--------|-------|------|`,
    `| Input  | ${usage.input.toLocaleString()} | $${usage.cost.input.toFixed(4)} |`,
    `| Output | ${usage.output.toLocaleString()} | $${usage.cost.output.toFixed(4)} |`,
  ];
  if (usage.cacheRead > 0) {
    lines.push(`| Cache read | ${usage.cacheRead.toLocaleString()} | $${usage.cost.cacheRead.toFixed(4)} |`);
  }
  if (usage.cacheWrite > 0) {
    lines.push(`| Cache write | ${usage.cacheWrite.toLocaleString()} | $${usage.cost.cacheWrite.toFixed(4)} |`);
  }
  lines.push(`| **Total** | | **$${usage.cost.total.toFixed(4)}** |`);
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export interface ExportContext {
  /** Session display name or first-message excerpt. */
  name: string;
  /** Working directory of the session. */
  cwd: string;
  /** ISO 8601 creation timestamp. */
  created: string;
  /** ISO 8601 last-modified timestamp. */
  modified: string;
  /** Total message count. */
  messageCount: number;
  /** Model description (e.g. "deepseek-v4-pro"). */
  model?: string;
}

/**
 * Convert an ordered list of agent messages into a complete Markdown document.
 *
 * Tool results are paired with their preceding assistant message's tool calls.
 * The pairing logic mirrors MessageView: for each assistant message we collect
 * immediately-following toolResult messages whose toolCallId matches a tool call
 * in the assistant message.
 */
export function messagesToMarkdown(
  messages: AgentMessage[],
  ctx: ExportContext
): string {
  const lines: string[] = [];

  // --- Title ---
  const title = ctx.name || "Session Export";
  lines.push(`# ${title}`);
  lines.push("");

  // --- Metadata ---
  lines.push("## Metadata");
  lines.push("");
  if (ctx.model) {
    lines.push(`- **Model:** \`${escapeMdInline(ctx.model)}\``);
  }
  lines.push(`- **Working directory:** \`${escapeMdInline(ctx.cwd)}\``);
  lines.push(`- **Created:** ${escapeMdInline(ctx.created)}`);
  lines.push(`- **Modified:** ${escapeMdInline(ctx.modified)}`);
  lines.push(`- **Messages:** ${ctx.messageCount}`);
  lines.push("");

  // --- Build tool-result lookup from adjacent toolResult messages ---
  // Index toolResult messages by toolCallId for quick lookup.
  const toolResultById = new Map<string, ToolResultMessage>();
  for (const m of messages) {
    if (m.role === "toolResult") {
      const tr = m as ToolResultMessage;
      toolResultById.set(tr.toolCallId, tr);
    }
  }

  // We also need per-assistant-message tool result pairing.  The messages
  // array interleaves assistant → toolResult sequences.  Walk assistants and
  // grab the toolResults that follow before the next assistant or user.
  const assistantToolResults = new Map<number, Map<string, ToolResultMessage>>();
  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    if (msg.role !== "assistant") continue;

    const results = new Map<string, ToolResultMessage>();
    for (let j = i + 1; j < messages.length; j++) {
      const next = messages[j];
      if (next.role === "toolResult") {
        const tr = next as ToolResultMessage;
        results.set(tr.toolCallId, tr);
      } else if (next.role === "user" || next.role === "assistant") {
        break;
      }
    }
    assistantToolResults.set(i, results);
  }

  // --- Messages ---
  lines.push("## Conversation");
  lines.push("");

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];

    if (msg.role === "user") {
      const ts = formatTimestamp(msg.timestamp);
      lines.push(`### 👤 User${ts ? ` — ${ts}` : ""}`);
      lines.push("");
      lines.push(renderUserMessage(msg as { content: string | Array<{ type: string; text?: string }> }));
      lines.push("");
    } else if (msg.role === "assistant") {
      const asst = msg as AssistantMessage;
      const ts = formatTimestamp(asst.timestamp);
      const model = asst.model ? ` — ${asst.model}` : "";
      const provider = asst.provider ? ` (${asst.provider})` : "";
      lines.push(`### 🤖 Assistant${model}${provider}${ts ? ` — ${ts}` : ""}`);
      lines.push("");
      lines.push(renderAssistantMessage(asst, assistantToolResults.get(i)));
      lines.push("");

      // Token usage table
      if (asst.usage) {
        lines.push(renderToolUsage(asst.usage));
        lines.push("");
      }
    }
    // toolResult messages are rendered inline with their tool call above —
    // skip standalone rendering.
  }

  // --- Footer ---
  lines.push("---");
  lines.push(`*Exported on ${new Date().toLocaleString()}*`);

  return lines.join("\n");
}
