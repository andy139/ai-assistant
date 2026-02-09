import type { Request, Response, NextFunction } from "express";
import crypto from "node:crypto";
import { config } from "../config/index.js";
import { AuthError } from "./errors.js";
import { logger } from "./logger.js";

/** Verify the X-ASSISTANT-KEY header matches the configured key. */
export function requireAssistantKey(req: Request, _res: Response, next: NextFunction): void {
  const key = req.headers["x-assistant-key"];
  if (!key || key !== config.assistantKey) {
    logger.warn("Rejected request: invalid assistant key", { ip: req.ip });
    next(new AuthError("Invalid or missing X-ASSISTANT-KEY"));
    return;
  }
  next();
}

/**
 * Verify Twilio request signature.
 * See: https://www.twilio.com/docs/usage/security#validating-requests
 */
export function verifyTwilioSignature(req: Request, _res: Response, next: NextFunction): void {
  if (!config.twilio.authToken) {
    logger.warn("Twilio auth token not configured, skipping signature verification");
    next();
    return;
  }

  const signature = req.headers["x-twilio-signature"] as string | undefined;
  if (!signature) {
    logger.warn("Rejected SMS: missing Twilio signature");
    next(new AuthError("Missing Twilio signature"));
    return;
  }

  const url = `${config.publicBaseUrl}/sms/inbound`;
  const params = req.body as Record<string, string>;

  // Build the data string: URL + sorted param key/value pairs
  const sortedKeys = Object.keys(params).sort();
  let data = url;
  for (const key of sortedKeys) {
    data += key + params[key];
  }

  const expected = crypto
    .createHmac("sha1", config.twilio.authToken)
    .update(Buffer.from(data, "utf-8"))
    .digest("base64");

  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
    logger.warn("Rejected SMS: invalid Twilio signature");
    next(new AuthError("Invalid Twilio signature"));
    return;
  }

  next();
}
