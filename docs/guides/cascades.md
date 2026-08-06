---
title: "Cheap-to-Expensive Cascades"
description: "Ordering algorithms from cheap and exact to expensive and fuzzy, and stopping as soon as a cheap one is confident enough."
---

Edit distance and n-gram similarity are more expensive per entry than a plain
string comparison, and unnecessary on a query that would have matched
exactly. A cascade puts the cheap, exact algorithms first and the expensive,
fuzzy ones last, with `stop-on-match` so the expensive ones only run when the
cheap ones actually miss.

```ts
new Search()
	.register(NaiveSearch())          // cheap, exact
	.register(NormalizedNaive())      // cheap, forgiving of ambiguous characters
	.register(Levenshtein())          // expensive, fuzzy
	.defineDataset(allModels)
	.defineBehavior("stop-on-match"); // Levenshtein only runs if the first two miss
```

`runOrder` makes this explicit and enforces it. See
[Run Order and Type Safety](run-order-and-type-safety):

```ts
const catalog = new Search()
	.register(NaiveSearch())
	.register(NormalizedNaive())
	.register(KMP())
	.register(Levenshtein({ threshold: 0.75 }))
	.defineDataset(allModels)
	.runOrder(["naive", "normalized-naive", "kmp", "levenshtein"])
	.defineBehavior("stop-on-match");

catalog.search("iPad Mini");        // exact — only naive runs
catalog.search("MacBook Pr 16");    // naive, normalized-naive, kmp all miss;
                                       // levenshtein catches the typo
```

## Mixing behaviors within one cascade

The global `stop-on-match` setting is the common case, but per-algorithm
overrides let you build more specific cascades: for instance, keep the whole
pipeline `find-all` so every algorithm's matches are available for ranking,
but still skip the expensive ones once a cheap algorithm is confident:

```ts
new Search()
	.register(NaiveSearch(), { stopOnMatch: true }) // short-circuits the rest
	.register(NgramSearch())                        // only reached on a naive miss
	.defineDataset(allModels)
	.defineBehavior("find-all")
	.search("MacBook");
```

Because `behavior` on a registration wins outright and `stopOnMatch` wins
over the global default, you can make exactly one algorithm in an otherwise
`find-all` pipeline the one that ends things early. See
[Match Behavior](match-behavior) for the full resolution order.

## Cascades and culling

Once a cascade includes more than one `find-all` algorithm — for example
several fuzzy algorithms stacked to rank suggestions rather than resolve one
entry — `cullMatchedRows` stops later algorithms from re-scoring a row an
earlier, cheaper one already matched. See
[Culling Matched Rows](culling-matched-rows).

## Choosing the order

`Levenshtein` and `NgramSearch` are worth ordering as `O(entries × query
length)` or worse; `NaiveSearch`, `SubstringSearch`, `PrefixSearch`, `KMP` and
`BoyerMoore` are cheap by comparison. `JaroWinkler` and `SoundexSearch` sit in
between: cheap per comparison, but still more work than a straight string
comparison. See [Bundled Algorithms](../reference/algorithms) for what each
one actually does and its default threshold.
