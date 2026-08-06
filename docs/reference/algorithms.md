---
title: "Bundled Algorithms"
description: "All eleven algorithms that ship with the package: their names, default thresholds, options and what each is for."
---

Every algorithm accepts `{ threshold, caseSensitive }` from
`BaseAlgorithmOptions`, on top of whatever it adds itself. `threshold` sets
its default minimum confidence (overridable again at `.register()` time;
see [Thresholds and Confidence](../guides/thresholds-and-confidence));
`caseSensitive` is `false` by default.

| Factory              | Name                 | Default threshold | What it is for                                             |
| --------------------- | --------------------- | ------------------ | ------------------------------------------------------------ |
| `NaiveSearch()`        | `naive`               | `0`                 | O(n) linear scan for an exact match.                          |
| `NormalizedNaive()`    | `normalized-naive`    | `0`                 | Exact match after folding lookalike characters.               |
| `SubstringSearch()`    | `substring`           | `0`                 | Plain `indexOf` against every entry.                          |
| `PrefixSearch()`       | `prefix`              | `0`                 | Type-ahead: entries that begin with the query.                |
| `KMP()`                | `kmp`                 | `0`                 | Knuth–Morris–Pratt substring search, O(n + m) per entry.       |
| `BoyerMoore()`         | `boyer-moore`         | `0`                 | Boyer–Moore–Horspool: sublinear skipping on long entries.      |
| `Levenshtein()`        | `levenshtein`         | `0.7`               | Edit distance: the one that catches typos.                    |
| `JaroWinkler()`        | `jaro-winkler`        | `0.8`               | Transpositions and shared prefixes, tuned for short strings.   |
| `NgramSearch()`        | `ngram`               | `0.4`               | Trigram similarity; survives shuffled words.                    |
| `SoundexSearch()`      | `soundex`             | `0`                 | Phonetic: entries that *sound* like the query.                  |
| `FuzzySubsequence()`   | `fuzzy-subsequence`   | `0.2`               | Command-palette style: `"mbp"` finds `"MacBook Pro"`.          |

## `NaiveSearch`

```ts
NaiveSearch(options?: BaseAlgorithmOptions): NaiveSearchAlgorithm;
```

O(n) linear scan: an exact match, case-folded like every other algorithm
unless `caseSensitive` is set. Confidence is always `1`; an entry either is
the query or it isn't. No options beyond the base `threshold` and
`caseSensitive`.

## `NormalizedNaive`

```ts
NormalizedNaive(options?: NormalizedNaiveOptions): NormalizedNaiveAlgorithm;

type NormalizedNaiveOptions = BaseAlgorithmOptions & {
	ambiguityGroups?: readonly string[];
	stripNonAlphanumeric?: boolean; // true by default
};
```

Exact match after folding characters that get mistaken for one another in
serial numbers, model codes and OCR output: `"MODEL-1O5B"` matches
`"model 105 8"`. An entry that matches without folding scores `1`; one that
only matches after folding scores `0.9`, so a true exact hit always outranks
a normalized one. `caseSensitive` is accepted for consistency with the other
algorithms, but has no effect: folding always lower-cases along the way.

### Ambiguous character groups

The default groups, each folding to its first character in both cases:

```ts
["0O", "1lI|", "5S", "8B", "2Z", "6G"];
```

Replace them wholesale, and choose whether punctuation and whitespace survive
the fold:

```ts
NormalizedNaive({
	ambiguityGroups: ["0OQ", "1lI|", "5S"],
	stripNonAlphanumeric: false, // true by default
});
```

`ambiguityGroups` replaces the defaults entirely rather than merging with
them: pass every group you want, including ones you keep from the default
set.

## `SubstringSearch`

```ts
SubstringSearch(options?: BaseAlgorithmOptions): SubstringSearchAlgorithm;
```

Plain `String.prototype.indexOf` against every entry. Confidence is how much
of the candidate the query covers (`needle.length / haystack.length`), so
searching `"pro"` scores `"Pro"` at `1` and `"MacBook Pro 16"` at `0.21`.
Reports `position`, the offset of the hit.

## `PrefixSearch`

```ts
PrefixSearch(options?: BaseAlgorithmOptions): PrefixSearchAlgorithm;
```

Matches entries that begin with the query, the algorithm behind type-ahead
boxes. A hit in the middle of an entry does not count. Confidence is how much
of the candidate the prefix covers; `position` is always `0`.

## `KMP`

```ts
KMP(options?: BaseAlgorithmOptions): KMPAlgorithm;
```

Knuth–Morris–Pratt substring search: O(n + m) per entry with no backtracking
over the candidate, which pays off on long entries and repetitive patterns
where naive `indexOf` degrades. The failure table is built once per query and
reused across the whole dataset. Same confidence and `position` semantics as
`SubstringSearch`.

Also exports the building blocks directly: `buildFailureTable(pattern)` and
`kmpIndexOf(haystack, needle, table)`.

