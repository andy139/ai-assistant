import { Router } from "express";
import { executeCommand, executeConfirmedAction } from "../executor/executor.js";
import { resolveConfirmation, getLatestPendingConfirmation, resolveAllPending } from "../executor/confirmations.js";
import { verifyTwilioSignature } from "../utils/security.js";
import { logger } from "../utils/logger.js";
import type { Request, Response } from "express";

export const smsRouter = Router();

/**
 * POST /sms/inbound
 * Twilio webhook endpoint. Receives SMS, runs the command pipeline, replies via TwiML.
 */
smsRouter.post("/sms/inbound", verifyTwilioSignature, async (req: Request, res: Response) => {
  const from = req.body.From as string | undefined;
  const body = req.body.Body as string | undefined;

  if (!from || !body) {
    res.status(400).type("text/xml").send("<Response><Message>Invalid request</Message></Response>");
    return;
  }

  const message = body.trim();
  logger.info("SMS received", { from, message: message.slice(0, 100) });

  try {
    let replyText: string;

    // Handle "confirm all" / "yes all" / "deny all"
    const allConfirm = /^(yes|confirm)\s+all$/i.test(message);
    const allDeny = /^(no|deny)\s+all$/i.test(message);

    // Handle "confirm <id>" / "deny <id>"
    const confirmMatch = message.match(/^(confirm|deny)\s+([a-f0-9-]+)/i);

    // Handle bare "yes" / "no"
    const bareConfirm = /^(yes|confirm|yep|yea|yeah|y)$/i.test(message);
    const bareDeny = /^(no|deny|nope|nah|n)$/i.test(message);

    if (allConfirm || allDeny) {
      const decision = allConfirm ? "confirm" : "deny";
      const actions = await resolveAllPending(decision);
      if (!actions.length) {
        replyText = "Nothing pending to confirm.";
      } else if (decision === "confirm") {
        const results = [];
        for (const action of actions) {
          const result = await executeConfirmedAction(action.id);
          results.push(result.status === "executed"
            ? (result.result?.summary ?? result.type)
            : `${result.type} failed: ${result.error}`);
        }
        replyText = `Confirmed ${actions.length} action(s):\n${results.map(r => `- ${r}`).join("\n")}`;
      } else {
        replyText = `Denied ${actions.length} action(s).`;
      }
    } else if (confirmMatch || bareConfirm || bareDeny) {
      let actionId: string | null = confirmMatch?.[2] ?? null;
      const decision: "confirm" | "deny" = (confirmMatch
        ? confirmMatch[1].toLowerCase() === "deny"
        : bareDeny) ? "deny" : "confirm";

      if (!actionId) {
        const latest = await getLatestPendingConfirmation();
        actionId = latest?.id ?? null;
      }

      if (!actionId) {
        replyText = "Nothing pending to confirm.";
      } else {
        const action = await resolveConfirmation(actionId, decision);
        if (!action) {
          replyText = `No pending action found for ID: ${actionId.slice(0, 8)}`;
        } else if (decision === "confirm") {
          const result = await executeConfirmedAction(actionId);
          replyText = result.status === "executed"
            ? `Confirmed & executed: ${result.result?.summary ?? result.type}`
            : `Confirmed but failed: ${result.error ?? "unknown error"}`;
        } else {
          replyText = `Denied: ${action.type} (${actionId.slice(0, 8)})`;
        }
      }
    } else {
      // Normal command
      const result = await executeCommand(message, "sms", from);
      replyText = result.summary;
    }

    // Truncate for SMS (160 char limit for single segment)
    if (replyText.length > 1500) {
      replyText = replyText.slice(0, 1497) + "...";
    }

    res.type("text/xml").send(
      `<Response><Message>${escapeXml(replyText)}</Message></Response>`,
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Internal error";
    logger.error("SMS processing error", { from, error: msg });
    res.type("text/xml").send(
      `<Response><Message>Error processing your request. Try again.</Message></Response>`,
    );
  }
});

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
