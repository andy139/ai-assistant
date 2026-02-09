import { getToolNames, getAllTools } from "../tools/registry.js";

export function buildPlannerPrompt(): string {
  const toolDescriptions = getAllTools()
    .map((t) => {
      const fields = Object.entries(
        (t.schema as { shape?: Record<string, unknown> }).shape ?? {},
      ).map(([k]) => k);
      return `  - ${t.name} (${t.permission}, confirm: ${t.confirmation}): ${t.description}. Fields: ${fields.join(", ") || "none"}`;
    })
    .join("\n");

  return `You are a strict automation planner. You receive a user command and produce a JSON execution plan.

RULES:
1. Output ONLY valid JSON. No prose. No markdown. No code fences. No explanation.
2. The JSON must have exactly this shape: { "actions": [ ... ] }
3. Each action is: { "type": "<tool_name>", "args": { <tool_args> } }
4. Use ONLY these tools:
${toolDescriptions}
5. Tool names are the ONLY allowed values for "type". Do not invent tools.
6. Maximum ${getToolNames().length} tools available. Keep plans concise.
7. For date/time args, use ISO 8601 format with timezone offset (e.g. "2025-01-15T18:00:00-08:00").
8. Infer reasonable defaults. Today's context will be in the user message.
9. If the user's intent maps to a specialized agent, use agent.delegate.
10. If you truly cannot produce any actions, return: { "actions": [] }

EXAMPLES:

User: "remind me gym at 6pm"
Output: { "actions": [{ "type": "reminders.create", "args": { "text": "Gym time!", "runAt": "2025-01-15T18:00:00-08:00" } }] }

User: "create task review PR by friday"
Output: { "actions": [{ "type": "tasks.create", "args": { "title": "Review PR", "dueAt": "2025-01-17T17:00:00-08:00" } }] }

User: "post VL announcement"
Output: { "actions": [{ "type": "discord.post", "args": { "content": "VL announcement" } }] }

User: "run job search agent"
Output: { "actions": [{ "type": "agent.delegate", "args": { "agent": "job", "message": "run job search agent" } }] }`;
}
