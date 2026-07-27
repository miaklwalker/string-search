import { BaseAlgorithm, type BaseAlgorithmOptions } from "../baseAlgorithm.ts";
import type { AlgorithmScore } from "../types.ts";

export type SubstringSearchOptions = BaseAlgorithmOptions;

/**
 * Plain `String.prototype.indexOf` against every entry.
 *
 * Confidence is how much of the candidate the query covers, so searching
 * `"pro"` scores `"Pro"` at `1` and `"MacBook Pro 16"` at `0.21`.
 */
export class SubstringSearchAlgorithm extends BaseAlgorithm<"substring"> {
	constructor(options: SubstringSearchOptions = {}) {
		super("substring", options);
	}

	protected override score(
		candidate: string,
		query: string,
	): AlgorithmScore | null {
		const haystack = this.prepare(candidate);
		const needle = this.prepare(query);
		if (needle.length === 0 || haystack.length === 0) return null;

		const position = haystack.indexOf(needle);
		if (position === -1) return null;

		return { confidence: needle.length / haystack.length, position };
	}
}

/** Creates a {@link SubstringSearchAlgorithm}. */
export function SubstringSearch(
	options?: SubstringSearchOptions,
): SubstringSearchAlgorithm {
	return new SubstringSearchAlgorithm(options);
}
