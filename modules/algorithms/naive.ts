import { BaseAlgorithm, type BaseAlgorithmOptions } from "../baseAlgorithm.ts";
import type { AlgorithmScore } from "../types.ts";

export type NaiveSearchOptions = BaseAlgorithmOptions;

/**
 * O(n) linear scan for an exact match — the `Array.prototype.includes` of
 * search algorithms, except it reports where the hit was.
 *
 * Confidence is always `1`: an entry either is the query or it isn't.
 */
export class NaiveSearchAlgorithm extends BaseAlgorithm<"naive"> {
	constructor(options: NaiveSearchOptions = {}) {
		super("naive", options);
	}

	protected override score(
		candidate: string,
		query: string,
	): AlgorithmScore | null {
		return this.prepare(candidate) === this.prepare(query)
			? { confidence: 1, position: 0 }
			: null;
	}
}

/** Creates a {@link NaiveSearchAlgorithm}. */
export function NaiveSearch(
	options?: NaiveSearchOptions,
): NaiveSearchAlgorithm {
	return new NaiveSearchAlgorithm(options);
}
