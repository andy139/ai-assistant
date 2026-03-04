import type { AssistantReplyArgs } from "../schemas/assistant.js";
import type { ToolResult } from "../registry.js";

export async function assistantReply(args: AssistantReplyArgs): Promise<ToolResult> {
  return {
    ok: true,
    data: { text: args.text },
    summary: args.text,
  };
}
