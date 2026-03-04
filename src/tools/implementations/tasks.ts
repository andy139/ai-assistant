import { db } from "../../store/db.js";
import type { TasksCreateArgs, TasksListArgs, TasksCompleteArgs, TasksDeleteArgs } from "../schemas/tasks.js";
import type { ToolResult } from "../registry.js";

export async function tasksCreate(args: TasksCreateArgs): Promise<ToolResult> {
  const task = await db.task.create({
    data: {
      title: args.title,
      notes: args.notes ?? null,
      dueAt: args.dueAt ? new Date(args.dueAt) : null,
    },
  });

  return {
    ok: true,
    data: { id: task.id, title: task.title, dueAt: task.dueAt?.toISOString() ?? null },
    summary: `Created task: "${task.title}"`,
  };
}

export async function tasksList(args: TasksListArgs): Promise<ToolResult> {
  const tasks = await db.task.findMany({
    where: args.status ? { status: args.status } : undefined,
    orderBy: { createdAt: "desc" },
    take: args.limit ?? 20,
  });

  const lines = tasks.map((t) => {
    const icon = t.status === "done" ? "\u2705" : "\u25FB\uFE0F";
    const due = t.dueAt
      ? "\n   Due: " + t.dueAt.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })
      : "";
    return `${icon} ${t.title}${due}`;
  });

  return {
    ok: true,
    data: tasks.map((t) => ({
      id: t.id,
      title: t.title,
      status: t.status,
      dueAt: t.dueAt?.toISOString() ?? null,
    })),
    summary: tasks.length
      ? `Tasks:\n\n${lines.join("\n\n")}`
      : "No tasks found",
  };
}

export async function tasksComplete(args: TasksCompleteArgs): Promise<ToolResult> {
  try {
    const task = await db.task.update({
      where: { id: args.id },
      data: { status: "done" },
    });
    return {
      ok: true,
      data: { id: task.id, title: task.title, status: task.status },
      summary: `Completed task: "${task.title}"`,
    };
  } catch {
    return { ok: false, data: null, summary: `Task not found: ${args.id}` };
  }
}

export async function tasksDelete(args: TasksDeleteArgs): Promise<ToolResult> {
  try {
    const task = await db.task.delete({
      where: { id: args.id },
    });
    return {
      ok: true,
      data: { id: task.id, title: task.title },
      summary: `Deleted task: "${task.title}"`,
    };
  } catch {
    return { ok: false, data: null, summary: `Task not found: ${args.id}` };
  }
}
