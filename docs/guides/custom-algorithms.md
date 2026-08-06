---
title: "Writing a Custom Algorithm"
description: "Extending BaseAlgorithm to add a scoring rule of your own, and how it plugs into runOrder's type."
---

The eleven bundled algorithms are general-purpose. Anything specific to your own
dataset — a rule about how your product codes are structured, a stopword list
for your domain — is expected to live in a custom algorithm that extends
`BaseAlgorithm`.

## The contract

`BaseAlgorithm<TName>` owns the loop over the dataset and all of the
threshold, limit and stop-on-match bookkeeping. A subclass supplies one
method, `score`, which rates a single candidate against the query:

```ts
protected abstract score(
	candidate: string,
	query: string,
): AlgorithmScore | null;
```

Return `null` for "not a match." Return `{ confidence, position? }` for a
match: `confidence` is clamped into `0`–`1` and checked against the
resolved threshold automatically; a confidence of `0` never counts as a match
regardless. Set `position` when the offset inside the candidate is
meaningful; leave it off otherwise.

## A worked example

This scores an entry by how many of the query's words it contains, a rule
specific enough to one dataset that it would never make sense to ship in the
package itself:

```ts
import {
	type AlgorithmScore,
	BaseAlgorithm,
	type BaseAlgorithmOptions,
	NaiveSearch,
	Search,
} from "@michaelrwalker/search";

type TokenOverlapOptions = BaseAlgorithmOptions & {
	/** Words too generic to count towards a match. */
	stopWords?: readonly string[];
};

class TokenOverlapAlgorithm extends BaseAlgorithm<"token-overlap"> {
	private readonly stopWords: ReadonlySet<string>;

	constructor(options: TokenOverlapOptions = {}) {
		super("token-overlap", { threshold: 0.5, ...options });
		this.stopWords = new Set(options.stopWords ?? ["the", "a", "of"]);
	}

	private tokenize(value: string): string[] {
		return this.prepare(value)
			.split(/\W+/)
			.filter((token) => token !== "" && !this.stopWords.has(token));
	}

	protected override score(
		candidate: string,
		query: string,
	): AlgorithmScore | null {
		const wanted = this.tokenize(query);
		if (wanted.length === 0) return null;

		const present = new Set(this.tokenize(candidate));
		const overlap = wanted.filter((token) => present.has(token)).length;
		return overlap === 0 ? null : { confidence: overlap / wanted.length };
	}
}

const TokenOverlap = (options?: TokenOverlapOptions) =>
	new TokenOverlapAlgorithm(options);
```

The constructor pattern matches every bundled algorithm: call `super(name,
{ ...defaults, ...options })` so your own default threshold merges with
whatever the caller passed, and export a lowercase factory function rather
than making callers write `new TokenOverlapAlgorithm()` directly.

## The name is a literal type

`BaseAlgorithm<"token-overlap">` fixes the name at the type level, which is
what carries it into `Search`'s type parameter when you register it:

```ts
const search = new Search()
	.register(NaiveSearch())
	.register(TokenOverlap(), { limit: 3 })
	.defineDataset([
		"iPhone 15 Pro",
		"iPhone 15 Pro Max",
		"MacBook Pro 16",
		"iPad Mini",
	])
	// The custom name is part of the union, so this type-checks.
	.runOrder(["naive", "token-overlap"]);

search.search("pro iphone");
```

See [Run Order and Type Safety](run-order-and-type-safety) for how that
union is built up. A custom algorithm registered this way is otherwise
indistinguishable from a bundled one: it participates in `runOrder`,
`defineBehavior`, `cullMatchedRows` and per-registration overrides exactly
the same way.

## Overriding `prepare`

`prepare` normalizes a string before `score` sees it: it lower-cases by
default unless `caseSensitive` is set. Override it to change that
normalization; `NormalizedNaive` is the bundled example, overriding `prepare`
to fold ambiguous characters instead of just lower-casing.

## Overriding `run`

`score` rates one candidate at a time, which is enough for anything that
compares the query against each entry independently. An algorithm that needs
to see the whole dataset at once — building an index, clustering entries, or
any scoring rule that depends on more than one candidate — overrides `run`
directly instead of `score`. `run` receives the dataset array and the
resolved `AlgorithmRunContext`, and must return `{ algorithm, matches }` in
the same shape `BaseAlgorithm.run` does, including which of the threshold,
limit and stop-on-match rules it honors. None of that bookkeeping is
inherited once `run` itself is overridden.
