# @michaelrwalker/search

A composable, type-safe search pipeline for arrays of strings.

You register the algorithms you want, hand it a dataset, decide what order they
run in and what should happen when one of them hits. Every algorithm — the ten
that ship with the package and any you write yourself — implements the same
`run` contract and returns the same match shape, so they are interchangeable
and stackable.

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

`register` widens the instance's type parameter with each algorithm's literal
name, so `runOrder` is a discriminated list of what you actually registered —
`"levenstein"` is a compile error, not a silent no-op.

## Install

```bash
npm install @michaelrwalker/search
```

No runtime dependencies. Ships as TypeScript source, so your bundler or Node's
type stripping compiles it alongside the rest of your code.

## The pipeline

### `.register(algorithm, options?)`

Adds an algorithm under its own `name`. Names must be unique within a pipeline;
registering the same one twice throws a `SearchConfigError`.

```ts
search
	.register(NaiveSearch())
	.register(KMP(), { stopOnMatch: true }) // false by default
	.register(Levenshtein({ threshold: 0.8 }), { limit: 5 });
```

| Option         | Type                              | Effect                                                             |
| -------------- | --------------------------------- | ------------------------------------------------------------------ |
| `stopOnMatch`  | `boolean`                         | Shorthand for `behavior`. Unset by default, so the global applies.  |
| `behavior`     | `"stop-on-match" \| "find-all"`   | Overrides the global behavior for this algorithm. Wins over `stopOnMatch`. |
| `threshold`    | `number`                          | Overrides the algorithm's own minimum confidence.                   |
| `limit`        | `number`                          | Caps how many matches this algorithm may contribute.                |

Options passed to the *factory* (`Levenshtein({ threshold: 0.8 })`) configure
the algorithm itself; options passed to *register* configure its place in the
pipeline and win over the factory's.

### `.defineDataset(strings)`

The array of strings every algorithm searches. Throws if it is not an array of
strings.

### `.runOrder(names)`

Restricts and orders the algorithms that run. A subset is fine — anything left
out never runs. Without a run order, algorithms run in registration order.

The parameter type is the union of registered names, so your editor completes
it and a typo fails to compile. Unknown or repeated names also throw at runtime,
which catches the JavaScript case.

### `.defineBehavior(behavior)`

The outcome behavior for the whole pipeline. `"find-all"` by default.

- **`find-all`** — every algorithm scans the whole dataset, every match is
  collected, and the pipeline runs to the end of the run order.
- **`stop-on-match`** — each algorithm returns its first hit, and the pipeline
  ends at the first algorithm that produces one. Algorithms that find nothing
  fall through to the next one.

An algorithm registered with its own `behavior` or `stopOnMatch` ignores the
global setting. That is the intended way to build a cheap-to-expensive cascade:

```ts
new Search()
	.register(NaiveSearch())          // cheap, exact
	.register(NormalizedNaive())      // cheap, forgiving
	.register(Levenshtein())          // expensive, fuzzy
	.defineDataset(allModels)
	.defineBehavior("stop-on-match"); // Levenshtein only runs if the first two miss
```

### `.cullMatchedRows(enabled?)`

`true` by default. In a `find-all` pipeline, once any algorithm matches a row,
later algorithms in the run order skip scoring that row entirely instead of
re-matching a candidate you already have. This matters once you stack several
`find-all` algorithms over the same dataset — without it, a candidate that the
cheap algorithm already caught still gets run through every expensive one
behind it, for a result you already had.

```ts
new Search()
	.register(NaiveSearch())
	.register(Levenshtein())          // skips rows NaiveSearch already matched
	.defineDataset(allModels)
	.defineBehavior("find-all")
	.cullMatchedRows();                // true by default, call with false to disable

new Search()
	.register(NaiveSearch())
	.register(Levenshtein())
	.defineDataset(allModels)
	.cullMatchedRows(false);           // every algorithm sees every row, old behavior
```

Culling has no effect on an algorithm that stops at its own first match —
nothing runs after it either way. The benefit is specific to `find-all`
pipelines with more than one algorithm registered.

### `.search(query)`

Runs the pipeline and returns a `SearchResult`:

```ts
{
	query: string;
	matched: boolean;
	best: SearchMatch | null;              // highest confidence across every algorithm
	matches: SearchMatch[];                // every match, in run order then dataset order
	byAlgorithm: Record<string, AlgorithmMatch[]>;
	ranAlgorithms: string[];               // shorter than the run order when it stopped early
}
```

Every match carries the three fields the contract guarantees, plus the
algorithm that produced it:

```ts
{
	index: number;        // index of the match in the dataset
	confidence: number;   // 0 through 1
	candidate: string;    // the dataset entry that matched
	position?: number;    // offset inside the candidate, for positional algorithms
	algorithm: string;
}
```

## Included algorithms

