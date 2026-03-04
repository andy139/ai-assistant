import { db } from "../../store/db.js";
import type { BookmarksSaveArgs, BookmarksListArgs } from "../schemas/bookmarks.js";
import type { ToolResult } from "../registry.js";

export async function bookmarksSave(args: BookmarksSaveArgs): Promise<ToolResult> {
  const bookmark = await db.bookmark.create({
    data: {
      url: args.url,
      title: args.title ?? null,
      tag: args.tag ?? null,
    },
  });

  return {
    ok: true,
    data: { id: bookmark.id, url: bookmark.url, title: bookmark.title, tag: bookmark.tag },
    summary: `Saved bookmark: ${bookmark.title ?? bookmark.url}${bookmark.tag ? ` [${bookmark.tag}]` : ""}`,
  };
}

export async function bookmarksList(args: BookmarksListArgs): Promise<ToolResult> {
  const bookmarks = await db.bookmark.findMany({
    where: args.tag ? { tag: args.tag } : undefined,
    orderBy: { createdAt: "desc" },
    take: args.limit ?? 20,
  });

  const lines = bookmarks.map((b) => {
    const tag = b.tag ? ` [${b.tag}]` : "";
    const title = b.title ? `${b.title}${tag}\n   ${b.url}` : `${b.url}${tag}`;
    return `\uD83D\uDD17 ${title}`;
  });

  return {
    ok: true,
    data: bookmarks.map((b) => ({
      id: b.id,
      url: b.url,
      title: b.title,
      tag: b.tag,
      createdAt: b.createdAt.toISOString(),
    })),
    summary: bookmarks.length
      ? `Bookmarks:\n\n${lines.join("\n\n")}`
      : `No bookmarks found${args.tag ? ` tagged [${args.tag}]` : ""}`,
  };
}
