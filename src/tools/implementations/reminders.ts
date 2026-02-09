import { db } from "../../store/db.js";
import type { RemindersCreateArgs } from "../schemas/reminders.js";
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
