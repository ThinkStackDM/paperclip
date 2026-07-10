export type IssueCommentSystemActivityKind =
  | "system_notice"
  | "wake_payload"
  | "missing_disposition"
  | "missing_disposition_recovery_blocked"
  | "board_action_resolved"
  | "fallback_transfer";

export type IssueCommentSystemActivityClassification = {
  kind: IssueCommentSystemActivityKind;
  title: string;
  tone: "neutral" | "info" | "success" | "warning" | "danger";
};

export type IssueCommentSystemActivityLike = {
  body: string;
  authorType?: string | null;
  authorAgentId?: string | null;
  authorUserId?: string | null;
  presentation?: {
    kind?: string | null;
    tone?: "neutral" | "info" | "success" | "warning" | "danger" | null;
    title?: string | null;
    detailsDefaultOpen?: boolean | null;
  } | null;
};

const WAKE_PAYLOAD_PREFIXES = [
  "Paperclip Wake Payload",
  "Paperclip Resume Delta",
] as const;

const FALLBACK_TRANSFER_PATTERNS = [
  /^OpCo fallback dispatcher has no deterministic handler for this wake;/i,
  /^Fallback dispatcher has no deterministic handler for this wake;/i,
  /routing to the active fallback sister lane\./i,
] as const;

export function classifyIssueCommentSystemActivity(
  comment: IssueCommentSystemActivityLike,
): IssueCommentSystemActivityClassification | null {
  const body = comment.body.trim();
  if (body.length === 0) return null;

  if (comment.authorUserId == null && comment.presentation?.kind === "system_notice") {
    return {
      kind: "system_notice",
      title: comment.presentation.title?.trim() || "System activity",
      tone: comment.presentation.tone ?? "neutral",
    };
  }

  if (comment.authorType === "system") {
    return {
      kind: "system_notice",
      title: comment.presentation?.title?.trim() || "System activity",
      tone: comment.presentation?.tone ?? "neutral",
    };
  }

  if (comment.authorUserId) return null;

  if (WAKE_PAYLOAD_PREFIXES.some((prefix) => body.startsWith(prefix))) {
    return {
      kind: "wake_payload",
      title: "Wake payload",
      tone: "neutral",
    };
  }

  if (body === "Paperclip needs a disposition before this issue can continue.") {
    return {
      kind: "missing_disposition",
      title: "Missing issue disposition",
      tone: "warning",
    };
  }

  if (body === "Paperclip could not resolve this issue's missing disposition automatically. The issue is blocked on a recovery owner.") {
    return {
      kind: "missing_disposition_recovery_blocked",
      title: "Missing disposition recovery blocked",
      tone: "danger",
    };
  }

  if (body.startsWith("Board action resolved — no board decision is pending.")) {
    return {
      kind: "board_action_resolved",
      title: "Board action resolved",
      tone: "info",
    };
  }

  if (FALLBACK_TRANSFER_PATTERNS.some((pattern) => pattern.test(body))) {
    return {
      kind: "fallback_transfer",
      title: "Recovery routing note",
      tone: "neutral",
    };
  }

  return null;
}

export function buildIssueCommentSystemActivityPresentation(
  classification: IssueCommentSystemActivityClassification,
) {
  return {
    kind: "system_notice" as const,
    tone: classification.tone,
    title: classification.title,
    detailsDefaultOpen: false,
  };
}
