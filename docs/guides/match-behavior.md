---
title: "Match Behavior"
description: "The difference between find-all and stop-on-match, at both the pipeline level and per algorithm."
---

`MatchBehavior` is `"find-all" | "stop-on-match"`. It controls what happens
the moment an algorithm produces a match, and it can be set globally or
overridden per algorithm.

## `find-all`

The default. Every algorithm in the run order scans the whole dataset, every
match it finds is collected, and the pipeline runs to the end of the run
order regardless of what earlier algorithms found.

```ts
new Search()
	.register(NaiveSearch())
	.register(Levenshtein())
	.defineDataset(allModels)
	.defineBehavior("find-all") // the default; this call is optional
	.search("MacBook");
```

## `stop-on-match`

Each algorithm returns at most its first hit, and the pipeline ends at the
first algorithm in the run order whose scan produces one. An algorithm that
finds nothing does not end the pipeline: it falls through to the next one,
same as it would under `find-all`. `stop-on-match` only short-circuits on an
actual match.

```ts
new Search()
	.register(NaiveSearch())     // tried first
	.register(Levenshtein())     // only reached if naive finds nothing
	.defineDataset(allModels)
	.defineBehavior("stop-on-match")
	.search("MacBook Pr 16");
```

`ranAlgorithms` on the result reflects exactly how far the pipeline got,
shorter than the run order whenever it stopped early. See
[Working with Results](working-with-results).

## Overriding behavior per algorithm

`.register(algorithm, options)` accepts `behavior` and `stopOnMatch`, which
apply to that one algorithm regardless of the pipeline's global setting:

| Option        | Type                            | Effect                                                              |
| ------------- | -------------------------------- | --------------------------------------------------------------------- |
| `stopOnMatch` | `boolean`                        | Shorthand for `behavior`. Unset by default, so the global setting applies. |
| `behavior`    | `"stop-on-match" \| "find-all"`  | Overrides the global behavior for this algorithm only. Wins over `stopOnMatch`. |

Resolution order for a given algorithm: an explicit `behavior` on its
registration wins outright; otherwise an explicit `stopOnMatch` (`true` maps
to `"stop-on-match"`, `false` maps to `"find-all"`) wins; otherwise it falls
back to whatever `.defineBehavior()` set for the pipeline.

```ts
new Search()
	.register(NaiveSearch(), { stopOnMatch: true }) // stops here even though
	.register(Levenshtein())                        // the pipeline is find-all
	.defineDataset(allModels)
	.defineBehavior("find-all")
	.search("iPad Mini");
```

That per-algorithm override, applied to the cheap algorithms at the front of
a run order, is what makes a cheap-to-expensive cascade possible. See
[Cheap-to-Expensive Cascades](cascades).
