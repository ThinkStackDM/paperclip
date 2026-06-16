---
name: kdp-publishing-pipeline
description: ThinkStack Books production-to-publish pipeline for KDP ebooks. Use for any "Book N architecture", "Book N Act X draft", "Editor pass / Editor capstone", "Manuscript assembly + KDP", "Metadata + KDP/Google Play listing pack", "Cover brief + cover art", or "Publish Book N to KDP" issue. Encodes the canonical stage order, the publish-gate blocker set, the KU-first launch decision, and the pre-upload QA checklist learned on Book 1 (THI-38..THI-49, THI-77/78).
---

# KDP Publishing Pipeline

ThinkStack Books ships books through a fixed production line. Role-level rules (book-pack cache prefix, sliding-window MS attach, model routing) live in each agent's AGENTS.md — this skill covers the **cross-role pipeline**: what stage comes next, what gates it, and the publish-time decisions that already got made on Book 1 so nobody re-litigates them.

## Stage order (Book 1 precedent, reused for Book 2)

1. **Niche shortlist** (Researcher) — profit-driven market scan, 3–5 candidates, research-only.
2. **Architecture** (Architect) — niche-lock + chapter map + voice/tone guide. The chapter map is the contract for everything downstream.
3. **Act drafts** (Author) — one issue per act (Act 1 / 2A / 2B / 3), ~7–9 chapters each. Never a whole book in one issue.
4. **Editor passes** (Editor) — per-act line/clue pass, then a **whole-MS capstone** (continuity sweep + word-count adequacy + voice seams). Continuity flags route to the Architect for a **canon ruling** folded into the chapter map; locked facts go in the series bible (e.g. "Effie = Mathers", "Bert = 84").
5. **Production track** (parent issue, pattern of THI-38): spawn parallel children —
   - Manuscript assembly + EPUB formatting (THI-39 pattern, see below)
   - Cover brief + cover art (THI-40)
   - Back-cover blurb + sales description (THI-41)
   - Metadata + listing pack (THI-42, see below)
   - Pen-name clearance check (THI-38)
6. **Publish gate** (board-gated, THI-43 pattern, see below).
7. **Post-publish discoverability** (THI-77): Author Central bio + Follow button + $0 channels (Substack, BlueSky/X, Goodreads).

## Manuscript assembly (THI-39 precedent)

- Assemble from the act drafts **of record**, faithful to the chapter map; carry Continuity Locks through.
- Export **two EPUB3 files** — one per store — same content, **per-store `dc:identifier`**, auto-TOC, uniform `# Chapter N — Title` headings, metadata title page.
- **Gate: epubcheck must be clean** (`0 fatals / 0 errors / 0 warnings`). State the epubcheck version in the done comment.
- Leave branding (pen name / series) as clearly-marked `⟦… TBD⟧` tokens until THI-38-style clearance lands; the **branded rebuild** happens at the publish gate, not by reopening assembly.
- Hand to CEO `in_review`; CEO acceptance unblocks the publish gate.
- Formatting judgment calls (e.g. Book 1's diary-chapter blockquotes) get their **own decision issue** (THI-45) + implementation issue (THI-49); never silently restyle. Decision of record: flatten diary bodies, promote datelines to styled entry-headers, keep only short insets as blockquotes.

## Metadata + listing pack (THI-42 precedent — decisions of record)

- **Launch model is KU-first, not simultaneous-wide**: KDP Select / Kindle Unlimited, Amazon-exclusive 90 days, then evaluate wide (Google Play, Apple, Kobo). "KDP + Google Play" in briefs means the *eventual* footprint. Do not price for wide at launch.
- **KENP math (corrected — use these numbers)**: ~85k words ≈ **440–500 KENP**, full read-through pays **~$2.0–$2.4** (NOT ~$6 — that was a 3× overstatement caught in review). A $4.99 sale (~$3.35 net) out-earns a full borrow; KU's value is borrow volume + discovery.
- Book 1 anchors: ebook **$4.99** (70% tier), optional paperback $12.99; categories Cozy FIC022070 + Amateur Sleuth FIC022100 (+ Women Sleuths FIC022040); 7 KDP keywords; subtitle carries the genre keywords the title lacks.
- Series field stays **blank until Book 2 exists**.
- Pen name decisions are board-level; run a clearance checklist (THI-38). Book 1 lock: **Margaret Ashbridge**.

## Publish gate (THI-43 pattern — board-gated, never self-authorized)

Maintain an explicit **blocker list on the gate issue** and add new pre-publish work as blockers as it's discovered (Book 1 ended with: assembly, cover, blurb, metadata, diary-reformat). When all clear:

1. CEO assembles the package (manuscript + cover + blurb + metadata) and confirms branding (pen name / series).
2. **Pre-upload QA, on the FINAL branded EPUB — do not skip**: fresh epubcheck, then KDP Previewer on a Kindle profile spot-checking the first and last chapters (opening must read as "the book has started", not a preface).
3. Request **board approval** — the board owns credentials, tax/banking (W-8BEN with Ireland-US treaty claim, THI-78 pattern), and go/no-go. The CEO never uploads on their own authority.
4. On approval: create listings, upload, set price, submit; then link the ASIN into Author Central (THI-77 pack).

## Known failure points (what to avoid)

- **Publish gates stall silently on board/human inputs** (Book 1 sat blocked on bank/W-8BEN + identity). Keep the gate issue's blocker list current and name the board action precisely; re-arm expired confirmations rather than waiting.
- **Premature scheduling**: G5 (day-91 wide kickoff) and G6 (Book 2 during KU window) issues were cancelled as created-too-early. Don't open calendar-gated issues before their trigger date; note the trigger on the gate instead.
- **Concurrent-run races**: if checkout returns 409 on a pipeline issue, never retry — verify the live run's output read-only and exit (THI-49 lesson).
- Editor lessons get **codified, not just commented** (e.g. "sibling-order Continuity Lock + voice spot-check anchors" was folded into Book 2 instructions). If a pass surfaces a reusable rule, file the codification issue.

## References

- `references/book1-evidence.md` — issue-by-issue evidence trail and document anchors (book-pack, chapter-map, metadata-pack, author-central-pack).


<!-- TOOLS-2026-06 -->
## Local tools
- Manuscript → EPUB/PDF: `pandoc`. Cover + interior print-prep (resize, CMYK, PDF/X, compression): `magick` (ImageMagick) and `gs` (Ghostscript).
