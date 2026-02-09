import dotenv from "dotenv";
dotenv.config();

function required(key: string): string {
  const val = process.env[key];
  if (!val) throw new Error(`Missing required env var: ${key}`);
  return val;
}

function optional(key: string, fallback: string): string {
  return process.env[key] || fallback;
}

export const config = {
  port: parseInt(optional("PORT", "3500"), 10),
  assistantKey: required("ASSISTANT_KEY"),
  dryRun: optional("DRY_RUN", "false") === "true",
  maxActions: parseInt(optional("MAX_ACTIONS", "5"), 10),

  claude: {
    apiKey: required("CLAUDE_API_KEY"),
    model: "claude-sonnet-4-5-20250929" as const,
  },

  database: {
    url: optional("DATABASE_URL", "file:./data.db"),
  },

  discord: {
    webhookUrl: process.env.DISCORD_WEBHOOK_URL || "",
  },

  twilio: {
    accountSid: process.env.TWILIO_ACCOUNT_SID || "",
    authToken: process.env.TWILIO_AUTH_TOKEN || "",
    phoneNumber: process.env.TWILIO_PHONE_NUMBER || "",
  },

  publicBaseUrl: process.env.PUBLIC_BASE_URL || "",
} as const;
