import { db } from "../../store/db.js";
import type { NotesCreateArgs, NotesSearchArgs, NotesListArgs } from "../schemas/notes.js";
import type { ToolResult } from "../registry.js";

export async function notesCreate(args: NotesCreateArgs): Promise<ToolResult> {
  const note = await db.note.create({
    data: {
      content: args.content,
      tag: args.tag ?? null,
    },
  });

  return {
    ok: true,
    data: { id: note.id, content: note.content, tag: note.tag },
    summary: `Saved note${note.tag ? ` [${note.tag}]` : ""}: "${note.content.slice(0, 80)}"`,
  };
}

export async function notesSearch(args: NotesSearchArgs): Promise<ToolResult> {
  const notes = await db.note.findMany({
    where: { content: { contains: args.query } },
    orderBy: { createdAt: "desc" },
    take: args.limit ?? 20,
  });

  return {
    ok: true,
    data: notes.map((n) => ({
      id: n.id,
      content: n.content,
      tag: n.tag,
      createdAt: n.createdAt.toISOString(),
    })),
    summary: `Found ${notes.length} note(s) matching "${args.query}"`,
  };
}

export async function notesList(args: NotesListArgs): Promise<ToolResult> {
  const notes = await db.note.findMany({
    where: args.tag ? { tag: args.tag } : undefined,
    orderBy: { createdAt: "desc" },
    take: args.limit ?? 20,
  });

  return {
    ok: true,
    data: notes.map((n) => ({
      id: n.id,
      content: n.content,
      tag: n.tag,
      createdAt: n.createdAt.toISOString(),
    })),
    summary: `Found ${notes.length} note(s)${args.tag ? ` tagged [${args.tag}]` : ""}`,
  };
}
