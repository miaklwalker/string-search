---
title: "Overview"
description: "What Search is, why it is composable, and why running the wrong algorithm name is a compile error instead of a silent no-op."
---

`@michaelrwalker/search` is a composable, type-safe search pipeline for arrays
of strings. You register the algorithms you want, hand it a dataset, decide
what order they run in, and decide what should happen the moment one of them
hits.

There is no single "search" function to configure with a pile of flags.
Instead there is a set of interchangeable algorithms — eleven that ship with the
package and any you write yourself — that all implement the same `run`
contract and return matches in the same shape. Because the shape is shared,
you can register `NaiveSearch` next to a fuzzy phonetic matcher next to your
own domain-specific scorer, and the pipeline treats them identically.

```ts
import { KMP, Levenshtein, NaiveSearch, Search } from "@michaelrwalker/search";

const results = new Search()
	.register(NaiveSearch())
	.register(KMP(), { stopOnMatch: true })
	.register(Levenshtein())
	.defineDataset(allModels)
	.runOrder(["naive", "kmp", "levenshtein"])
	.defineBehavior("find-all")
	.search("MacBook Pr 16");
```

## Why a pipeline, not a function

Real search over a small, known dataset is rarely one algorithm. A product
catalog wants an exact match to win outright, a normalized match to survive
a mis-typed serial number, and a fuzzy match to catch a typo, but you do not
want to pay for edit-distance scoring on every query when a plain string
comparison would have answered it. `Search` models that directly: register
each algorithm, put the cheap ones first, and tell the pipeline to stop as
soon as one of them is confident enough.

## The type-safety story

`register` is generic over the algorithm's name, and each call widens the
`Search` instance's type parameter with that literal name:

```ts
class Search<TAlgorithms extends string = never> {
	register<TName extends string>(
		algorithm: BaseAlgorithm<TName>,
		options?: RegistrationOptions,
	): Search<TAlgorithms | TName>;

	runOrder(order: readonly TAlgorithms[]): this;
}
```

After `.register(NaiveSearch()).register(KMP())`, the instance's type
parameter is `"naive" | "kmp"`. `runOrder` only accepts that union, so your
editor autocompletes the algorithms you actually registered, and a typo such
as `"levenstein"` fails to compile: it never reaches production as a run
order entry that silently matches nothing. The same names are also checked at
runtime with a `SearchConfigError`, which is what protects plain JavaScript
callers who do not have the compiler watching.

This is the library's headline feature: the pipeline you configure and the
type the compiler checks it against are the same set of names, kept in sync
automatically as you add or remove `.register()` calls.

## What ships

- Eleven bundled algorithms covering exact, normalized, substring, prefix,
  positional, edit-distance, phonetic and subsequence matching. See
  [Bundled Algorithms](reference/algorithms).
- A `BaseAlgorithm` base class so a custom algorithm only has to implement one
  method, `score`. See [Writing a Custom Algorithm](guides/custom-algorithms).
- Zero runtime dependencies. The package ships as TypeScript source: there is
  no build step, no compiled `dist`, so your bundler or Node's own type
  stripping compiles it alongside the rest of your code.
