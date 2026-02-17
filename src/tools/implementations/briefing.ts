import { db } from "../../store/db.js";
import { weatherCurrent } from "./weather.js";
import { emailList } from "./email.js";
import type { BriefingGetArgs } from "../schemas/briefing.js";
import type { ToolResult } from "../registry.js";

export async function briefingGet(args: BriefingGetArgs): Promise<ToolResult> {
  const now = new Date();
  const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  const [openTasks, upcomingReminders, weather, recentEmails] = await Promise.all([
    db.task.findMany({
      where: { status: "open" },
      orderBy: { dueAt: "asc" },
      take: 10,
    }),
    db.reminder.findMany({
      where: {
        fired: false,
        runAt: { gte: now, lte: in24h },
      },
      orderBy: { runAt: "asc" },
    }),
    args.location
      ? weatherCurrent({ location: args.location }).catch(() => null)
      : Promise.resolve(null),
    emailList({ unreadOnly: true, maxResults: 5 }).catch(() => null),
  ]);

  const sections: string[] = ["\uD83D\uDCCB Daily Briefing"];

  if (weather?.ok) {
    sections.push(`\u2600\uFE0F ${weather.summary}`);
  }

  if (openTasks.length > 0) {
    const taskLines = openTasks.map((t) => {
      const due = t.dueAt
        ? " \u2014 due " + t.dueAt.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })
        : "";
      return `  \u25FB\uFE0F ${t.title}${due}`;
    });
    sections.push(`Tasks (${openTasks.length}):\n${taskLines.join("\n")}`);
  } else {
    sections.push("No open tasks.");
  }

  if (upcomingReminders.length > 0) {
    const reminderLines = upcomingReminders.map((r) => {
      const time = r.runAt.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
      return `  \u23F0 ${r.text} \u2014 ${time}`;
    });
    sections.push(`Reminders (${upcomingReminders.length}):\n${reminderLines.join("\n")}`);
  } else {
    sections.push("No upcoming reminders in the next 24h.");
  }

  if (recentEmails?.ok && Array.isArray(recentEmails.data) && recentEmails.data.length > 0) {
    const emails = recentEmails.data as Array<{ from: string; subject: string }>;
    const emailLines = emails.map((e) => `  📧 ${e.from}: ${e.subject}`);
    sections.push(`Unread Emails (${emails.length}):\n${emailLines.join("\n")}`);
  }

  const briefing = sections.join("\n\n");

  return {
    ok: true,
    data: {
      weather: weather?.ok ? weather.data : null,
      openTasks: openTasks.map((t) => ({
        id: t.id,
        title: t.title,
        dueAt: t.dueAt?.toISOString() ?? null,
      })),
      upcomingReminders: upcomingReminders.map((r) => ({
        id: r.id,
        text: r.text,
        runAt: r.runAt.toISOString(),
      })),
    },
    summary: briefing,
  };
}
