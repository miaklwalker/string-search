import { BaseAlgorithm, type BaseAlgorithmOptions } from "../baseAlgorithm.ts";
import type { AlgorithmScore } from "../types.ts";

/**
 * Edit distance between two strings: the number of insertions, deletions and
 * substitutions needed to turn one into the other. Single-row DP, O(a × b)
 * time and O(b) space.
 */
export function levenshteinDistance(a: string, b: string): number {
	if (a === b) return 0;
	if (a.length === 0) return b.length;
	if (b.length === 0) return a.length;

	const row = new Array<number>(b.length + 1);
	for (let j = 0; j <= b.length; j += 1) row[j] = j;

	for (let i = 1; i <= a.length; i += 1) {
		let diagonal = row[0] ?? 0;
		row[0] = i;
		for (let j = 1; j <= b.length; j += 1) {
			const above = row[j] ?? 0;
			const cost = a[i - 1] === b[j - 1] ? 0 : 1;
			row[j] = Math.min(above + 1, (row[j - 1] ?? 0) + 1, diagonal + cost);
			diagonal = above;
		}
	}

	return row[b.length] ?? 0;
}

export type LevenshteinOptions = BaseAlgorithmOptions & {
	/**
	 * Reject anything needing more than this many edits, regardless of
	 * confidence. Unset by default — the threshold does the filtering.
	 */
	maxDistance?: number;
};

/**
 * Fuzzy whole-string match by edit distance — the one that catches typos.
 *
 * Confidence is `1 - distance / longestLength`, so `"iphone"` against
 * `"iphonw"` scores `0.83`. The default threshold is `0.7`; lower it to catch
 * sloppier input, raise it to cut false positives.
 */
export class LevenshteinAlgorithm extends BaseAlgorithm<"levenshtein"> {
	private readonly maxDistance: number;

	constructor(options: LevenshteinOptions = {}) {
		super("levenshtein", { threshold: 0.7, ...options });
		this.maxDistance = options.maxDistance ?? Number.POSITIVE_INFINITY;
	}

	protected override score(
		candidate: string,
		query: string,
	): AlgorithmScore | null {
		const left = this.prepare(candidate);
		const right = this.prepare(query);
		const longest = Math.max(left.length, right.length);
		if (longest === 0) return null;

		const distance = levenshteinDistance(left, right);
		if (distance > this.maxDistance) return null;

		return { confidence: 1 - distance / longest };
	}
}

/** Creates a {@link LevenshteinAlgorithm}. */
export function Levenshtein(
	options?: LevenshteinOptions,
): LevenshteinAlgorithm {
	return new LevenshteinAlgorithm(options);
}
