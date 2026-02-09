import Twilio from "twilio";
import { config } from "../../config/index.js";
import { logger } from "../../utils/logger.js";
import type { SmsReplyArgs } from "../schemas/sms.js";
import type { ToolResult } from "../registry.js";

export async function smsReply(args: SmsReplyArgs): Promise<ToolResult> {
  if (!config.twilio.accountSid || !config.twilio.authToken) {
    return { ok: false, data: null, summary: "Twilio credentials not configured" };
  }

  const client = Twilio(config.twilio.accountSid, config.twilio.authToken);

  try {
    const message = await client.messages.create({
      body: args.message,
      from: config.twilio.phoneNumber,
      to: args.to,
    });

    logger.info("SMS sent", { sid: message.sid, to: args.to });
    return { ok: true, data: { sid: message.sid }, summary: `SMS sent to ${args.to}` };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    logger.error("SMS send failed", { error: msg });
    return { ok: false, data: null, summary: `SMS failed: ${msg}` };
  }
}
