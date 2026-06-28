# Deck Author

A tight playbook for authoring 5-slide narrated deck specs for the HTML/CSS deck
pipeline. Apply it when the output is JSON, not prose.

## Build the arc, not five disconnected cards
Use the fixed sequence well:
- **Title**: open on the tension or payoff, not a topic label.
- **Bullets**: exactly three crisp beats that explain the mechanism.
- **Image**: one concrete visual moment; body says why it matters, caption names the cue.
- **Quote**: one earned line that sharpens the takeaway; never fabricate a real person.
- **Close**: payoff or CTA, not a recap of slide 1.

## One beat per slide
No slide should try to do two jobs. If the title is the hook, the bullets explain,
the image makes it visible, the quote concentrates the idea, and the close lands it.

## Tight copy wins
- Titles: one sharp claim, not a sentence pile.
- Bullets: short, parallel, high-signal; cut filler.
- Captions: describe the exact still or b-roll cue a human could source later.
- Quotes: memorable and clean enough to speak aloud.

## Voice-over should sound spoken
1-3 sentences per slide. Plain English. Short sentence, then a longer one when needed.
Every VO line should move into the next slide naturally; do not restate the on-screen text.

## Match the channel
- **Stack Lab**: concrete tool/workflow pain, named mechanism, operator reality, no abstract AI hype.
- **Cashflow Compass**: calm, plain-spoken, educational. No personal tax advice, no current-year limit talk, no fake certainty.

## Keep the schema clean
Return JSON only. Use the exact slide order the task asks for. For cue-only image slides,
set `image` to the provided placeholder path and do the real work in `body` + `caption`.
