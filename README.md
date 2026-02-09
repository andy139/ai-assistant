# AI Assistant Orchestrator

**SMS-controlled AI agent orchestrator with LLM-planned automation and secure execution.**

Text a command to your Twilio number — a Claude-powered planner decomposes it into validated, auditable actions executed through a strict allowlist of tools. Supports modular sub-agents, confirmation workflows, dry-run mode, and a local web dashboard.

## Architecture

```
┌──────────────┐   ┌──────────────┐   ┌──────────────┐
│   SMS (Twilio) │   │  Phone Hook  │   │   Local CLI  │
│  POST /sms/   │   │ POST /phone/ │   │ POST /command│
│   inbound     │   │   webhook    │   │              │
└──────┬───────┘   └──────┬───────┘   └──────┬───────┘
       │                  │                   │
       └──────────┬───────┴───────────────────┘
                  │
                  ▼
       ┌─────────────────────┐
       │   Express Server     │
       │   Rate Limited       │
       │   Signature Verified │
       └──────────┬──────────┘
                  │
                  ▼
       ┌─────────────────────┐
       │   Claude Planner     │  ← Strict JSON-only contract
       │   (LLM as Router)    │     { "actions": [{ "type", "args" }] }
       └──────────┬──────────┘
                  │
                  ▼
       ┌─────────────────────┐
       │   Validator          │  ← Allowlist check + Zod schema validation
       │   (reject unknown)   │
       └──────────┬──────────┘
                  │
          ┌───────┼────────┐
          ▼       ▼        ▼
       ┌──────┐ ┌──────┐ ┌──────────┐
       │ Exec │ │Confirm│ │ Dry Run  │
       │ Now  │ │ Queue │ │  (log)   │
       └──┬───┘ └──┬───┘ └──────────┘
          │        │
          ▼        ▼
       ┌─────────────────────┐
       │   Tool Registry      │
       │   tasks · reminders  │
       │   discord · sms      │
       │   history · agents   │
       └──────────┬──────────┘
                  │
                  ▼
       ┌─────────────────────┐
       │   SQLite (Prisma)    │  ← Full audit trail
       │   Commands · Actions │
       │   Tasks · Reminders  │
       └─────────────────────┘
```

## Security Model

| Layer              | Mechanism                                                      |
|--------------------|----------------------------------------------------------------|
| Tool Allowlist     | Only registered tools can execute. Unknown types are rejected. |
| Schema Validation  | Every tool has a Zod schema. Unknown fields are rejected.      |
| Max Actions        | Plans exceeding `MAX_ACTIONS` (default 5) are rejected.        |
| Confirmations      | `soft` = auto-execute; `hard` = queued, user must confirm.     |
| Twilio Signatures  | Inbound SMS verified via HMAC-SHA1 signature.                  |
| API Key Auth       | Phone webhook requires `X-ASSISTANT-KEY` header.               |
| Rate Limiting      | 30 requests/minute per IP.                                     |
| DRY_RUN Mode       | When enabled, all actions are logged but not executed.          |
| No Shell Access    | No filesystem or shell execution tools exist in the registry.  |
| Audit Trail        | Every command, plan, action, and result is persisted in SQLite. |

### Confirmation Levels

| Tool             | Permission | Confirmation |
|------------------|-----------|-------------|
| tasks.create     | write     | soft        |
| tasks.list       | read      | none        |
| reminders.create | write     | hard        |
| discord.post     | write     | hard        |
| sms.reply        | write     | none        |
| history.query    | read      | none        |
| agent.delegate   | write     | soft        |

**Hard-confirm actions** are stored as `pending_confirm`. The user must text `confirm <id>` or use the web UI to approve them before execution.

## Prerequisites

