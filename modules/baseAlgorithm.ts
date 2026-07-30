import {
	type AlgorithmMatch,
	type AlgorithmResult,
	type AlgorithmRunContext,
	type AlgorithmScore,
	clampConfidence,
} from "./types.ts";

/** Options every algorithm accepts, on top of whatever it defines itself. */
export type BaseAlgorithmOptions = {
	/**
	 * Minimum confidence for a score to count as a match. Each algorithm ships
	 * a sensible default; `.register(algo, { threshold })` overrides it again.
	 */
	threshold?: number;
	/** Compare without lower-casing first. `false` by default. */
	caseSensitive?: boolean;
};

/**
 * The contract every algorithm in the pipeline implements.
 *
 * Subclasses supply {@link BaseAlgorithm.score}, which rates one dataset entry
 * against the query; the base class owns the loop over the dataset and the
 * threshold / stop-on-match / limit bookkeeping. Algorithms that need to see
 * the whole dataset at once (index building, clustering, ...) may override
 * {@link BaseAlgorithm.run} instead.
 *
 * ```ts
 * class StartsWithVowel extends BaseAlgorithm<"vowel"> {
 *   constructor(options: BaseAlgorithmOptions = {}) {
 *     super("vowel", options);
 *   }
 *   protected override score(candidate: string): AlgorithmScore | null {
 *     return /^[aeiou]/i.test(candidate) ? { confidence: 1, position: 0 } : null;
 *   }
 * }
 * ```
 *
 * The name is a literal type parameter, which is what lets `Search` track
 * registered algorithms and type-check `.runOrder()`.
 */
export abstract class BaseAlgorithm<TName extends string = string> {
	/** The key this algorithm is registered and referenced by. */
	readonly name: TName;
	/** This algorithm's default confidence threshold. */
	readonly threshold: number;
	/** Whether {@link BaseAlgorithm.prepare} preserves case. */
	readonly caseSensitive: boolean;

	protected constructor(name: TName, options: BaseAlgorithmOptions = {}) {
		this.name = name;
		this.threshold = options.threshold ?? 0;
		this.caseSensitive = options.caseSensitive ?? false;
	}

	/**
	 * Normalises a string before comparison. Override to add algorithm-specific
	 * rules — see `NormalizedNaiveAlgorithm`, which folds ambiguous characters here.
	 */
	protected prepare(value: string): string {
		return this.caseSensitive ? value : value.toLowerCase();
	}

	/**
	 * Rates one dataset entry against the query. Return `null` for "not a
	 * match"; anything else is clamped into the `0`–`1` range and then checked
	 * against the run's threshold.
	 */
	protected abstract score(
		candidate: string,
		query: string,
	): AlgorithmScore | null;

	/**
	 * Scans `dataset` for `context.query`, honouring the threshold, the limit
	 * and stop-on-match. Every algorithm exposes this method and every
	 * algorithm returns matches shaped the same way, which is what makes them
	 * interchangeable inside a `Search`.
	 */
	run(
		dataset: readonly string[],
		context: AlgorithmRunContext,
	): AlgorithmResult {
		const matches: AlgorithmMatch[] = [];
		if (context.query.length === 0) return { algorithm: this.name, matches };

		const limit = context.behavior === "stop-on-match" ? 1 : context.limit;

		for (let index = 0; index < dataset.length; index += 1) {
			if (context.culled.has(index)) continue;

			const candidate = dataset[index];
			if (candidate === undefined) continue;

			const score = this.score(candidate, context.query);
			if (score === null) continue;

			const confidence = clampConfidence(score.confidence);
			if (confidence <= 0 || confidence < context.threshold) continue;

			const match: AlgorithmMatch = { index, confidence, candidate };
			if (score.position !== undefined) match.position = score.position;
			matches.push(match);

			if (matches.length >= limit) break;
		}

		return { algorithm: this.name, matches };
	}
}

/** Any algorithm, with its name widened — what the registry stores. */
export type AnyAlgorithm = BaseAlgorithm<string>;
