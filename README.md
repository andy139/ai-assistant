# AI Assistant Orchestrator

A production-grade AI agent platform that accepts natural language commands over SMS, HTTP, CLI, Telegram, and Discord — and executes them as validated, auditable actions. Built with TypeScript, Claude (Anthropic), and SQLite.

---

## Features

### Multi-Channel Input
- **SMS** via Twilio (HMAC-SHA1 verified)
- **REST API** (`POST /command`)
- **CLI** (`npm run cli -- "your command"`)
- **Telegram bot** (long-polling)
- **Discord bot**

### LLM Planning Pipeline
Every command goes through a structured pipeline:

```
User Input → Claude (JSON planner) → Zod schema validation → Tool allowlist check → Execute → SQLite audit log
```

Claude never runs code directly. It outputs a strict JSON action plan that is validated against registered schemas before anything executes.

### RAG — Knowledge Base
Upload documents and ask questions about them. The assistant automatically retrieves relevant context and injects it into every LLM prompt.

- Upload `.txt`, `.md`, `.pdf` files via `POST /kb/upload`
- Ingest web pages via `POST /kb/url`
- Documents are chunked (500 chars, 100-char overlap) and indexed with TF-IDF vectors
- At query time, cosine similarity retrieves top-3 relevant chunks
- Context is silently prepended to the planner prompt — no extra user step required

### Multi-Step Research Agent (ReAct Loop)
A Reasoning + Acting agent that iteratively searches the web before synthesizing an answer:

1. Decides what to search based on the task
2. Executes a `web.search` call, observes results
3. Evaluates: is this enough, or do I need more?
4. Repeats up to 3 iterations
5. Synthesizes a final comprehensive answer

```
"research how WebSockets compare to SSE"
→ searches "WebSocket vs SSE performance"
→ searches "SSE use cases 2024"
→ synthesizes → returns formatted answer
```

### Specialized Sub-Agents
Domain-specific planners invoked via `agent.delegate`:

| Agent | Purpose |
|---|---|
| `job` | Job search planning, email triage, application tracking |
| `study` | Study schedules, flashcards, progress tracking |
| `fitness` | Workout plans, reminders, habit tracking |
| `discordOps` | Discord channel management and announcements |
| `research` | Multi-step web research with ReAct loop |

### Tool Registry (25+ tools)
All tools are registered with name, permission level, confirmation level, and a Zod schema. Unknown tools are rejected at the validator before execution.

| Category | Tools |
|---|---|
| Tasks | `tasks.create`, `tasks.list`, `tasks.complete`, `tasks.delete` |
| Reminders | `reminders.create`, `reminders.list`, `reminders.delete` |
| Notes | `notes.create`, `notes.search`, `notes.list` |
| Knowledge Base | `kb.ingest`, `kb.search`, `kb.list` |
| Web | `web.search` (Brave), `web.summarize` |
| Email | `email.list`, `email.read`, `email.send`, `email.summarize`, `email.archive`, `email.triage` |
| Messaging | `sms.reply`, `telegram.reply`, `discord.post`, `assistant.reply` |
| Utility | `weather.current`, `briefing.get`, `history.query`, `agent.delegate` |

### Security Model
- **Tool allowlist**: only registered tools can execute — unknown tool names are rejected
- **Zod `.strict()` validation**: extra fields on any action are rejected
- **Confirmation levels**: `none` (auto-run), `soft` (auto-run with log), `hard` (user must reply "yes")
- **Max actions cap**: plans with more than 5 actions are rejected
- **Twilio HMAC-SHA1 verification** on `/sms/inbound`
- **API key auth** (`X-ASSISTANT-KEY`) on `/phone/webhook`
- **Rate limiting**: 30 req/min per IP

### Audit Trail
Every command, plan, and action result is persisted to SQLite via Prisma. Browse with `npm run db:studio`.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js 20+, TypeScript (ESM) |
| LLM | Anthropic Claude (`claude-sonnet-4-5`) |
| Database | SQLite via Prisma ORM |
| API | Express.js |
| SMS | Twilio |
| Messaging | Telegram Bot API, Discord.js |
| Email | Gmail API (OAuth2) |
| Web Search | Brave Search API |
| File Parsing | multer (upload), pdf-parse (PDF text extraction) |
| Validation | Zod |

---

## Architecture