## `BoyerMoore`

```ts
BoyerMoore(options?: BaseAlgorithmOptions): BoyerMooreAlgorithm;
```

Boyer–Moore–Horspool substring search: compares right-to-left and skips ahead
on a mismatch, which is sublinear in the happy case because a mismatch can
skip a whole pattern length. Good on long entries with a varied alphabet;
`KMP` is the safer bet on short, highly repetitive text. The skip table is
built once per query and reused across the dataset. Same confidence and
`position` semantics as `SubstringSearch`.

Also exports `buildBadCharacterTable(pattern)` and
`horspoolIndexOf(haystack, needle, table)`.

## `Levenshtein`

```ts
Levenshtein(options?: LevenshteinOptions): LevenshteinAlgorithm;

type LevenshteinOptions = BaseAlgorithmOptions & {
	maxDistance?: number; // unset by default
};
```

Fuzzy whole-string match by edit distance: the number of insertions,
deletions and substitutions needed to turn one string into the other. The one
that catches typos. Confidence is `1 - distance / longestLength`, so
`"iphone"` against `"iphonw"` scores `0.83`. Default threshold `0.7`; lower it
to catch sloppier input, raise it to cut false positives. `maxDistance`
rejects a candidate outright once it needs more than that many edits,
regardless of what the confidence formula would have scored it.

Also exports `levenshteinDistance(a, b)`.

## `JaroWinkler`

```ts
JaroWinkler(options?: JaroWinklerOptions): JaroWinklerAlgorithm;

type JaroWinklerOptions = BaseAlgorithmOptions & {
	scalingFactor?: number;   // 0.1 by default
	boostThreshold?: number;  // 0.7 by default
};
```

Jaro similarity plus a bonus for a shared prefix, tuned for short strings
with transposed characters, which makes it stronger than `Levenshtein` on
names, SKUs and model codes. Default threshold `0.8`. `scalingFactor` weights
how much the prefix bonus is worth; `boostThreshold` is the Jaro score below
which no prefix bonus applies at all.

Also exports `jaroSimilarity(a, b)` and
`jaroWinklerSimilarity(a, b, scalingFactor?, boostThreshold?, maxPrefix?)`.

## `NgramSearch`

```ts
NgramSearch(options?: NgramSearchOptions): NgramSearchAlgorithm;

type NgramSearchOptions = BaseAlgorithmOptions & {
	size?: number; // 3 (trigrams) by default
};
```

Compares bags of overlapping character n-grams with the Sørensen–Dice
coefficient: `2 × shared / (|a| + |b|)`. Order-insensitive and forgiving of
word shuffles and inserted noise, which is where edit distance struggles —
`"pro macbook 16"` still scores well against `"MacBook Pro 16"` even though
`Levenshtein` rejects it outright. Default threshold `0.4`. `size` sets the
gram length; `2` for bigrams, `4` for four-grams, and so on.

Also exports `toNgrams(value, size)` and `diceCoefficient(a, b)`.

## `SoundexSearch`

```ts
SoundexSearch(options?: SoundexOptions): SoundexAlgorithm;

type SoundexOptions = BaseAlgorithmOptions & {
	matchTokens?: boolean; // true by default
};
```

Phonetic matching using the classic Soundex code: an initial letter plus
three digits, so `"Robert"` and `"Rupert"` both encode to `R163`. Catches
misspellings edit distance misses, at the cost of collapsing genuinely
different words that happen to share a code. Whole-string code equality
scores `1`. With `matchTokens` (on by default), a single word inside a longer
candidate that sounds like the query also matches, scoring `0.75` and
reporting that word's `position`; set it to `false` to require the whole
candidate to match phonetically.

Also exports `soundex(value)`, which returns `""` for input with no letters.

## `FuzzySubsequence`

```ts
FuzzySubsequence(options?: FuzzySubsequenceOptions): FuzzySubsequenceAlgorithm;

type FuzzySubsequenceOptions = BaseAlgorithmOptions & {
	compactnessWeight?: number; // 0.7 by default
};
```

Subsequence matching in the style of an editor's command palette: every
character of the query must appear in the candidate, in order, but not
necessarily adjacent; `"mbp"` finds `"MacBook Pro"`. Confidence blends how
tightly the matched characters cluster (`compactnessWeight`) with how much of
the candidate they cover (`1 - compactnessWeight`), so an exact match scores
`1` and a scattered one scores low. Default threshold `0.2`, deliberately
permissive since initialisms are short and their candidates long.

## Scoring helpers without the pipeline

Every helper above is also exported standalone, for scoring one pair of
strings without building a `Search`:

```ts
levenshteinDistance, jaroSimilarity, jaroWinklerSimilarity, soundex,
diceCoefficient, toNgrams, kmpIndexOf, buildFailureTable, horspoolIndexOf,
buildBadCharacterTable, buildAmbiguityMap, foldAmbiguous
```
