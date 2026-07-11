# TSKB0056 Quota Exhaustion Must Stop Continuation Retries

## Purpose

Prevent quota-limited local adapters from burning provider caps through automatic continuation recovery.

## Rule

When a local adapter fails because the provider quota is exhausted, the adapter must emit a quota-specific error code and continuation recovery must treat that code as non-retryable.

Do not collapse quota exhaustion into generic `adapter_failed` if the system has an automatic wake or continuation path. Generic retry handling will keep re-enqueuing the same issue chain and can consume the remaining provider cap with no chance of success.

## Required implementation shape

1. Detect quota/rate-limit exhaustion in the adapter execution layer.
2. Persist an adapter-specific error code, for example:
   - `gemini_quota_exhausted`
   - `antigravity_quota_exhausted`
3. Classify those codes as non-retryable in continuation recovery.
4. Escalate or block the issue once instead of scheduling more continuation retries.

## Why this exists

`TSMC-16038` showed that Gemini/Antigravity quota failures were surfacing as generic adapter failures, so the heartbeat wake chain had no quota awareness and kept retrying after the provider had already refused the work.

## Scope

Apply this rule to any adapter with provider-enforced quota or rate-limit failures where Paperclip can automatically retry continuation or recovery wakes.
