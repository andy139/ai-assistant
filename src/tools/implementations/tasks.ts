import { db } from "../../store/db.js";
import type { TasksCreateArgs, TasksListArgs } from "../schemas/tasks.js";
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

  return {
    ok: true,
    data: tasks.map((t) => ({
      id: t.id,
      title: t.title,
      status: t.status,
      dueAt: t.dueAt?.toISOString() ?? null,
    })),
    summary: `Found ${tasks.length} task(s)`,
  };
}
