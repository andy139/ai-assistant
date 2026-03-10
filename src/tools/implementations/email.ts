import { google } from "googleapis";
import { config } from "../../config/index.js";
import { callClaude } from "../../agent/claudeClient.js";
import { db } from "../../store/db.js";
import type {
  EmailListArgs,
  EmailReadArgs,
  EmailSummarizeArgs,
  EmailSendArgs,
  EmailArchiveArgs,
  EmailTriageArgs,
} from "../schemas/email.js";
import type { ToolResult } from "../registry.js";

function getGmailClient() {
  const { clientId, clientSecret, refreshToken } = config.gmail;
  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error("Gmail OAuth2 credentials not configured (GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN)");
  }
  const oauth2 = new google.auth.OAuth2(clientId, clientSecret);
  oauth2.setCredentials({ refresh_token: refreshToken });
  return google.gmail({ version: "v1", auth: oauth2 });
}

function extractBody(payload: { mimeType?: string; body?: { data?: string }; parts?: unknown[] }): string {
  // Direct body (single-part message)
  if (payload.body?.data && payload.mimeType === "text/plain") {
    return Buffer.from(payload.body.data, "base64url").toString("utf-8");
  }

  // Walk MIME parts — prefer text/plain, fall back to text/html
  const parts = (payload.parts ?? []) as Array<{
    mimeType?: string;
    body?: { data?: string };
    parts?: unknown[];
  }>;

  let plainText = "";
  let htmlText = "";

  for (const part of parts) {
    if (part.mimeType === "text/plain" && part.body?.data) {
      plainText += Buffer.from(part.body.data, "base64url").toString("utf-8");
    } else if (part.mimeType === "text/html" && part.body?.data) {
      htmlText += Buffer.from(part.body.data, "base64url").toString("utf-8");
    } else if (part.mimeType?.startsWith("multipart/") && part.parts) {
      // Recurse into nested multipart
      const nested = extractBody(part as Parameters<typeof extractBody>[0]);
      if (nested) return nested;
    }
  }

  if (plainText) return plainText;
  if (htmlText) {
    // Strip HTML tags for a rough plaintext fallback
    return htmlText.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  }

  return "";
}

function getHeader(headers: Array<{ name?: string | null; value?: string | null }>, name: string): string {
  return headers.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value ?? "";
}

