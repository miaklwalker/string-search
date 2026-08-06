---
title: "Working with Results"
description: "The shape of a SearchResult: best, matches, byAlgorithm and ranAlgorithms, and what each field means."
---

`.search(query)` returns a `SearchResult`:

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

## `query`

The query string, echoed back verbatim so you can tell what produced a
result once it has been passed somewhere else.

## `matched` and `best`

`matched` is `true` when at least one algorithm produced at least one match.
`best` is the single highest-confidence match across every algorithm that
ran, or `null` when nothing matched. Ties resolve to whichever match was
pushed first, which follows run order and then dataset order — `best` is
found with a strict `>` comparison, so the first match at the top confidence
wins over a later one that ties it.

## `matches`

Every match from every algorithm that ran, flattened into one array, each
tagged with the algorithm that produced it:

```ts
type SearchMatch = AlgorithmMatch & { algorithm: string };

type AlgorithmMatch = {
	index: number;        // index of the matching entry in the dataset
	confidence: number;   // 0 through 1
	candidate: string;    // the dataset entry that matched, verbatim
	position?: number;    // offset inside the candidate, for positional algorithms
};
```

`position` is only present when the algorithm that produced the match sets
it: substring, prefix, KMP and Boyer-Moore report it because it is
meaningful for them; edit-distance and n-gram algorithms do not. The order of
`matches` is run order first, then dataset order within each algorithm's own
contribution.

## `byAlgorithm`

The same matches grouped by algorithm name, without the `algorithm` tag
(each entry is an `AlgorithmMatch`, not a `SearchMatch`, since the key
already says which algorithm it is):

```ts
result.byAlgorithm.kmp;              // KMP's matches only
result.byAlgorithm["normalized-naive"]; // bracket access for hyphenated names
```

Every algorithm that ran has an entry here, even if it found nothing: an
algorithm that ran and matched zero rows maps to `[]`. An algorithm that
never ran because the run order excluded it, or because `stop-on-match` ended
the pipeline before reaching it, has no key at all.

## `ranAlgorithms`

The list of algorithms that actually ran, in the order they ran. This equals
the run order for a `find-all` pipeline, and is shorter than it whenever
`stop-on-match` ended the pipeline early: the difference between
`ranAlgorithms` and the run order you passed to `.runOrder()` is exactly how
far the pipeline got before it stopped.

```ts
const result = search.defineBehavior("stop-on-match").search("iPad Mini");
result.ranAlgorithms; // e.g. ["naive"] — the rest never ran
```
