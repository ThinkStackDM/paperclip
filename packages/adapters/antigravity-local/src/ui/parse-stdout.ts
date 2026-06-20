import type { TranscriptEntry } from "@paperclipai/adapter-utils";

export function parseAntigravityStdoutLine(line: string, ts: string): TranscriptEntry[] {
  return line.trim().length > 0 ? [{ kind: "assistant", ts, text: line }] : [];
}

export function createAntigravityStdoutParser() {
  return {
    parseLine(line: string, ts: string): TranscriptEntry[] {
      return parseAntigravityStdoutLine(line, ts);
    },
    reset() {},
  };
}
