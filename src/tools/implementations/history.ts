import { db } from "../../store/db.js";
import type { HistoryQueryArgs } from "../schemas/history.js";
import type { ToolResult } from "../registry.js";

export async function historyQuery(args: HistoryQueryArgs): Promise<ToolResult> {
  const commands = await db.command.findMany({
    orderBy: { createdAt: "desc" },
    take: args.limit ?? 50,
    include: {
      actions: {
        select: {
          id: true,
          type: true,
          status: true,
          result: true,
          error: true,
          createdAt: true,
          executedAt: true,
        },
      },
    },
  });

  return {
    ok: true,
    data: commands.map((c) => ({
      id: c.id,
      source: c.source,
      message: c.message,
      status: c.status,
      createdAt: c.createdAt.toISOString(),
      actions: c.actions.map((a) => ({
        id: a.id,
        type: a.type,
        status: a.status,
      })),
    })),
    summary: `Returned ${commands.length} command(s)`,
  };
}