export async function emailList(args: EmailListArgs): Promise<ToolResult> {
  try {
    const gmail = getGmailClient();
    const queryParts: string[] = [];
    if (args.from) queryParts.push(`from:${args.from}`);
    if (args.subject) queryParts.push(`subject:${args.subject}`);
    if (args.label) queryParts.push(`label:${args.label}`);
    if (args.unreadOnly) queryParts.push("is:unread");

    const q = queryParts.join(" ") || undefined;
    const maxResults = args.maxResults ?? 10;

    const listRes = await gmail.users.messages.list({
      userId: "me",
      q,
      maxResults,
    });

    const messageIds = listRes.data.messages ?? [];
    if (messageIds.length === 0) {
      return { ok: true, data: [], summary: "No emails found matching your criteria." };
    }

    // Fetch metadata for each message
    const emails = await Promise.all(
      messageIds.map(async (msg) => {
        const detail = await gmail.users.messages.get({
          userId: "me",
          id: msg.id!,
          format: "metadata",
          metadataHeaders: ["From", "Subject", "Date"],
        });
        const headers = detail.data.payload?.headers ?? [];
        return {
          id: msg.id!,
          from: getHeader(headers, "From"),
          subject: getHeader(headers, "Subject"),
          date: getHeader(headers, "Date"),
          snippet: detail.data.snippet ?? "",
          unread: (detail.data.labelIds ?? []).includes("UNREAD"),
        };
      }),
    );

    const lines = emails.map((e, i) => {
      const icon = e.unread ? "●" : "○";
      return `${icon} ${e.from}\n  ${e.subject}\n  ${e.snippet.slice(0, 100)}`;
    });

    return {
      ok: true,
      data: emails,
      summary: `Found ${emails.length} email(s):\n\n${lines.join("\n\n")}`,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return { ok: false, data: null, summary: `Failed to list emails: ${msg}` };
  }
}

export async function emailRead(args: EmailReadArgs): Promise<ToolResult> {
  try {
    const gmail = getGmailClient();
    const detail = await gmail.users.messages.get({
      userId: "me",
      id: args.id,
      format: "full",
    });

    const headers = detail.data.payload?.headers ?? [];
    const from = getHeader(headers, "From");
    const subject = getHeader(headers, "Subject");
    const date = getHeader(headers, "Date");

    let body = extractBody(detail.data.payload as Parameters<typeof extractBody>[0]);
    if (body.length > 8000) {
      body = body.slice(0, 8000) + "\n... [truncated]";
    }

    return {
      ok: true,
      data: { id: args.id, from, subject, date, body },
      summary: `From: ${from}\nSubject: ${subject}\nDate: ${date}\n\n${body}`,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return { ok: false, data: null, summary: `Failed to read email: ${msg}` };
  }
}

export async function emailSummarize(args: EmailSummarizeArgs): Promise<ToolResult> {
  try {
    const gmail = getGmailClient();
    const maxResults = args.maxResults ?? 10;

    const listRes = await gmail.users.messages.list({
      userId: "me",
      q: "is:unread",
      maxResults,
    });

    const messageIds = listRes.data.messages ?? [];
    if (messageIds.length === 0) {
      return { ok: true, data: [], summary: "No unread emails to summarize." };
    }

    const emails = await Promise.all(
      messageIds.map(async (msg) => {
        const detail = await gmail.users.messages.get({
          userId: "me",
          id: msg.id!,
          format: "metadata",
          metadataHeaders: ["From", "Subject", "Date"],
        });
        const headers = detail.data.payload?.headers ?? [];
        return {
          id: msg.id!,
          from: getHeader(headers, "From"),
          subject: getHeader(headers, "Subject"),
          date: getHeader(headers, "Date"),
          snippet: detail.data.snippet ?? "",
        };
      }),
    );

    const emailText = emails
      .map((e, i) => `${i + 1}. From: ${e.from} | Subject: ${e.subject} | Snippet: ${e.snippet}`)
      .join("\n");

    const summary = await callClaude(
      "You summarize email inboxes concisely. Highlight: action items, rejections/bad news, interview requests/scheduling, recruiter outreach, and important updates. Group by category. Be brief.",
      `Summarize these ${emails.length} unread emails:\n\n${emailText}`,
    );

    return {
      ok: true,
      data: { count: emails.length, emails },
      summary: `Inbox summary (${emails.length} unread):\n\n${summary}`,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return { ok: false, data: null, summary: `Failed to summarize emails: ${msg}` };
  }
}

export async function emailSend(args: EmailSendArgs): Promise<ToolResult> {
  try {
    const gmail = getGmailClient();

    const mimeLines = [
      `To: ${args.to}`,
      `Subject: ${args.subject}`,
      ...(args.cc ? [`Cc: ${args.cc}`] : []),
      "Content-Type: text/plain; charset=utf-8",
      "MIME-Version: 1.0",
      "",
      args.body,
    ];
    const raw = Buffer.from(mimeLines.join("\r\n")).toString("base64url");

    const res = await gmail.users.messages.send({
      userId: "me",
      requestBody: { raw },
    });

    return {
      ok: true,
      data: { id: res.data.id, threadId: res.data.threadId },
      summary: `Email sent to ${args.to}: "${args.subject}"`,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return { ok: false, data: null, summary: `Failed to send email: ${msg}` };
  }
}

export async function emailTriage(args: EmailTriageArgs): Promise<ToolResult> {
  try {
    const gmail = getGmailClient();
    const maxResults = args.maxResults ?? 25;

    const listRes = await gmail.users.messages.list({
      userId: "me",
      q: "is:unread",
      maxResults,
    });

    const messageIds = listRes.data.messages ?? [];
    if (messageIds.length === 0) {
      return { ok: true, data: {}, summary: "Inbox is clean — no unread emails." };
    }

    const emails = await Promise.all(
      messageIds.map(async (msg) => {
        const detail = await gmail.users.messages.get({
          userId: "me",
          id: msg.id!,
          format: "metadata",
          metadataHeaders: ["From", "Subject", "Date"],
        });
        const headers = detail.data.payload?.headers ?? [];
        return {
          id: msg.id!,
          from: getHeader(headers, "From"),
          subject: getHeader(headers, "Subject"),
          date: getHeader(headers, "Date"),
          snippet: detail.data.snippet ?? "",
        };
      }),
    );

    const emailText = emails
      .map((e, i) => `${i + 1}. ID:${e.id} | From: ${e.from} | Subject: ${e.subject} | Preview: ${e.snippet.slice(0, 120)}`)
      .join("\n");

    interface TriagedEmail { id: string; from: string; subject: string; note: string; }
    interface TriageResult {
      interviews: TriagedEmail[];
      opportunities: TriagedEmail[];
      rejections: TriagedEmail[];
      action_needed: TriagedEmail[];
      newsletters: TriagedEmail[];
      finance: TriagedEmail[];
      fyi: TriagedEmail[];
      tasks_to_create: { title: string; notes: string }[];
    }

    const raw = await callClaude(
      `You are an email triage assistant. Classify each email into exactly one category and suggest tasks for emails needing action.

Categories:
- interviews: interview invitations, scheduling requests, technical screens
- opportunities: recruiter outreach, job opportunities, role matches
- rejections: rejection emails, "not moving forward", "decided to go with other candidates"
- action_needed: emails requiring a response or action (not job-related)
- newsletters: mass emails, marketing, subscriptions, promotional
- finance: bills, invoices, receipts, bank statements
- fyi: informational, no action needed

Output ONLY valid JSON with this exact shape:
{
  "interviews": [{"id":"...","from":"...","subject":"...","note":"..."}],
  "opportunities": [...],
  "rejections": [...],
  "action_needed": [...],
  "newsletters": [...],
  "finance": [...],
  "fyi": [...],
  "tasks_to_create": [{"title":"...","notes":"..."}]
}

For tasks_to_create: create a task for every interview, every action_needed email, and important opportunities worth following up on.
Keep notes brief (1 line). No prose outside the JSON.`,
      `Triage these ${emails.length} unread emails:\n\n${emailText}`,
    );

    let triage: TriageResult;
    try {
      const match = raw.match(/\{[\s\S]*\}/);
      triage = JSON.parse(match?.[0] ?? raw);
    } catch {
      return { ok: false, data: null, summary: "Failed to parse triage response from Claude." };
    }

    // Auto-create tasks for action items
    let tasksCreated = 0;
    for (const t of triage.tasks_to_create ?? []) {
      if (t.title) {
        await db.task.create({ data: { title: t.title, notes: t.notes ?? null } });
        tasksCreated++;
      }
    }

    // Build summary
    const lines: string[] = [`📬 Inbox Triage — ${emails.length} unread\n`];

    if (triage.interviews?.length) {
      lines.push(`📅 Interviews (${triage.interviews.length})`);
      triage.interviews.forEach(e => lines.push(`  • ${e.from.split("<")[0].trim()} — ${e.subject}`));
    }
    if (triage.opportunities?.length) {
      lines.push(`\n🎯 Opportunities (${triage.opportunities.length})`);
      triage.opportunities.forEach(e => lines.push(`  • ${e.from.split("<")[0].trim()} — ${e.subject}`));
    }
    if (triage.rejections?.length) {
      lines.push(`\n❌ Rejections (${triage.rejections.length})`);
      triage.rejections.forEach(e => lines.push(`  • ${e.subject}`));
    }
    if (triage.action_needed?.length) {
      lines.push(`\n⚡ Needs action (${triage.action_needed.length})`);
      triage.action_needed.forEach(e => lines.push(`  • ${e.from.split("<")[0].trim()} — ${e.subject}`));
    }
    if (triage.finance?.length) {
      lines.push(`\n💰 Finance (${triage.finance.length})`);
      triage.finance.forEach(e => lines.push(`  • ${e.subject}`));
    }
    if (triage.newsletters?.length) {
      lines.push(`\n📰 Newsletters (${triage.newsletters.length}) — archive with "archive newsletters"`);
    }
    if (triage.fyi?.length) {
      lines.push(`\n📋 FYI (${triage.fyi.length})`);
    }
    if (tasksCreated > 0) {
      lines.push(`\n✅ Created ${tasksCreated} task(s) for action items`);
    }

    return {
      ok: true,
      data: triage,
      summary: lines.join("\n"),
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return { ok: false, data: null, summary: `Triage failed: ${msg}` };
  }
}

export async function emailArchive(args: EmailArchiveArgs): Promise<ToolResult> {
  try {
    const gmail = getGmailClient();

    await gmail.users.messages.modify({
      userId: "me",
      id: args.id,
      requestBody: { removeLabelIds: ["INBOX"] },
    });

    return {
      ok: true,
      data: { id: args.id },
      summary: `Archived email ${args.id} (removed from Inbox)`,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return { ok: false, data: null, summary: `Failed to archive email: ${msg}` };
  }
}
