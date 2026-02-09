import dotenv from "dotenv";
dotenv.config();

const PORT = process.env.PORT || "3500";
const BASE = `http://localhost:${PORT}`;

async function main() {
  const message = process.argv.slice(2).join(" ").trim();

  if (!message) {
    console.error("Usage: assistant <message>");
    console.error('  Example: assistant "plan my day"');
    process.exit(1);
  }

  console.log(`→ Sending: "${message}"`);
  console.log(`→ Server:  ${BASE}/command\n`);

  try {
    const res = await fetch(`${BASE}/command`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message }),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error(`Error (${res.status}): ${text}`);
      process.exit(1);
    }

    const data = (await res.json()) as {
      status: string;
      summary: string;
      actions?: Array<{
        actionId: string;
        type: string;
        status: string;
        result?: { summary?: string };
        error?: string;
      }>;
      errors?: string[];
    };

    console.log(`Status:  ${data.status}`);
    console.log(`Summary: ${data.summary}\n`);

    if (data.actions?.length) {
      console.log("Actions:");
      for (const action of data.actions) {
        const icon =
          action.status === "executed" ? "✓" :
          action.status === "pending_confirm" ? "?" :
          action.status === "dry_run" ? "~" :
          "✗";
        console.log(`  ${icon} ${action.type} [${action.status}]`);
        if (action.status === "pending_confirm") {
          console.log(`    → Confirm: curl -X POST ${BASE}/confirm -H "Content-Type: application/json" -d '{"id":"${action.actionId}","decision":"confirm"}'`);
        }
        if (action.result?.summary) {
          console.log(`    → ${action.result.summary}`);
        }
        if (action.error) {
          console.log(`    → Error: ${action.error}`);
        }
      }
    }

    if (data.errors?.length) {
      console.log("\nErrors:");
      for (const err of data.errors) {
        console.log(`  ✗ ${err}`);
      }
    }
  } catch (err) {
    if (err instanceof TypeError && (err as NodeJS.ErrnoException).cause) {
      console.error(`Cannot connect to server at ${BASE}. Is it running? (npm start)`);
    } else {
      console.error(`Error: ${err instanceof Error ? err.message : err}`);
    }
    process.exit(1);
  }
}

main();
