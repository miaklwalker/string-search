import { BaseAlgorithm, type BaseAlgorithmOptions } from "../baseAlgorithm.ts";
import type { AlgorithmScore } from "../types.ts";

/** Jaro similarity: `0` (nothing in common) through `1` (identical). */
export function jaroSimilarity(a: string, b: string): number {
	if (a === b) return a.length === 0 ? 0 : 1;
	if (a.length === 0 || b.length === 0) return 0;

	const window = Math.max(0, Math.floor(Math.max(a.length, b.length) / 2) - 1);
	const aMatched = new Array<boolean>(a.length).fill(false);
	const bMatched = new Array<boolean>(b.length).fill(false);

	let matches = 0;
	for (let i = 0; i < a.length; i += 1) {
		const start = Math.max(0, i - window);
		const end = Math.min(i + window + 1, b.length);
		for (let j = start; j < end; j += 1) {
			if (bMatched[j] === true || a[i] !== b[j]) continue;
			aMatched[i] = true;
			bMatched[j] = true;
			matches += 1;
			break;
		}
	}
	if (matches === 0) return 0;

	let transpositions = 0;
	let k = 0;
	for (let i = 0; i < a.length; i += 1) {
		if (aMatched[i] !== true) continue;
		while (bMatched[k] !== true) k += 1;
		if (a[i] !== b[k]) transpositions += 1;
		k += 1;
	}
	transpositions /= 2;

	return (
		(matches / a.length +
			matches / b.length +
			(matches - transpositions) / matches) /
		3
	);
}

/** Jaro similarity with a bonus for a shared prefix. */
export function jaroWinklerSimilarity(
	a: string,
	b: string,
	scalingFactor = 0.1,
	boostThreshold = 0.7,
	maxPrefix = 4,
): number {
	const jaro = jaroSimilarity(a, b);
	if (jaro < boostThreshold) return jaro;

	let prefix = 0;
	const limit = Math.min(maxPrefix, a.length, b.length);
	while (prefix < limit && a[prefix] === b[prefix]) prefix += 1;

	return jaro + prefix * scalingFactor * (1 - jaro);
}

export type JaroWinklerOptions = BaseAlgorithmOptions & {
	/** How much a shared prefix boosts the score. `0.1` by default. */
	scalingFactor?: number;
	/** Jaro score below which no prefix boost applies. `0.7` by default. */
	boostThreshold?: number;
};

/**
 * Jaro–Winkler similarity: tuned for short strings with transposed characters
 * and a rewarded common prefix, which makes it stronger than
 * {@link LevenshteinAlgorithm} on names, SKUs and model codes.
 *
 * The default threshold is `0.8`.
 */
export class JaroWinklerAlgorithm extends BaseAlgorithm<"jaro-winkler"> {
	private readonly scalingFactor: number;
	private readonly boostThreshold: number;

	constructor(options: JaroWinklerOptions = {}) {
		super("jaro-winkler", { threshold: 0.8, ...options });
		this.scalingFactor = options.scalingFactor ?? 0.1;
		this.boostThreshold = options.boostThreshold ?? 0.7;
	}

	protected override score(
		candidate: string,
		query: string,
	): AlgorithmScore | null {
		const confidence = jaroWinklerSimilarity(
			this.prepare(candidate),
			this.prepare(query),
			this.scalingFactor,
			this.boostThreshold,
		);
		return confidence <= 0 ? null : { confidence };
	}
}

/** Creates a {@link JaroWinklerAlgorithm}. */
export function JaroWinkler(
	options?: JaroWinklerOptions,
): JaroWinklerAlgorithm {
	return new JaroWinklerAlgorithm(options);
}
