# Constraint Discipline — never ship copy that breaks a hard rule

A method for writing short copy that must satisfy several HARD constraints at once
(length caps, banned words, required words, exact structure, ending style). Frontier
models often nail the message but quietly violate one constraint. This stops that.

## Method (do this every time)

1. **Extract every constraint into a checklist** before writing. Treat each as
   pass/fail, not a vibe. Typical classes:
   - length (min/max words or characters)
   - sentence/line count or exact structure
   - required words/phrases that MUST appear
   - banned words/phrases that must NOT appear (check substrings too)
   - ending/opening style (e.g. "must end with a question")
2. **Draft** the copy aiming for the message first.
3. **Verify against the checklist, item by item.** For each: is it satisfied? Count
   the words. Scan for every banned term (including inside other words). Confirm the
   required terms are present. Confirm the structure (sentence count, ending).
4. **Revise and re-verify** until ALL items pass. A great sentence that breaks one
   hard rule is a failure — rewrite it.
5. Output ONLY what was asked (no preamble, no commentary) — extra prose is itself a
   common constraint violation.

## Why it matters

A single violated hard constraint (one banned word, one word over the cap, a missing
required term, the wrong sentence count) makes the whole deliverable unusable in an
automated pipeline. Correctness on every constraint beats a slightly better phrasing.

## Anti-patterns

- Writing the copy and shipping it without re-counting words / re-scanning bans.
- Treating "about N words" as good enough when the cap is hard.
- Missing a banned term because it's embedded in a longer word.
- Adding a preamble ("Here's the blurb:") when only the blurb was requested.
