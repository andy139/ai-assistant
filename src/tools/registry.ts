import type { ZodSchema } from "zod";
import { tasksCreateSchema, tasksListSchema, tasksCompleteSchema, tasksDeleteSchema } from "./schemas/tasks.js";
import { remindersCreateSchema, remindersListSchema } from "./schemas/reminders.js";
import { discordPostSchema } from "./schemas/discord.js";
import { smsReplySchema } from "./schemas/sms.js";
import { historyQuerySchema } from "./schemas/history.js";
import { agentDelegateSchema } from "./schemas/agentDelegate.js";
import { weatherCurrentSchema } from "./schemas/weather.js";
import { notesCreateSchema, notesSearchSchema, notesListSchema } from "./schemas/notes.js";
import { bookmarksSaveSchema, bookmarksListSchema } from "./schemas/bookmarks.js";
import { briefingGetSchema } from "./schemas/briefing.js";
import { webSearchSchema, webSummarizeSchema } from "./schemas/web.js";
import { tasksCreate, tasksList, tasksComplete, tasksDelete } from "./implementations/tasks.js";
import { remindersCreate, remindersList } from "./implementations/reminders.js";
import { discordPost } from "./implementations/discord.js";
import { smsReply } from "./implementations/sms.js";
import { historyQuery } from "./implementations/history.js";
import { agentDelegate } from "./implementations/agentDelegate.js";
import { weatherCurrent } from "./implementations/weather.js";
import { notesCreate, notesSearch, notesList } from "./implementations/notes.js";
import { bookmarksSave, bookmarksList } from "./implementations/bookmarks.js";
import { briefingGet } from "./implementations/briefing.js";
import { webSearch, webSummarize } from "./implementations/web.js";

export interface ToolResult {
  ok: boolean;
  data: unknown;
  summary: string;
}

export type PermissionLevel = "read" | "write";
export type ConfirmLevel = "none" | "soft" | "hard";

export interface ToolDefinition {
  name: string;
  description: string;
  permission: PermissionLevel;
  confirmation: ConfirmLevel;
  schema: ZodSchema;
  execute: (args: unknown) => Promise<ToolResult>;
}

const tools: Map<string, ToolDefinition> = new Map();

function register(def: ToolDefinition): void {
  tools.set(def.name, def);
}

// --- Register all V1 tools ---

register({
  name: "tasks.create",
  description: "Create a new task with optional due date and notes",
  permission: "write",
  confirmation: "soft",
  schema: tasksCreateSchema,
  execute: (args) => tasksCreate(args as Parameters<typeof tasksCreate>[0]),
});

register({
  name: "tasks.list",
  description: "List tasks, optionally filtered by status",
  permission: "read",
  confirmation: "none",
  schema: tasksListSchema,
  execute: (args) => tasksList(args as Parameters<typeof tasksList>[0]),
});

register({
  name: "reminders.create",
  description: "Create a scheduled reminder",
  permission: "write",
  confirmation: "hard",
  schema: remindersCreateSchema,
  execute: (args) => remindersCreate(args as Parameters<typeof remindersCreate>[0]),
});

register({
  name: "discord.post",
  description: "Post a message to Discord via webhook",
  permission: "write",
  confirmation: "hard",
  schema: discordPostSchema,
  execute: (args) => discordPost(args as Parameters<typeof discordPost>[0]),
});

register({
  name: "sms.reply",
  description: "Send an SMS reply via Twilio",
  permission: "write",
  confirmation: "none",
  schema: smsReplySchema,
  execute: (args) => smsReply(args as Parameters<typeof smsReply>[0]),
});

register({
  name: "history.query",
  description: "Query command history",
  permission: "read",
  confirmation: "none",
  schema: historyQuerySchema,
  execute: (args) => historyQuery(args as Parameters<typeof historyQuery>[0]),
});

register({
  name: "agent.delegate",
  description: "Delegate a task to a specialized sub-agent",
  permission: "write",
  confirmation: "soft",
  schema: agentDelegateSchema,
  execute: (args) => agentDelegate(args as Parameters<typeof agentDelegate>[0]),
});

// --- Quick-win tools ---

register({
  name: "weather.current",
  description: "Get current weather for a location",
  permission: "read",
  confirmation: "none",
  schema: weatherCurrentSchema,
  execute: (args) => weatherCurrent(args as Parameters<typeof weatherCurrent>[0]),
});

register({
  name: "notes.create",
  description: "Save a quick note with optional tag",
  permission: "write",
  confirmation: "soft",
  schema: notesCreateSchema,
  execute: (args) => notesCreate(args as Parameters<typeof notesCreate>[0]),
});

register({
  name: "notes.search",
  description: "Search notes by keyword",
  permission: "read",
  confirmation: "none",
  schema: notesSearchSchema,
  execute: (args) => notesSearch(args as Parameters<typeof notesSearch>[0]),
});

register({
  name: "notes.list",
  description: "List recent notes, optionally filtered by tag",
  permission: "read",
  confirmation: "none",
  schema: notesListSchema,
  execute: (args) => notesList(args as Parameters<typeof notesList>[0]),
});

register({
  name: "bookmarks.save",
  description: "Save a URL bookmark with optional title and tag",
  permission: "write",
  confirmation: "soft",
  schema: bookmarksSaveSchema,
  execute: (args) => bookmarksSave(args as Parameters<typeof bookmarksSave>[0]),
});

register({
  name: "bookmarks.list",
  description: "List saved bookmarks, optionally filtered by tag",
  permission: "read",
  confirmation: "none",
  schema: bookmarksListSchema,
  execute: (args) => bookmarksList(args as Parameters<typeof bookmarksList>[0]),
});

register({
  name: "briefing.get",
  description: "Get a daily briefing with open tasks, upcoming reminders, and optional weather",
  permission: "read",
  confirmation: "none",
  schema: briefingGetSchema,
  execute: (args) => briefingGet(args as Parameters<typeof briefingGet>[0]),
});

register({
  name: "web.search",
  description: "Search the web using Brave Search",
  permission: "read",
  confirmation: "none",
  schema: webSearchSchema,
  execute: (args) => webSearch(args as Parameters<typeof webSearch>[0]),
});

register({
  name: "web.summarize",
  description: "Fetch a URL and summarize its content",
  permission: "read",
  confirmation: "none",
  schema: webSummarizeSchema,
  execute: (args) => webSummarize(args as Parameters<typeof webSummarize>[0]),
});

register({
  name: "tasks.complete",
  description: "Mark a task as done by its ID",
  permission: "write",
  confirmation: "soft",
  schema: tasksCompleteSchema,
  execute: (args) => tasksComplete(args as Parameters<typeof tasksComplete>[0]),
});

register({
  name: "tasks.delete",
  description: "Permanently delete a task by its ID",
  permission: "write",
  confirmation: "hard",
  schema: tasksDeleteSchema,
  execute: (args) => tasksDelete(args as Parameters<typeof tasksDelete>[0]),
});

register({
  name: "reminders.list",
  description: "List reminders, optionally filtered by status",
  permission: "read",
  confirmation: "none",
  schema: remindersListSchema,
  execute: (args) => remindersList(args as Parameters<typeof remindersList>[0]),
});

// --- Registry accessors ---

export function getTool(name: string): ToolDefinition | undefined {
  return tools.get(name);
}

export function isKnownTool(name: string): boolean {
  return tools.has(name);
}

export function getAllTools(): ToolDefinition[] {
  return Array.from(tools.values());
}

export function getToolNames(): string[] {
  return Array.from(tools.keys());
}
