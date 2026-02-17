/**
 * One-time Gmail OAuth2 setup script.
 * Run: npx tsx scripts/gmail-auth.ts
 *
 * Prerequisites:
 *   1. Create a Google Cloud project at https://console.cloud.google.com
 *   2. Enable the Gmail API
 *   3. Create OAuth2 credentials (Desktop app type)
 *   4. Set GMAIL_CLIENT_ID and GMAIL_CLIENT_SECRET in your .env
 */

import dotenv from "dotenv";
import { google } from "googleapis";
import * as readline from "readline";

dotenv.config();

const SCOPES = [
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/gmail.modify",
];

async function main() {
  const clientId = process.env.GMAIL_CLIENT_ID;
  const clientSecret = process.env.GMAIL_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    console.error("Error: Set GMAIL_CLIENT_ID and GMAIL_CLIENT_SECRET in your .env file first.");
    process.exit(1);
  }

  const oauth2 = new google.auth.OAuth2(clientId, clientSecret, "urn:ietf:wg:oauth:2.0:oob");

  const authUrl = oauth2.generateAuthUrl({
    access_type: "offline",
    scope: SCOPES,
    prompt: "consent",
  });

  console.log("\n1. Open this URL in your browser:\n");
  console.log(authUrl);
  console.log("\n2. Grant access and copy the authorization code.\n");

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const code = await new Promise<string>((resolve) => {
    rl.question("3. Paste the code here: ", (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });

  const { tokens } = await oauth2.getToken(code);

  if (!tokens.refresh_token) {
    console.error("\nNo refresh token received. Try revoking access at https://myaccount.google.com/permissions and re-running.");
    process.exit(1);
  }

  console.log("\nSuccess! Add this to your .env file:\n");
  console.log(`GMAIL_REFRESH_TOKEN=${tokens.refresh_token}`);
}

main().catch((err) => {
  console.error("OAuth error:", err.message ?? err);
  process.exit(1);
});