- Node.js >= 20
- A [Claude API key](https://console.anthropic.com/)
- (Optional) [Twilio account](https://twilio.com) for SMS
- (Optional) Discord webhook URL for posting

## Setup

```bash
# Clone and install
cd ai-assistant
npm install

# Configure environment
cp .env.example .env
# Edit .env with your keys

# Initialize database
npm run db:generate
npm run db:push

# Start the server
npm start

# Or with file watching for development
npm run dev
```

## Exposing SMS Webhook (ngrok)

To receive SMS via Twilio, your local server needs a public URL:

```bash
# Install ngrok: https://ngrok.com/download
ngrok http 3500

# Copy the https URL, e.g. https://abc123.ngrok-free.app
# Set it in .env:
#   PUBLIC_BASE_URL=https://abc123.ngrok-free.app
```

### Twilio Setup

1. [Buy a phone number](https://console.twilio.com/us1/develop/phone-numbers/manage/incoming) on Twilio
2. Under the number's configuration, set the **Messaging webhook**:
   - **When a message comes in**: `https://your-ngrok-url.ngrok-free.app/sms/inbound`
   - **HTTP Method**: `POST`
3. Copy your Account SID, Auth Token, and phone number into `.env`

## Usage

### CLI

```bash
# Send a command (server must be running)
npm run cli -- "plan my day"
npm run cli -- "remind me gym at 6pm"
npm run cli -- "create task review PR by friday"
npm run cli -- "run job-search agent"
```

### SMS

Text your Twilio number:

```
plan my day
→ Done: Created task: "Morning planning session" | Needs confirm: reminders.create (a1b2c3d4)

confirm a1b2c3d4
→ Confirmed & executed: Reminder set: "Start your day!" at 2025-01-15T08:00:00-08:00
```

### Web UI

Open `http://localhost:3500` in your browser to:
- Send commands
- View command history with action results
- Confirm or deny pending actions

### HTTP API

```bash
# Send a command
curl -X POST http://localhost:3500/command \
  -H "Content-Type: application/json" \
  -d '{"message": "create task buy groceries"}'

# View history
curl http://localhost:3500/history?limit=10

# List pending confirmations
curl http://localhost:3500/confirm/pending

# Confirm an action
curl -X POST http://localhost:3500/confirm \
  -H "Content-Type: application/json" \
  -d '{"id": "action-uuid-here", "decision": "confirm"}'

# Phone webhook (requires API key)
curl -X POST http://localhost:3500/phone/webhook \
  -H "Content-Type: application/json" \
  -H "X-ASSISTANT-KEY: your-key" \
  -d '{"message": "post VL announcement"}'
```

## Sub-Agents

Specialized planners that return tool actions through the same execution pipeline:

| Agent       | Focus                                          |
|-------------|------------------------------------------------|
| `job`       | Job search: applications, networking, prep     |
| `study`     | Study planning: sessions, reading, practice    |
| `fitness`   | Workouts, nutrition reminders, gym schedules   |
| `discordOps`| Announcements, scheduled posts, server ops     |

```
"run job search agent: apply plan for today"
→ agent.delegate → job agent → tasks.create × 3, reminders.create × 1
```

Sub-agents don't execute directly — the orchestrator validates and executes (or queues) their recommended actions.

## Project Structure

```
src/
  index.ts                    # Express server entry point
  cli.ts                      # CLI client
  config/index.ts             # Environment config
  agent/
    claudeClient.ts           # Anthropic SDK wrapper
    systemPrompt.ts           # Planner system prompt
    planner.ts                # Main planner: message → actions
    jsonOnly.ts               # Strict JSON parsing + validation
  subagents/
    index.ts                  # Sub-agent registry
    jobAgent.ts               # Job search planning
    studyAgent.ts             # Study session planning
    fitnessAgent.ts           # Fitness/workout planning
    discordOpsAgent.ts        # Discord operations
  executor/
    validator.ts              # Allowlist + schema validation
    executor.ts               # Full command pipeline
    confirmations.ts          # Pending confirmation management
  tools/
    registry.ts               # Tool definitions + registry
    schemas/*.ts              # Zod schemas per tool
    implementations/*.ts      # Tool execution logic
  scheduler/scheduler.ts      # Cron-based reminder scheduler
  api/
    commandRoutes.ts          # POST /command
    smsRoutes.ts              # POST /sms/inbound
    phoneRoutes.ts            # POST /phone/webhook
    historyRoutes.ts          # GET /history
    confirmRoutes.ts          # GET /confirm/pending, POST /confirm
  store/
    prisma/schema.prisma      # Database schema
    db.ts                     # Prisma client singleton
  ui/
    index.html                # Web dashboard
    uiRoutes.ts               # Static file serving
  utils/
    logger.ts                 # Structured JSON logger
    errors.ts                 # Typed error classes
    security.ts               # Auth, Twilio verification, rate limiting
```

## Roadmap

- [ ] SMS notification for fired reminders (Twilio outbound)
- [ ] Multi-turn conversations (context memory per phone number)
- [ ] Calendar integration (Google Calendar tool)
- [ ] Email tool (send/read via Gmail API)
- [ ] Recurring task scheduling
- [ ] Sub-agent isolation (separate processes with message passing)
- [ ] WebSocket push for real-time UI updates
- [ ] Authentication for the web dashboard
- [ ] Prometheus metrics endpoint
- [ ] Docker deployment with docker-compose

## License

MIT