```
src/
├── agent/           # Claude integration: planner, system prompt, JSON parser
├── executor/        # Pipeline orchestration, allowlist validation, confirmations
├── tools/
│   ├── schemas/     # Zod schemas for every tool
│   ├── implementations/  # Execution logic — each returns { ok, data, summary }
│   └── registry.ts  # Tool registration: name, permission, confirmation, schema, execute
├── subagents/       # Specialized planners (job, study, fitness, discordOps, research)
├── rag/             # RAG system: chunker, TF-IDF vectorizer, retriever
├── api/             # Express route handlers
├── store/           # Prisma client + schema (Command, Action, Task, Note, Document…)
├── scheduler/       # Cron-based reminder firing
├── telegram/        # Telegram bot
├── discord/         # Discord bot
└── ui/              # Web dashboard
```

---

## Quick Start

```bash
# Install dependencies
npm install

# Set up environment
cp .env.example .env
# Add your CLAUDE_API_KEY at minimum

# Create database
npm run db:push

# Start server
npm run dev

# Send a command
npm run cli -- "create task finish the slides by Friday"
npm run cli -- "remind me to call mom at 6pm"
npm run cli -- "research how transformers work in NLP"
```

### Upload a Document to the Knowledge Base

```bash
# Upload a file
curl -X POST http://localhost:3500/kb/upload \
  -F "file=@resume.pdf" \
  -F "title=My Resume"

# Ingest a web page
curl -X POST http://localhost:3500/kb/url \
  -H "Content-Type: application/json" \
  -d '{"url": "https://docs.example.com", "title": "Project Docs"}'

# Now ask about it — RAG context is injected automatically
npm run cli -- "what's my experience with React?"

# List all documents
curl http://localhost:3500/kb/docs
```

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `CLAUDE_API_KEY` | Yes | Anthropic API key |
| `ASSISTANT_KEY` | Yes | Auth key for `/phone/webhook` |
| `DATABASE_URL` | No | SQLite path (default: `file:./data.db`) |
| `TWILIO_ACCOUNT_SID` | No | Twilio SMS |
| `TWILIO_AUTH_TOKEN` | No | Twilio SMS |
| `TWILIO_PHONE_NUMBER` | No | Twilio SMS |
| `TELEGRAM_BOT_TOKEN` | No | Telegram bot |
| `DISCORD_BOT_TOKEN` | No | Discord bot |
| `DISCORD_WEBHOOK_URL` | No | Discord webhook for posts |
| `BRAVE_SEARCH_API_KEY` | No | Web search (required for research agent) |
| `GMAIL_CLIENT_ID` | No | Gmail integration |
| `GMAIL_CLIENT_SECRET` | No | Gmail integration |
| `DRY_RUN` | No | Set `true` to log actions without executing |

---

## API Reference

| Method | Path | Description |
|---|---|---|
| `POST` | `/command` | Send a natural language command |
| `POST` | `/sms/inbound` | Twilio webhook |
| `GET` | `/history` | Query command history |
| `GET` | `/confirm/pending` | List actions awaiting confirmation |
| `POST` | `/confirm` | Confirm or deny a pending action |
| `POST` | `/kb/upload` | Upload `.txt`, `.md`, or `.pdf` to knowledge base |
| `POST` | `/kb/url` | Ingest a web page into knowledge base |
| `GET` | `/kb/docs` | List all knowledge base documents |
| `DELETE` | `/kb/docs/:id` | Delete a document |
| `GET` | `/health` | Health check |
| `GET` | `/` | Web dashboard |

---

## How to Add a New Tool

1. Define a Zod schema in `src/tools/schemas/<name>.ts`
2. Write the implementation in `src/tools/implementations/<name>.ts` — return `{ ok, data, summary }`
3. Register in `src/tools/registry.ts` with `name`, `description`, `permission`, `confirmation`, `schema`, `execute`
4. Add an example to `src/agent/systemPrompt.ts`

Follow the `<namespace>.<verb>` convention (e.g. `calendar.create`, `slack.post`).

---

## Database Schema

```
Command  →  Action[]        (full audit trail of every plan + execution)
Task                        (to-dos with status and due date)
Reminder                    (scheduled notifications)
Note                        (tagged quick notes)
Bookmark                    (saved URLs)
Document  →  DocumentChunk[]  (knowledge base with TF-IDF vectors)
```
