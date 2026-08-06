---
title: "Quick Start"
description: "A complete, worked search pipeline from an empty Search instance to a SearchResult."
---

This walks through one realistic pipeline end to end: a small product
catalog, an exact match tried first, a normalized fallback for garbled
serial numbers, and edit distance as a last resort for typos.

```ts
import {
	KMP,
	Levenshtein,
	NaiveSearch,
	NormalizedNaive,
	Search,
} from "@michaelrwalker/search";

const allModels = [
	"iPhone 15 Pro",
	"iPhone 15 Pro Max",
	"MacBook Pro 16",
	"MacBook Air 13",
	"iPad Mini",
	"Apple Watch Ultra 2",
];

const catalog = new Search()
	.register(NaiveSearch())
	.register(NormalizedNaive())
	.register(KMP())
	.register(Levenshtein({ threshold: 0.75 }))
	.defineDataset(allModels)
	.runOrder(["naive", "normalized-naive", "kmp", "levenshtein"])
	.defineBehavior("stop-on-match");

catalog.search("iPad Mini");
```

## What happens on an exact query

`"iPad Mini"` is an exact entry, so `naive` matches it on the first pass with
confidence `1`. Because the pipeline behavior is `"stop-on-match"`, the
pipeline stops there. `normalized-naive`, `kmp` and `levenshtein` never run:

```ts
{
	query: "iPad Mini",
	matched: true,
	best: {
		index: 4,
		confidence: 1,
		candidate: "iPad Mini",
		position: 0,
		algorithm: "naive",
	},
	matches: [ /* the one match above */ ],
	byAlgorithm: { naive: [ /* ... */ ] },
	ranAlgorithms: ["naive"],
}
```

## What happens on a typo

`"MacBook Pr 16"` matches nothing exactly, so `naive`, `normalized-naive` and
`kmp` all run and all come up empty. `levenshtein` is the one that saves it:

```ts
catalog.search("MacBook Pr 16");
```

```ts
{
	query: "MacBook Pr 16",
	matched: true,
	best: {
		index: 2,
		confidence: 0.9285714285714286,
		candidate: "MacBook Pro 16",
		algorithm: "levenshtein",
	},
	matches: [ /* the one match above */ ],
	byAlgorithm: {
		naive: [],
		"normalized-naive": [],
		kmp: [],
		levenshtein: [ /* ... */ ],
	},
	ranAlgorithms: ["naive", "normalized-naive", "kmp", "levenshtein"],
}
```

`byAlgorithm` lists every algorithm that ran, including the three that found
nothing: an empty array means "ran, no hit," not "did not run." Compare that
to `ranAlgorithms`, which is the actual list of algorithms the pipeline
reached; it is shorter than the run order whenever `stop-on-match` ends things
early.

## Ranking instead of resolving

Not every use case wants one winner. Flip the behavior to `"find-all"` and
every registered algorithm scores the whole dataset, which is what you want
when you are ranking suggestions rather than resolving a single entry:

```ts
const suggestions = new Search()
	.register(KMP())
	.register(Levenshtein({ threshold: 0.4 }))
	.defineDataset(allModels)
	.defineBehavior("find-all");

const result = suggestions.search("MacBook");
result.best;              // the single highest-confidence match
result.byAlgorithm.kmp;   // just KMP's matches, if you want to render them separately
```

From here, [Pipeline Stages](guides/pipeline-stages) walks through each
method on `Search` in order, and
[Run Order and Type Safety](guides/run-order-and-type-safety) covers the
type-level guarantee that made `runOrder(["naive", "normalized-naive", "kmp",
"levenshtein"])` above safe to write.
