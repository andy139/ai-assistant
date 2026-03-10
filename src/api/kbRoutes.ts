/**
 * Knowledge Base API routes
 *
 * POST /kb/upload  — upload a .txt, .md, or .pdf file
 * POST /kb/url     — ingest a web page by URL
 * GET  /kb/docs    — list all documents
 * DELETE /kb/docs/:id — delete a document
 */
import { Router } from "express";
import multer from "multer";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
const pdfParse = require("pdf-parse") as (buf: Buffer) => Promise<{ text: string }>;
import { db } from "../store/db.js";
import { chunkText } from "../rag/chunker.js";
import { computeTF } from "../rag/vectorize.js";
import { logger } from "../utils/logger.js";
import type { Request, Response } from "express";

export const kbRouter = Router();

// Store files in memory (no disk writes)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (_req, file, cb) => {
    const allowed = ["text/plain", "text/markdown", "application/pdf"];
    const extOk = /\.(txt|md|pdf)$/i.test(file.originalname);
    if (allowed.includes(file.mimetype) || extOk) {
      cb(null, true);
    } else {
      cb(new Error("Only .txt, .md, and .pdf files are supported"));
    }
  },
});

// ── POST /kb/upload ──────────────────────────────────────────────────────────

kbRouter.post("/kb/upload", upload.single("file"), async (req: Request, res: Response) => {
  if (!req.file) {
    res.status(400).json({ error: "No file uploaded. Send a .txt, .md, or .pdf as form field 'file'" });
    return;
  }

  let text: string;
  try {
    if (req.file.mimetype === "application/pdf" || req.file.originalname.endsWith(".pdf")) {
      const parsed = await pdfParse(req.file.buffer);
      text = parsed.text;
    } else {
      text = req.file.buffer.toString("utf-8");
    }
  } catch (err) {
    logger.error("File parse error", { error: (err as Error).message });
    res.status(422).json({ error: "Could not parse file content" });
    return;
  }

  text = text.trim();
  if (!text) {
    res.status(422).json({ error: "File appears to be empty or has no extractable text" });
    return;
  }

  const title = (req.body.title as string | undefined) || req.file.originalname;
  const doc = await ingestText(title, text, "file");

  logger.info("Document ingested via upload", { id: doc.id, title, chunks: doc.chunkCount });
  res.json({ ok: true, id: doc.id, title, chunkCount: doc.chunkCount, charCount: text.length });
});

// ── POST /kb/url ─────────────────────────────────────────────────────────────

kbRouter.post("/kb/url", async (req: Request, res: Response) => {
  const body = req.body as { url?: string | string[]; title?: string };
  const url = Array.isArray(body.url) ? body.url[0] : body.url;
  const { title } = body;
  if (!url) {
    res.status(400).json({ error: "Provide { url } in request body" });
    return;
  }

  let html: string;
  try {
    const response = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; AssistantBot/1.0)" },
    });
    if (!response.ok) {
      res.status(422).json({ error: `Failed to fetch URL: HTTP ${response.status}` });
      return;
    }
    html = await response.text();
  } catch (err) {
    res.status(422).json({ error: `Could not fetch URL: ${(err as Error).message}` });
    return;
  }

  // Strip HTML tags
  const text = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 50_000);
  if (!text) {
    res.status(422).json({ error: "Page returned no readable text" });
    return;
  }

  const docTitle = title || new URL(url).hostname;
  const doc = await ingestText(docTitle, text, "url");

  logger.info("Document ingested via URL", { id: doc.id, title: docTitle, chunks: doc.chunkCount });
  res.json({ ok: true, id: doc.id, title: docTitle, chunkCount: doc.chunkCount, charCount: text.length });
});

// ── GET /kb/docs ─────────────────────────────────────────────────────────────

kbRouter.get("/kb/docs", async (_req: Request, res: Response) => {
  const docs = await db.document.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { chunks: true } } },
  });
  res.json(
    docs.map((d) => ({
      id: d.id,
      title: d.title,
      source: d.source,
      chunks: d._count.chunks,
      createdAt: d.createdAt,
    })),
  );
});

// ── DELETE /kb/docs/:id ───────────────────────────────────────────────────────

kbRouter.delete("/kb/docs/:id", async (req: Request, res: Response) => {
  const id = req.params["id"] as string;
  try {
    await db.document.delete({ where: { id } });
    res.json({ ok: true, deleted: id });
  } catch {
    res.status(404).json({ error: "Document not found" });
  }
});

// ── Helper ────────────────────────────────────────────────────────────────────

async function ingestText(title: string, content: string, source: string) {
  const chunks = chunkText(content);
  const doc = await db.document.create({
    data: {
      title,
      source,
      content,
      chunks: {
        create: chunks.map((c) => ({
          text: c.text,
          tfJson: JSON.stringify(computeTF(c.text)),
          chunkIndex: c.index,
        })),
      },
    },
  });
  return { id: doc.id, chunkCount: chunks.length };
}
