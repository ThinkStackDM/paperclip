# Storyboard Standard

Use for Stage 3 (post-script-lock) faceless YouTube episode work where the agent must map every narration beat to an exact proving visual and output a b-roll manifest.

## Entry gate

Do not storyboard until the script is locked. If the script is not locked, say what is missing instead of producing a provisional map.

## Beat→visual map law

- Work beat by beat through the locked script (one beat = one claim)
- Every beat gets: beat_id, narration excerpt, claim_type, visual_type, visual_spec, reveal_cue, chartTruth_required, broll_beat
- Every claim with a number uses a bar_chart, comparison_chart, or calculator_callout — never a plain text_card
- Every chart includes real values from the research lock, not illustrative placeholders
- Chart truth: min(value)/max(value) ≤ 0.85; if it flattens, fix the data source, not the chart

## B-roll rules (hard)

- No AI-generated text visible in the clip
- No watermarks (even if the licence allows use)
- Chains not loops — clips play in sequence; no single clip loops
- No CC NonCommercial or NoDerivs licences (commercial work)
- Sources: Pexels, Pixabay, Openverse, Wikimedia Commons, NASA, coverr.co only — no YouTube rips

## Reveal cues

- Mark the first beat of each new section `section_break`
- One section = one continuous narrator take; do not design reveals that need spliced audio

## Output

- Beat→visual map table (full row per beat)
- Chart data appendix (values + sources for every chartTruth_required row)
- B-roll manifest JSON array (one entry per broll beat: subject, source_hint, licence_class, attribution_required)
- Reveal cue summary (section_break beats in order)

## Handoff check

- Every locked-script beat has a visual row
- Every number-bearing claim has a chart or calculator visual
- All charts have real sourced values with min/max ≤ 0.85
- No b-roll has AI text, watermarks, or loop design
- Section breaks match narrator-take boundaries in the script
