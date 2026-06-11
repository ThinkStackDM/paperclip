#!/usr/bin/env node

import {
  fetchGeminiCodeAssistQuota,
  getQuotaWindows,
  readGeminiOAuthCreds,
} from "../server/quota.js";

interface ProbeArgs {
  json: boolean;
}

function parseArgs(argv: string[]): ProbeArgs {
  return { json: argv.includes("--json") };
}

function stringifyError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  const creds = await readGeminiOAuthCreds();
  const result: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
    tokenAvailable: creds != null,
    tokenExpiresAt: creds?.expiryDate != null ? new Date(creds.expiryDate).toISOString() : null,
  };

  try {
    result.codeAssist = { ok: true, ...(await fetchGeminiCodeAssistQuota()) };
  } catch (error) {
    result.codeAssist = { ok: false, error: stringifyError(error), windows: [] };
  }

  result.aggregated = await getQuotaWindows();

  const ok = (result.aggregated as { ok?: boolean } | undefined)?.ok === true;

  if (args.json || process.stdout.isTTY === false) {
    console.log(JSON.stringify({ ok, ...result }, null, 2));
  } else {
    console.log(`timestamp: ${result.timestamp}`);
    console.log(`tokenAvailable: ${creds != null}`);
    console.log(`codeAssist: ${JSON.stringify(result.codeAssist, null, 2)}`);
    console.log(`aggregated: ${JSON.stringify(result.aggregated, null, 2)}`);
  }

  if (!ok) process.exitCode = 1;
}

await main();
