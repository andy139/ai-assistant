import { db } from "../../store/db.js";
import { weatherCurrent } from "./weather.js";
import type { BriefingGetArgs } from "../schemas/briefing.js";
import type { ToolResult } from "../registry.js";

export async function briefingGet(args: BriefingGetArgs): Promise<ToolResult> {
  const now = new Date();
  const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  const [openTasks, upcomingReminders, weather] = await Promise.all([
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
  ]);

  const sections: string[] = [];

  if (weather?.ok) {
    sections.push(`Weather: ${weather.summary}`);
  }

  if (openTasks.length > 0) {
    const taskLines = openTasks.map((t) => {
      const due = t.dueAt ? ` (due ${t.dueAt.toISOString().split("T")[0]})` : "";
      return `- ${t.title}${due}`;
    });
    sections.push(`Open tasks (${openTasks.length}):\n${taskLines.join("\n")}`);
  } else {
    sections.push("No open tasks.");
  }

  if (upcomingReminders.length > 0) {
    const reminderLines = upcomingReminders.map((r) => {
      const time = r.runAt.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
      return `- ${r.text} at ${time}`;
    });
    sections.push(`Upcoming reminders (${upcomingReminders.length}):\n${reminderLines.join("\n")}`);
  } else {
    sections.push("No upcoming reminders in the next 24h.");
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
