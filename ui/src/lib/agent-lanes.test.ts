import { describe, expect, it } from "vitest";
import { getAgentFallbackLane, groupAgentFallbackLanes } from "./agent-lanes";

describe("getAgentFallbackLane", () => {
  it("detects known lane suffixes", () => {
    expect(getAgentFallbackLane("GLaD0S-Codex")).toEqual({ base: "GLaD0S", lane: "Codex" });
    expect(getAgentFallbackLane("Kestrel-Grok")).toEqual({ base: "Kestrel", lane: "Grok" });
    expect(getAgentFallbackLane("Athena-Hermes")).toEqual({ base: "Athena", lane: "Hermes" });
    expect(getAgentFallbackLane("RoutineOps-Gemini")).toEqual({ base: "RoutineOps", lane: "Gemini" });
  });

  it("ignores non-lane names", () => {
    expect(getAgentFallbackLane("GLaD0S")).toBeNull();
    expect(getAgentFallbackLane("CodexEngineer")).toBeNull();
    expect(getAgentFallbackLane("MC-Compiler")).toBeNull();
    expect(getAgentFallbackLane("-Codex")).toBeNull();
  });
});

describe("groupAgentFallbackLanes", () => {
  it("moves clones directly after their primary, preserving relative order", () => {
    const names = ["GLaD0S-Grok", "Astra", "GLaD0S", "Astra-Codex", "GLaD0S-Codex", "RoutingPA"];
    const grouped = groupAgentFallbackLanes(names.map((name) => ({ name }))).map((a) => a.name);
    expect(grouped).toEqual(["Astra", "Astra-Codex", "GLaD0S", "GLaD0S-Grok", "GLaD0S-Codex", "RoutingPA"]);
  });

  it("leaves clones without a primary in place", () => {
    const names = ["GrowthSEO-Gemini", "Kestrel"];
    const grouped = groupAgentFallbackLanes(names.map((name) => ({ name }))).map((a) => a.name);
    expect(grouped).toEqual(["GrowthSEO-Gemini", "Kestrel"]);
  });
});
