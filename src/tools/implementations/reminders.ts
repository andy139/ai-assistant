import { db } from "../../store/db.js";
import type { RemindersCreateArgs, RemindersListArgs, RemindersDeleteArgs } from "../schemas/reminders.js";
import type { ToolResult } from "../registry.js";

export async function remindersCreate(args: RemindersCreateArgs): Promise<ToolResult> {
  const reminder = await db.reminder.create({
    data: {
      text: args.text,
      runAt: new Date(args.runAt),
      source: args.source ?? null,
      chatId: args.chatId ?? null,
    },
  });

  const time = reminder.runAt.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })
    + " " + reminder.runAt.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

  return {
    ok: true,
    data: { id: reminder.id, text: reminder.text, runAt: reminder.runAt.toISOString() },
    summary: `Reminder set:\n${reminder.text}\n${time}`,
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

  const lines = reminders.map((r, i) => {
    const icon = r.fired ? "\u2705" : "\u23F0";
    const time = r.runAt.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })
      + " " + r.runAt.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
    return `${icon} ${r.text}\n   ${time}`;
  });

  return {
    ok: true,
    data: reminders.map((r) => ({
      id: r.id,
      text: r.text,
      runAt: r.runAt.toISOString(),
      fired: r.fired,
    })),
    summary: reminders.length
      ? `Reminders:\n\n${lines.join("\n\n")}`
      : "No reminders found",
  };
}

export async function remindersDelete(args: RemindersDeleteArgs): Promise<ToolResult> {
  try {
    if (args.all) {
      const count = await db.reminder.count();
      await db.reminder.deleteMany();
      return {
        ok: true,
        data: { deletedCount: count },
        summary: count > 0 ? `Deleted all ${count} reminder(s).` : "No reminders to delete.",
      };
    }

    let reminder;

    if (args.id) {
      reminder = await db.reminder.delete({ where: { id: args.id } });
    } else if (args.text) {
      const match = await db.reminder.findFirst({
        where: { text: { contains: args.text } },
        orderBy: { createdAt: "desc" },
      });
      if (!match) {
        return { ok: false, data: null, summary: `No reminder found matching "${args.text}"` };
      }
      reminder = await db.reminder.delete({ where: { id: match.id } });
    } else {
      return { ok: false, data: null, summary: "Provide an id, text, or set all: true" };
    }

    return {
      ok: true,
      data: { id: reminder.id, text: reminder.text },
      summary: `Deleted reminder: ${reminder.text}`,
    };
  } catch {
    return { ok: false, data: null, summary: `Reminder not found` };
  }
}
