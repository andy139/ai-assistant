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
npm run dev                        # Run server with watch/reload
npm run build                      # TypeScript compile to dist/
npm run cli -- "your command"      # Send command via CLI
npm run db:studio                  # Browse database in browser
```

No test framework is configured yet.

## Architecture

**Execution pipeline** (`src/executor/executor.ts`):
1. Persist command to DB → 2. Claude plans actions as JSON → 3. Validate against tool registry + Zod schemas → 4. Execute or queue for confirmation → 5. Process sub-agent delegations → 6. Return results

**Key directories:**
- `src/agent/` — Claude integration: planner, system prompt, JSON-only parser
- `src/executor/` — Pipeline orchestration, allowlist validation, confirmation queue
- `src/tools/schemas/` — Zod schemas for each tool (tasks, reminders, discord, sms, history, agentDelegate)
- `src/tools/implementations/` — Execution logic for each tool
- `src/tools/registry.ts` — Tool definitions with name, permission level, confirmation level, schema, and execute function
- `src/subagents/` — Specialized planners (job, study, fitness, discordOps) that return actions through the same pipeline
- `src/api/` — Express route handlers for each endpoint
- `src/store/` — Prisma client singleton and schema

**Entry points:** `src/index.ts` (Express server), `src/cli.ts` (CLI client)

## Security Model

The security architecture is central to this codebase:
- **Tool allowlist**: Only tools registered in `src/tools/registry.ts` can execute; unknown tool types are rejected
- **Zod validation**: Every tool's args are validated and unknown fields are rejected
- **Confirmation levels**: `none` (auto-execute), `soft` (auto-execute), `hard` (user must confirm via SMS or `/confirm` endpoint)
- **Max actions cap**: Plans exceeding `MAX_ACTIONS` (default 5) are rejected
- **No shell/filesystem tools**: The registry intentionally has no system-level access
- **Twilio HMAC-SHA1 verification** on `/sms/inbound`; API key auth on `/phone/webhook`

## Adding a New Tool

1. Create Zod schema in `src/tools/schemas/`
2. Create implementation in `src/tools/implementations/`
3. Register in `src/tools/registry.ts` with name, description, permission, confirmation level, schema, and execute function
4. Update the system prompt in `src/agent/systemPrompt.ts` so Claude knows the tool exists

## Key Patterns

- Claude's system prompt enforces JSON-only output; `src/agent/jsonOnly.ts` handles LLM quirks (markdown fences, leading prose)
- Sub-agents (`agent.delegate` action) return `PlannerAction[]` that re-enter the same validation/execution pipeline
- The `DRY_RUN=true` env var logs all actions without executing, useful for testing prompts
- Database models: `Command` → has many `Action`s; also `Task` and `Reminder` tables
- Structured JSON logging via `src/utils/logger.ts`

## Environment

Requires a `.env` file (see `.env.example`). Key variables:
- `CLAUDE_API_KEY` — Required
- `ASSISTANT_KEY` — Required for `/phone/webhook` auth
- `DATABASE_URL` — SQLite path (default: `file:./data.db`)
- `DRY_RUN` — Set `true` to disable execution
- `TWILIO_*` / `DISCORD_WEBHOOK_URL` — Optional integrations
