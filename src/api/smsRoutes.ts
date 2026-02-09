import { Router } from "express";
import { executeCommand, executeConfirmedAction } from "../executor/executor.js";
import { resolveConfirmation } from "../executor/confirmations.js";
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

    // Handle confirmation commands: "confirm <id>" or "deny <id>"
    const confirmMatch = message.match(/^(confirm|deny)\s+([a-f0-9-]+)/i);
    if (confirmMatch) {
      const decision = confirmMatch[1].toLowerCase() as "confirm" | "deny";
      const actionId = confirmMatch[2];

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
