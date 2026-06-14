# Query Patterns — spot and fix N+1 / per-item database access

A checklist for reviewing data-access code for the most common scaling bug: running
a query (or several) once per item in a loop instead of in a bounded set of queries.

## How to spot it

- Look for `await db...` / `query` / `findFirst` / `findMany` **inside a `for`/`map`
  over a list**. Each iteration = at least one round-trip → N items = N+ queries.
- Symptoms: fine with small inputs, slow/timeouts under load; query count grows with
  the list size.

## The fix: batch, then group in memory

1. Collect the ids up front.
2. Fetch everything in a **bounded** number of queries using a set predicate —
   `inArray(table.id, ids)` (Drizzle) / `WHERE id IN (...)` (SQL) — one query per
   table instead of one per item.
3. Index the results in a `Map` keyed by the join field.
4. Assemble the per-item shape from the maps in memory (no further queries).

Sketch:
```ts
const routines = await db.select().from(routines).where(inArray(routines.id, ids));
const runs = await db.select().from(runs).where(inArray(runs.routineId, ids));
const runsByRoutine = groupBy(runs, r => r.routineId);
return ids.map(id => ({ routine: byId.get(id), runs: runsByRoutine.get(id) ?? [] }));
```
This turns 2N queries into 2.

## Anti-patterns (do NOT call these a fix)

- Adding an index or a cache while leaving the per-iteration queries in place — that
  treats the symptom, not the N+1 itself.
- `Promise.all` over the same per-item queries — still N queries, just concurrent;
  it hammers the DB and the connection pool.
- Keeping the loop and "optimizing" each query.
