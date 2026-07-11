# TSM-5269 Distribution Repurposing Queue Pack v1
**Issue:** TSM-5269  
**Status:** Draft (non-cadence components complete; cadence sheet pending TSM-5243 Shorts derivation pipeline decision)  
**Scope:** Existing-rail social outputs only for CC, SL, VC, JJ (YouTube canonical, Postiz where connected, manual-post bridge where approvals pending). No TikTok. No external publishing.  
**Parent:** TSM-5234 (done)  
**Dependency:** TSM-5243 (Shorts derivation pipeline decision required before cadence-dependent outputs can be finalized)

---

## 1. Per-Channel Derivative Output Checklist

### CC (Content Channel)
- **Primary canonical surface:** YouTube (long-form + Shorts when approved via TSM-5243)
- **Secondary surfaces (existing rail):** 
  - Postiz (connected accounts)
  - Manual-post bridge (where Postiz/approvals pending)
- **Approved derivative output types:**
  - Full episode clips (YouTube-native)
  - Chaptered highlights (YouTube)
  - Quote cards / static graphics (manual-post bridge or Postiz)
  - Thumbnail variants (YouTube)
- **Manual-post bridge requirements:** Copy/paste ready text + asset links for any destination not yet wired to Postiz. Include source video timestamp + caption constraints.

### SL (Social/Long-form Channel)
- **Primary canonical surface:** YouTube (long-form focus)
- **Secondary surfaces (existing rail):** 
  - Postiz (connected accounts)
  - Manual-post bridge (where Postiz/approvals pending)
- **Approved derivative output types:**
  - Long-form repurposed segments
  - Timestamped highlight reels (YouTube)
  - Static quote / key takeaway graphics
  - Series teaser trailers (YouTube)
- **Manual-post bridge requirements:** Same as CC — timestamp + caption constraints + asset links.

### VC (Vertical/Shorts-ready Channel — cadence gated)
- **Primary canonical surface:** YouTube (vertical/Shorts when TSM-5243 approved)
- **Secondary surfaces (existing rail):** 
  - Postiz (connected accounts)
  - Manual-post bridge (where Postiz/approvals pending)
- **Approved derivative output types (post-TSM-5243):**
  - Vertical Shorts (YouTube)
  - Vertical clip series
  - Captioned static variants for cross-post
- **Current status:** Cadence and exact output subtypes blocked pending TSM-5243 decision. Checklist will be expanded in v1.1 once pipeline confirmed.
- **Manual-post bridge requirements:** Vertical aspect ratio notes + caption length limits.

### JJ (JJ-specific / Print-adjacent or supplemental channel)
- **Primary canonical surface:** YouTube (supplemental/long-form)
- **Secondary surfaces (existing rail):** 
  - Postiz (connected accounts)
  - Manual-post bridge (where Postiz/approvals pending)
- **Approved derivative output types:**
  - Supplemental long-form content
  - Behind-the-scenes / making-of clips
  - Static promotional graphics
  - Print-to-digital bridge assets (if applicable)
- **Manual-post bridge requirements:** Source asset provenance + any print-resolution notes for digital reuse.

---

## 2. Cadence Sheet (Placeholder — Pending TSM-5243)

**Note:** This section is intentionally left as a skeleton. Final cadence values depend on the Shorts derivation pipeline decision in TSM-5243. Do not populate numeric cadences until that decision is recorded.

| Channel | Output Type                  | Target Cadence (post-TSM-5243) | Notes / Gating Condition                  |
|---------|------------------------------|--------------------------------|-------------------------------------------|
| CC      | Full episode clips           | TBD                            | Requires TSM-5243 Shorts pipeline         |
| CC      | Chaptered highlights         | TBD                            | Requires TSM-5243 Shorts pipeline         |
| SL      | Long-form repurposed segments| TBD                            | Requires TSM-5243 Shorts pipeline         |
| VC      | Vertical Shorts              | TBD                            | Directly gated by TSM-5243 decision       |
| JJ      | Supplemental long-form       | TBD                            | Requires TSM-5243 Shorts pipeline         |

**Action:** Once TSM-5243 is resolved, update this table with concrete cadences and remove the placeholder status.

---

## 3. Manual-Post Bridge Requirements (Existing-Rail Only)

For any destination not yet connected to Postiz or where approval is still pending:

- **Required fields per bridge item:**
  - Destination platform/account
  - Post type (video / image / text)
  - Caption / copy (with character limits noted)
  - Asset links or file references
  - Source video timestamp (if clipping)
  - Aspect ratio / format constraints
  - Approval status (pending / approved)

- **Bridge template (use per post):**
  ```
  Destination: [platform/account]
  Post Type: [video/image/text]
  Caption: [text or placeholder]
  Assets: [links or file paths]
  Timestamp: [HH:MM:SS]
  Constraints: [aspect, length, etc.]
  Approval: [pending/approved]
  ```

- **Current known gaps:** Any channel/account not listed as "Postiz connected" in the live environment. Maintain this list in the issue thread or a linked document as connections are added.

---

## 4. Constraints & Guardrails (Enforced)

- All outputs remain inside the approved existing-rail rule.
- No TikTok publishing or preparation until the approved trigger is met.
- No external publishing occurs from this queue pack.
- Cadence-dependent outputs are explicitly blocked until TSM-5243 resolution.
- This pack is a planning/queue artifact only — no automation or live scheduling is triggered.

---

## 5. Next Steps / Open Items

- Monitor TSM-5243 for Shorts derivation pipeline decision.
- Upon TSM-5243 resolution: populate cadence sheet, expand VC checklist, and produce v1.1 of this pack.
- Maintain per-channel manual-post bridge list as Postiz connections evolve.
- No child issues created at this time (single deliverable scope).

---

**Artifact location:** `work-products/TSM-5269/TSM-5269-Distribution-Repurposing-Queue-Pack-v1.md`

**Prepared by:** Media-Drafter-Hermes (Agent 87836aaa-09ca-49a3-9728-10d7267515bb)  
**Date:** 2026-07-07 (current heartbeat)