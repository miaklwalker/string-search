---
title: "Thresholds and Confidence"
description: "How confidence is scored, clamped and checked against a threshold, and how to override an algorithm's default."
---

Every algorithm's `score` method returns a confidence between `0` and `1`, or
`null` for "not a match." `BaseAlgorithm.run` clamps whatever `score` returns
into that range and checks it against the resolved threshold before counting
it as a match:

```ts
const confidence = clampConfidence(score.confidence);
if (confidence <= 0 || confidence < context.threshold) continue;
```

`clampConfidence` maps anything non-finite to `0`, anything below `0` to `0`,
and anything above `1` to `1`. A confidence of exactly `0` never counts as a
match, even against a threshold of `0`: `score` should return `null` instead
of `0` for "not a match," and the base class enforces that regardless.

## Where a threshold comes from

Each algorithm ships a default threshold, set in its constructor:

```ts
Levenshtein()          // threshold 0.7
JaroWinkler()           // threshold 0.8
NgramSearch()            // threshold 0.4
FuzzySubsequence()       // threshold 0.2
NaiveSearch()             // threshold 0 — an exact match or nothing
```

Two things can override it, and the registration option wins:

```ts
Levenshtein({ threshold: 0.6 });                 // the algorithm's own default
search.register(Levenshtein(), { threshold: 0.9 }); // wins over the factory's
```

`.register(algorithm, { threshold })` is checked against `algorithm.threshold`
only as a fallback — `registration.options.threshold ??
registration.algorithm.threshold` — so the same `Levenshtein` instance could
in principle be registered into two different pipelines with two different
effective thresholds.

## Reading confidence per algorithm

Confidence means something different for each algorithm, because each one
measures a different kind of closeness:

- **`naive` / `normalized-naive`**: binary in practice. `1` for an exact
  match, and for `normalized-naive`, `0.9` when the match only appeared after
  folding ambiguous characters, so a true exact hit still outranks a folded
  one.
- **`substring` / `prefix` / `kmp` / `boyer-moore`**: how much of the
  candidate the query covers (`needle.length / haystack.length`), so a short
  query matched inside a long candidate scores low even though it did match.
- **`levenshtein`**: `1 - distance / longestLength`; close strings with a
  few edits score near `1`.
- **`jaro-winkler`**: Jaro similarity plus a bonus for a shared prefix.
- **`ngram`**: the Sørensen–Dice coefficient over two bags of n-grams.
- **`soundex`**: `1` for a whole-string phonetic match, `0.75` for a single
  matching word inside a longer candidate.
- **`fuzzy-subsequence`**: a blend of how tightly the matched characters
  cluster and how much of the candidate they cover.

See [Bundled Algorithms](../reference/algorithms) for the full breakdown and
each algorithm's tuning options: `maxDistance` on `Levenshtein`,
`scalingFactor` on `JaroWinkler`, `size` on `NgramSearch`, and so on.

## `caseSensitive`

Every algorithm accepts `{ caseSensitive: boolean }`, `false` by default.
`BaseAlgorithm.prepare` lower-cases both the candidate and the query before
`score` ever sees them unless `caseSensitive` is `true`.

`NormalizedNaive` is the one exception: it overrides `prepare` to fold
ambiguous characters instead of calling the base implementation, and its
folding always lower-cases along the way. `caseSensitive` is still accepted
on its options for consistency with every other algorithm, but it has no
effect there: case is always ignored.
