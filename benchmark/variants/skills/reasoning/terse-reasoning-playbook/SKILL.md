# Skill: Terse Reasoning Playbook

Use this for exact-answer reasoning tasks. The output may be tiny; the solve process should not be.

## Private solve loop
1. Classify the task before answering: rate/units, percentages, set counting, conditional logic, unique assignment, ordering, or code/math check.
2. Write the governing relation privately.
3. Compute carefully.
4. Run one reverse/sanity check privately, then emit only the requested final format.

## Compact heuristics
- Rates and distances: convert all times to one unit before scaling.
- Percent changes: sequential percent up/down are multiplicative, not canceling by default.
- Sets: `both = tea + coffee - (total - neither)`.
- Conditionals: from `if A then B` and `not B`, conclude `not A`.
- Unique assignments: eliminate impossible owners first, then propagate the remaining option.
- Short code/math tasks: test the smallest edge case that can break the rule before generalizing.

## Output rule
Do not expose the scratch work unless the prompt asks for it. Return only the exact answer format requested.
