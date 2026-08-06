---
title: "Types"
description: "Every exported type: SearchResult, SearchMatch, AlgorithmMatch, options interfaces and the algorithm run contract."
---

## `SearchResult`

What `.search()` returns.

```ts
type SearchResult = {
	query: string;
	matched: boolean;
	best: SearchMatch | null;
	matches: SearchMatch[];
	byAlgorithm: Record<string, AlgorithmMatch[]>;
	ranAlgorithms: string[];
};
```

See [Working with Results](../guides/working-with-results) for what each
field means and how it is populated.

## `SearchMatch`

An `AlgorithmMatch` tagged with the algorithm that produced it.

```ts
type SearchMatch = AlgorithmMatch & { algorithm: string };
```

## `AlgorithmMatch`

A single hit produced by one algorithm, before it is tagged with a name.

```ts
type AlgorithmMatch = {
	index: number;        // index of the matching entry in the dataset
	confidence: number;   // 0 through 1
	candidate: string;    // the dataset entry that matched, verbatim
	position?: number;    // offset inside the candidate; only positional
	                       // algorithms set this
};
```

## `AlgorithmScore`

What `BaseAlgorithm.score` returns for one candidate. `null` (returned in
place of this object) means "not a match."

```ts
type AlgorithmScore = {
	confidence: number; // 0 through 1; out-of-range values are clamped
	position?: number;
};
```

## `AlgorithmRunContext`

The resolved settings `Search.search()` passes to each algorithm's `run()`
for its turn in the pipeline.

```ts
type AlgorithmRunContext = {
	query: string;
	behavior: MatchBehavior;
	threshold: number;
	limit: number;                    // Infinity when uncapped
	culled: ReadonlySet<number>;      // indices already claimed; empty when
	                                   // cullMatchedRows is off
};
```

## `AlgorithmResult`

What every algorithm's `run()` returns.

```ts
type AlgorithmResult = {
	algorithm: string;
	matches: AlgorithmMatch[]; // in dataset order
};
```

## `MatchBehavior`

```ts
type MatchBehavior = "stop-on-match" | "find-all";
```

See [Match Behavior](../guides/match-behavior).

## `RegistrationOptions`

Per-algorithm overrides supplied at `.register()` time. Anything left unset
falls back to the algorithm's own default, then to the pipeline's global
setting.

```ts
type RegistrationOptions = {
	stopOnMatch?: boolean;
	behavior?: MatchBehavior;  // wins over stopOnMatch
	threshold?: number;
	limit?: number;            // ignored when stopping on match
};
```

## `BaseAlgorithmOptions`

Options every algorithm accepts, on top of whatever it defines itself.

```ts
type BaseAlgorithmOptions = {
	threshold?: number;
	caseSensitive?: boolean; // false by default
};
```

Each bundled algorithm extends this with its own options: `LevenshteinOptions`
adds `maxDistance`, `JaroWinklerOptions` adds `scalingFactor` and
`boostThreshold`, and so on. See [Bundled Algorithms](algorithms) for the
complete list.

## `BaseAlgorithm<TName>`

The abstract base class every algorithm, bundled or custom, extends.

```ts
abstract class BaseAlgorithm<TName extends string = string> {
	readonly name: TName;
	readonly threshold: number;
	readonly caseSensitive: boolean;

	protected prepare(value: string): string;
	protected abstract score(
		candidate: string,
		query: string,
	): AlgorithmScore | null;

	run(dataset: readonly string[], context: AlgorithmRunContext): AlgorithmResult;
}
```

See [Writing a Custom Algorithm](../guides/custom-algorithms) for how to
extend it.

## `AnyAlgorithm`

```ts
type AnyAlgorithm = BaseAlgorithm<string>;
```

Any algorithm, with its name widened to `string`: the type the internal
registry stores values as.
