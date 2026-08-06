---
title: "Culling Matched Rows"
description: "Why later algorithms in a find-all pipeline skip rows an earlier algorithm already matched, and when it matters."
---

`.cullMatchedRows(enabled?)` controls whether a dataset row that one algorithm
matches is removed from the pool later algorithms in the run order search
through. It defaults to `true`.

```ts
new Search()
	.register(NaiveSearch())
	.register(Levenshtein())          // skips rows NaiveSearch already matched
	.defineDataset(allModels)
	.defineBehavior("find-all")
	.cullMatchedRows();                // true by default; call with false to disable
```

## Why it exists

In a `find-all` pipeline with more than one algorithm registered, every
algorithm scans the whole dataset by default. Without culling, a candidate
the cheap algorithm already caught still gets scored by every expensive
algorithm behind it in the run order, for a result you already had. Culling
removes that wasted work and the duplicate matches that come with it.

Internally, `Search.search()` tracks matched indices in a `Set` and passes it
to each algorithm's `run()` as `context.culled`. `BaseAlgorithm.run` skips
scoring a culled index entirely, rather than scoring it and discarding the
result:

```ts
for (let index = 0; index < dataset.length; index += 1) {
	if (context.culled.has(index)) continue;
	// ...score this candidate
}
```

## Disabling it

Call `.cullMatchedRows(false)` to have every algorithm see the whole dataset
regardless of what earlier algorithms matched. The behavior you get if you
never call the method at all is the opposite: culling is on unless you
explicitly turn it off.

```ts
new Search()
	.register(NaiveSearch())
	.register(Levenshtein())
	.defineDataset(allModels)
	.cullMatchedRows(false); // every algorithm sees every row
```

This is the right call when you want every algorithm's independent opinion on
every row: for instance, comparing algorithms against each other rather than
combining them into one pipeline.

## When it has no effect

Culling only changes anything for `find-all` pipelines with more than one
algorithm registered in the run order:

- An algorithm that stops at its own first match (`stopOnMatch: true`, or a
  global `stop-on-match` that ends the pipeline there) never gives a later
  algorithm the chance to run at all, so there is nothing to cull against.
- A pipeline with a single algorithm has no "later algorithm" to skip rows
  for.

It also only removes rows *matched* by an earlier algorithm, not the whole
dataset: an algorithm that only matched three of six rows still leaves the
other three fully visible to whatever runs next.
