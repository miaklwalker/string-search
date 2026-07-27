import { BaseAlgorithm, type BaseAlgorithmOptions } from "../baseAlgorithm.ts";
import {
	buildAmbiguityMap,
	DEFAULT_AMBIGUITY_GROUPS,
	foldAmbiguous,
} from "../normalize.ts";
import type { AlgorithmScore } from "../types.ts";

export type NormalizedNaiveOptions = BaseAlgorithmOptions & {
	/**
	 * Groups of characters that should compare equal. Each group folds to its
	 * first character. Defaults to {@link DEFAULT_AMBIGUITY_GROUPS} —
	 * `0O`, `1lI|`, `5S`, `8B`, `2Z`, `6G`.
	 */
	ambiguityGroups?: readonly string[];
	/** Also drop punctuation and whitespace before comparing. `true` by default. */
	stripNonAlphanumeric?: boolean;
};

/**
 * Exact match like {@link NaiveSearchAlgorithm}, but after folding characters
 * that are routinely confused for one another — so `"MODEL-1O5B"` matches
 * `"model 105 8"`.
 *
 * Confidence is `1` for an exact hit and `0.9` when the two strings only
 * became equal after folding, so a true exact match always outranks a
 * normalised one.
 */
export class NormalizedNaiveAlgorithm extends BaseAlgorithm<"normalized-naive"> {
	private readonly ambiguityMap: ReadonlyMap<string, string>;
	private readonly stripNonAlphanumeric: boolean;

	constructor(options: NormalizedNaiveOptions = {}) {
		super("normalized-naive", options);
		this.ambiguityMap = buildAmbiguityMap(
			options.ambiguityGroups ?? DEFAULT_AMBIGUITY_GROUPS,
		);
		this.stripNonAlphanumeric = options.stripNonAlphanumeric ?? true;
	}

	protected override prepare(value: string): string {
		return foldAmbiguous(value, this.ambiguityMap, {
			stripNonAlphanumeric: this.stripNonAlphanumeric,
		});
	}

	protected override score(
		candidate: string,
		query: string,
	): AlgorithmScore | null {
		if (candidate === query) return { confidence: 1, position: 0 };
		return this.prepare(candidate) === this.prepare(query)
			? { confidence: 0.9, position: 0 }
			: null;
	}
}

/** Creates a {@link NormalizedNaiveAlgorithm}. */
export function NormalizedNaive(
	options?: NormalizedNaiveOptions,
): NormalizedNaiveAlgorithm {
	return new NormalizedNaiveAlgorithm(options);
}
