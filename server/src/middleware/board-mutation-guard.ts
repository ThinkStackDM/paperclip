import type { Request, RequestHandler } from "express";
import type { Db } from "@paperclipai/db";

interface BoardMutationGuardOptions {
  db?: Db;
  hasActiveHeartbeatRun?: (runId: string) => Promise<boolean>;
}

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

function localImplicitRunId(req: Request): string | null {
  if (req.actor.source !== "local_implicit") return null;
  const runId = req.actor.runId?.trim();
  return runId || null;
}

const DEFAULT_DEV_ORIGINS = [
  "http://localhost:3100",
  "http://127.0.0.1:3100",
];

function parseOrigin(value: string | undefined) {
  if (!value) return null;
  try {
    const url = new URL(value);
    return `${url.protocol}//${url.host}`.toLowerCase();
  } catch {
    return null;
  }
}

function trustedOriginsForRequest(req: Request) {
  const origins = new Set(DEFAULT_DEV_ORIGINS.map((value) => value.toLowerCase()));
  const forwardedHost = req.header("x-forwarded-host")?.split(",")[0]?.trim();
  const host = forwardedHost || req.header("host")?.trim();
  if (host) {
    origins.add(`http://${host}`.toLowerCase());
    origins.add(`https://${host}`.toLowerCase());
  }
  // Behind some reverse proxies the Host / X-Forwarded-Host header may
  // not match the public URL (for example when TLS terminates at the
  // edge and the inbound Host is an internal service name). Trust the
  // explicitly-configured PAPERCLIP_PUBLIC_URL when it's set.
  const publicUrl = parseOrigin(process.env.PAPERCLIP_PUBLIC_URL?.trim());
  if (publicUrl) origins.add(publicUrl);
  return origins;
}

function isTrustedBoardMutationRequest(req: Request) {
  const allowedOrigins = trustedOriginsForRequest(req);
  const origin = parseOrigin(req.header("origin"));
  if (origin && allowedOrigins.has(origin)) return true;

  const refererOrigin = parseOrigin(req.header("referer"));
  if (refererOrigin && allowedOrigins.has(refererOrigin)) return true;

  return false;
}

export function boardMutationGuard(_opts: BoardMutationGuardOptions = {}): RequestHandler {
  return async (req, res, next) => {
    if (SAFE_METHODS.has(req.method.toUpperCase())) {
      next();
      return;
    }

    if (req.actor.type !== "board") {
      next();
      return;
    }

    // Local-trusted mode, board bearer keys, and trusted Cloud tenant calls are
    // not browser-session requests.
    // In these modes, origin/referer headers can be absent; do not block those mutations.
    if (req.actor.source === "local_implicit") {
      const runId = localImplicitRunId(req);
      if (!runId) {
        next();
        return;
      }
      res.status(401).json({ error: "Agent run mutations require agent authentication" });
      return;
    }

    if (req.actor.source === "board_key" || req.actor.source === "cloud_tenant") {
      next();
      return;
    }

    if (!isTrustedBoardMutationRequest(req)) {
      res.status(403).json({ error: "Board mutation requires trusted browser origin" });
      return;
    }

    next();
  };
}
