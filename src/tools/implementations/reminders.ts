import { db } from "../../store/db.js";
import type { RemindersCreateArgs, RemindersListArgs } from "../schemas/reminders.js";
import type { ToolResult } from "../registry.js";

export async function remindersCreate(args: RemindersCreateArgs): Promise<ToolResult> {
  const reminder = await db.reminder.create({
    data: {
      text: args.text,
      runAt: new Date(args.runAt),
    },
  });

  return {
    ok: true,
    data: { id: reminder.id, text: reminder.text, runAt: reminder.runAt.toISOString() },
    summary: `Reminder set: "${reminder.text}" at ${reminder.runAt.toISOString()}`,
  };
}

export async function remindersList(args: RemindersListArgs): Promise<ToolResult> {
  const where: Record<string, unknown> = {};
  if (args.status === "pending") where.fired = false;
  if (args.status === "fired") where.fired = true;

  const reminders = await db.reminder.findMany({
    where,
    orderBy: { runAt: "asc" },
    take: args.limit ?? 20,
  });

  return {
    ok: true,
    data: reminders.map((r) => ({
      id: r.id,
      text: r.text,
      runAt: r.runAt.toISOString(),
      fired: r.fired,
    })),
    summary: `Found ${reminders.length} reminder(s)`,
  };
}
