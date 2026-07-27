import { BaseAlgorithm, type BaseAlgorithmOptions } from "../baseAlgorithm.ts";
import type { AlgorithmScore } from "../types.ts";

export type FuzzySubsequenceOptions = BaseAlgorithmOptions & {
	/**
	 * How much of the score comes from how tightly the matched characters sit
	 * together, as opposed to how much of the candidate they cover.
	 * `0.7` by default.
	 */
	compactnessWeight?: number;
};

/**
 * Subsequence matching in the style of an editor's command palette: every
 * character of the query must appear in the candidate, in order, but not
 * necessarily adjacent — so `"mbp"` finds `"MacBook Pro"`.
 *
 * Confidence blends how tightly the matched characters cluster with how much
 * of the candidate they account for, so an exact match scores `1` and a
 * scattered one scores low. The default threshold is `0.2`, which is
 * deliberately permissive — initialisms are short and their candidates long.
 */
export class FuzzySubsequenceAlgorithm extends BaseAlgorithm<"fuzzy-subsequence"> {
	private readonly compactnessWeight: number;

	constructor(options: FuzzySubsequenceOptions = {}) {
		super("fuzzy-subsequence", { threshold: 0.2, ...options });
		this.compactnessWeight = Math.min(
			1,
			Math.max(0, options.compactnessWeight ?? 0.7),
		);
	}

	protected override score(
		candidate: string,
		query: string,
	): AlgorithmScore | null {
		const haystack = this.prepare(candidate);
		const needle = this.prepare(query);
		if (needle.length === 0 || haystack.length === 0) return null;

		let first = -1;
		let last = -1;
		let cursor = 0;

		for (let i = 0; i < haystack.length && cursor < needle.length; i += 1) {
			if (haystack[i] !== needle[cursor]) continue;
			if (first === -1) first = i;
			last = i;
			cursor += 1;
		}
		if (cursor < needle.length || first === -1) return null;

		const span = last - first + 1;
		const compactness = needle.length / span;
		const coverage = needle.length / haystack.length;
		const confidence =
			compactness * this.compactnessWeight +
			coverage * (1 - this.compactnessWeight);

		return { confidence, position: first };
	}
}

/** Creates a {@link FuzzySubsequenceAlgorithm}. */
export function FuzzySubsequence(
	options?: FuzzySubsequenceOptions,
): FuzzySubsequenceAlgorithm {
	return new FuzzySubsequenceAlgorithm(options);
}
