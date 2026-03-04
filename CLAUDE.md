# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

SMS-controlled AI agent orchestrator. Natural language commands (via SMS, HTTP, CLI, or web UI) are sent to Claude which plans actions as strict JSON, then validated against a tool allowlist with Zod schemas before execution. SQLite audit trail tracks every command, plan, and action.

## Commands

```bash
npm install                        # Install dependencies
npm run db:generate                # Generate Prisma client (after schema changes)
npm run db:push                    # Create/migrate SQLite database
npm start                          # Run server (port 3500)
npm run dev                        # Run server with watch/reload (tsx watch)
npm run build                      # TypeScript compile to dist/
npm run cli -- "your command"      # Send command via CLI (server must be running)
npm run db:studio                  # Browse database in browser
```

No test framework is configured yet. Use `DRY_RUN=true npm start` to log actions without executing.

## Architecture

**Execution pipeline** (`src/executor/executor.ts`):
1. Persist command to DB → 2. Claude plans actions as JSON → 3. Validate against tool registry + Zod schemas → 4. Execute, queue for confirmation, or dry-run log → 5. Process sub-agent delegations → 6. Return results

**Key directories:**
- `src/agent/` — Claude integration: planner, system prompt, JSON-only parser
- `src/executor/` — Pipeline orchestration, allowlist validation, confirmation queue
- `src/tools/schemas/` — Zod schemas for each tool
- `src/tools/implementations/` — Execution logic for each tool
- `src/tools/registry.ts` — Tool definitions with name, permission level, confirmation level, schema, and execute function
- `src/subagents/` — Specialized planners (job, study, fitness, discordOps) that return actions through the same pipeline
- `src/api/` — Express route handlers for each endpoint
- `src/store/` — Prisma client singleton and schema (`src/store/prisma/schema.prisma`)
- `src/ui/` — Web dashboard (static HTML served by `uiRoutes.ts`)
- `src/scheduler/` — Cron-based reminder firing

**Entry points:** `src/index.ts` (Express server), `src/cli.ts` (CLI client)

## Module System

ESM (`"type": "module"` in package.json). All local imports must use `.js` extensions (e.g., `import { foo } from "./bar.js"`). TypeScript targets ES2022 with `NodeNext` module resolution.

## Security Model

The security architecture is central to this codebase:
- **Tool allowlist**: Only tools registered in `src/tools/registry.ts` can execute; unknown tool types are rejected
- **Zod validation**: Every tool's args are validated with `.strict()` semantics — unknown fields are rejected
- **Confirmation levels**: `none`/`soft` (auto-execute), `hard` (user must confirm via SMS `confirm <id>` or `/confirm` endpoint)
- **Max actions cap**: Plans exceeding `MAX_ACTIONS` (default 5) are rejected
- **No shell/filesystem tools**: The registry intentionally has no system-level access
- **Twilio HMAC-SHA1 verification** on `/sms/inbound`; `X-ASSISTANT-KEY` header auth on `/phone/webhook`
- **Rate limiting**: 30 requests/minute per IP on all endpoints

## Adding a New Tool

1. Create Zod schema in `src/tools/schemas/<name>.ts`
2. Create implementation in `src/tools/implementations/<name>.ts` — must return `{ ok: boolean, data: unknown, summary: string }`
3. Register in `src/tools/registry.ts` with name, description, permission, confirmation level, schema, and execute function
4. Update the system prompt in `src/agent/systemPrompt.ts` so Claude knows the tool exists (add an example)

Follow the `<namespace>.<verb>` naming convention (e.g., `tasks.create`, `web.search`, `notes.list`).

## Key Patterns

- Claude's system prompt (`src/agent/systemPrompt.ts`) is dynamically built from the tool registry — tool names, fields, and permission/confirmation levels are injected automatically
- `src/agent/jsonOnly.ts` handles LLM quirks: strips markdown fences, leading prose, and trailing text before parsing
- Sub-agents (`agent.delegate` action) return `PlannerAction[]` that re-enter the same validation/execution pipeline — they never execute tools directly
- Sub-agent registry (`src/subagents/index.ts`) mirrors the tool registry pattern: a `Map<string, SubAgentDefinition>` with `register()`/`getSubAgent()` accessors
- The planner uses `claude-sonnet-4-5-20250929` (configured in `src/config/index.ts`)
- Database models: `Command` → has many `Action`s; also `Task`, `Reminder`, `Note`, and `Bookmark` tables
- Structured JSON logging via `src/utils/logger.ts`

## API Routes

- `POST /command` — Send a natural language command (`commandRoutes.ts`)
- `POST /sms/inbound` — Twilio webhook for incoming SMS (`smsRoutes.ts`)
- `POST /phone/webhook` — Authenticated phone webhook (`phoneRoutes.ts`)
- `GET /history` — Query command history (`historyRoutes.ts`)
- `GET /confirm/pending` / `POST /confirm` — Confirmation workflow (`confirmRoutes.ts`)
- `GET /health` — Health check
- `GET /` — Web dashboard

## Environment

Requires a `.env` file (see `.env.example`). Key variables:
- `CLAUDE_API_KEY` — Required
- `ASSISTANT_KEY` — Required for `/phone/webhook` auth
- `DATABASE_URL` — SQLite path (default: `file:./data.db`)
- `DRY_RUN` — Set `true` to disable execution
- `TWILIO_*` / `DISCORD_WEBHOOK_URL` / `BRAVE_SEARCH_API_KEY` — Optional integrations