| Factory                | Name                  | Default threshold | What it is for                                              |
| ---------------------- | --------------------- | ----------------- | ----------------------------------------------------------- |
| `NaiveSearch()`        | `naive`               | `0`               | O(n) linear scan for an exact match.                         |
| `NormalizedNaive()`    | `normalized-naive`    | `0`               | Exact match after folding lookalike characters.              |
| `SubstringSearch()`    | `substring`           | `0`               | Plain `indexOf` against every entry.                         |
| `PrefixSearch()`       | `prefix`              | `0`               | Type-ahead: entries that begin with the query.               |
| `KMP()`                | `kmp`                 | `0`               | Knuth–Morris–Pratt substring search, O(n + m) per entry.     |
| `BoyerMoore()`         | `boyer-moore`         | `0`               | Boyer–Moore–Horspool: sublinear skipping on long entries.    |
| `Levenshtein()`        | `levenshtein`         | `0.7`             | Edit distance — the one that catches typos.                  |
| `JaroWinkler()`        | `jaro-winkler`        | `0.8`             | Transpositions and shared prefixes, tuned for short strings. |
| `NgramSearch()`        | `ngram`               | `0.4`             | Trigram similarity; survives shuffled words.                 |
| `SoundexSearch()`      | `soundex`             | `0`               | Phonetic: entries that *sound* like the query.               |
| `FuzzySubsequence()`   | `fuzzy-subsequence`   | `0.2`             | Command-palette style — `"mbp"` finds `"MacBook Pro"`.       |

Every algorithm accepts `{ threshold, caseSensitive }`; several add their own.

### Ambiguous characters

`NormalizedNaive` folds the characters that get mistaken for one another in
serial numbers, model codes and OCR output, so `"MODEL-1O5B"` matches
`"model 105 8"`. Each group folds to its first character:

```ts
["0O", "1lI|", "5S", "8B", "2Z", "6G"];
```

Replace them wholesale, and choose whether punctuation and whitespace survive:

```ts
NormalizedNaive({
	ambiguityGroups: ["0OQ", "1lI|", "5S"],
	stripNonAlphanumeric: false, // true by default
});
```

An entry that matches without folding scores `1`; one that only matched after
folding scores `0.9`, so a true exact hit always ranks first.

### Tuning

```ts
Levenshtein({ threshold: 0.6, maxDistance: 3 });  // reject beyond a fixed edit budget
JaroWinkler({ scalingFactor: 0.15 });             // weight the prefix bonus
NgramSearch({ size: 2 });                         // bigrams instead of trigrams
SoundexSearch({ matchTokens: false });            // whole-string codes only
FuzzySubsequence({ compactnessWeight: 0.9 });     // punish scattered matches harder
SubstringSearch({ caseSensitive: true });         // any algorithm
```

The scoring helpers are exported too, if you want them without the pipeline:
`levenshteinDistance`, `jaroSimilarity`, `jaroWinklerSimilarity`, `soundex`,
`diceCoefficient`, `toNgrams`, `kmpIndexOf`, `buildFailureTable`,
`horspoolIndexOf`, `buildBadCharacterTable`, `buildAmbiguityMap`,
`foldAmbiguous`.

## Writing an algorithm

Extend `BaseAlgorithm` and implement `score`, which rates one entry against the
query. The base class owns the loop over the dataset and all of the threshold,
limit and stop-on-match bookkeeping — you only write the comparison.

```ts
import {
	type AlgorithmScore,
	BaseAlgorithm,
	type BaseAlgorithmOptions,
} from "@michaelrwalker/search";

class TokenOverlapAlgorithm extends BaseAlgorithm<"token-overlap"> {
	constructor(options: BaseAlgorithmOptions = {}) {
		super("token-overlap", { threshold: 0.5, ...options });
	}

	protected override score(
		candidate: string,
		query: string,
	): AlgorithmScore | null {
		const wanted = this.prepare(query).split(/\W+/).filter(Boolean);
		if (wanted.length === 0) return null;

		const present = new Set(this.prepare(candidate).split(/\W+/));
		const overlap = wanted.filter((token) => present.has(token)).length;
		return overlap === 0 ? null : { confidence: overlap / wanted.length };
	}
}

const TokenOverlap = () => new TokenOverlapAlgorithm();
```

The name is a literal type parameter, which is what carries it into
`runOrder`'s union:

```ts
new Search()
	.register(NaiveSearch())
	.register(TokenOverlap())
	.defineDataset(allModels)
	.runOrder(["naive", "token-overlap"]); // both complete and type-check
```

Return `null` for "not a match". Anything else is clamped into `0`–`1` and
checked against the resolved threshold; a confidence of `0` never counts as a
match. Set `position` when the offset inside the candidate is meaningful.

Override `prepare` to change how strings are normalised before comparison — it
lower-cases by default, and `NormalizedNaive` overrides it to fold ambiguous
characters. Override `run` outright if your algorithm needs the whole dataset
at once, for index building or clustering; it receives the array of strings and
returns `{ algorithm, matches }`.

## Errors

`SearchConfigError` is thrown for every misconfiguration: a duplicate algorithm
name, a non-string dataset, an unknown or repeated name in the run order,
searching before a dataset is defined, and searching with nothing registered.

## Development

```bash
npm test        # node:test, no framework
npm run typecheck
npm run format
npm run fix
npm run release # release-it
```
