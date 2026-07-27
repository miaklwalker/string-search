import { BaseAlgorithm, type BaseAlgorithmOptions } from "../baseAlgorithm.ts";
import type { AlgorithmScore } from "../types.ts";

export type PrefixSearchOptions = BaseAlgorithmOptions;

/**
 * Matches entries that begin with the query — the algorithm behind
 * type-ahead boxes.
 *
 * Confidence is how much of the candidate the prefix covers, so a complete
 * match scores `1` and a one-letter prefix of a long entry scores near `0`.
 */
export class PrefixSearchAlgorithm extends BaseAlgorithm<"prefix"> {
	constructor(options: PrefixSearchOptions = {}) {
		super("prefix", options);
	}

	protected override score(
		candidate: string,
		query: string,
	): AlgorithmScore | null {
		const haystack = this.prepare(candidate);
		const needle = this.prepare(query);
		if (needle.length === 0 || haystack.length === 0) return null;
		if (!haystack.startsWith(needle)) return null;

		return { confidence: needle.length / haystack.length, position: 0 };
	}
}

/** Creates a {@link PrefixSearchAlgorithm}. */
export function PrefixSearch(
	options?: PrefixSearchOptions,
): PrefixSearchAlgorithm {
	return new PrefixSearchAlgorithm(options);
}
