---
title: "Pipeline Stages"
description: "The six methods on Search, in the order you call them, and what each one configures."
---

`Search` is a fluent builder. Every configuration method returns `this` (or a
widened `this`, in `register`'s case), so a pipeline reads top to bottom as
one chain ending in `.search(query)`.

```ts
new Search()
	.register(NaiveSearch())
	.register(KMP(), { stopOnMatch: true })
	.register(Levenshtein())
	.defineDataset(allModels)
	.runOrder(["naive", "kmp", "levenshtein"])
	.defineBehavior("find-all")
	.cullMatchedRows()
	.search("MacBook Pr 16");
```

None of these calls execute a search. Nothing runs until `.search()`. Up to
that point you are only building configuration.

## `.register(algorithm, options?)`

Adds an algorithm to the pipeline under its own `name`. Names must be unique
within a pipeline; registering the same name twice throws a
`SearchConfigError`. The second argument configures the algorithm's behavior,
threshold or match limit for *this* pipeline, separately from whatever
options its factory was constructed with. See
[Match Behavior](match-behavior) and
[Thresholds and Confidence](thresholds-and-confidence) for what those options
do, and [Run Order and Type Safety](run-order-and-type-safety) for what
`register` does to the instance's type.

## `.defineDataset(strings)`

Sets the array of strings every algorithm searches. It must be an array of
strings: a non-array or an array containing a non-string entry throws a
`SearchConfigError` naming the offending index.

## `.runOrder(names)`

Restricts and orders which registered algorithms actually run. A subset is
fine; anything left out of the list never runs. Skip this call entirely and
algorithms run in registration order. Its parameter type is the union of
names registered so far. See
[Run Order and Type Safety](run-order-and-type-safety).

## `.defineBehavior(behavior)`

Sets the outcome behavior for the whole pipeline: `"find-all"` (the default)
or `"stop-on-match"`. See [Match Behavior](match-behavior).

## `.cullMatchedRows(enabled?)`

Controls whether a row one algorithm matches is removed from the pool later
algorithms search through. `true` by default. See
[Culling Matched Rows](culling-matched-rows).

## `.search(query)`

Runs the pipeline and returns a `SearchResult`. This is the only method that
executes anything: everything before it is configuration. It throws a
`SearchConfigError` if no dataset was defined or nothing was registered. See
[Working with Results](working-with-results) for the shape it returns.
