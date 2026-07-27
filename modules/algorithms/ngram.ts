import { BaseAlgorithm, type BaseAlgorithmOptions } from "../baseAlgorithm.ts";
import type { AlgorithmScore } from "../types.ts";

/**
 * Splits a string into overlapping character n-grams. Strings shorter than `n`
 * become a single gram so they are still comparable.
 */
export function toNgrams(value: string, size: number): string[] {
	if (value.length === 0) return [];
	if (value.length <= size) return [value];

	const grams: string[] = [];
	for (let i = 0; i <= value.length - size; i += 1) {
		grams.push(value.slice(i, i + size));
	}
	return grams;
}

/** Counts how many times each gram occurs. */
function countGrams(grams: readonly string[]): Map<string, number> {
	const counts = new Map<string, number>();
	for (const gram of grams) counts.set(gram, (counts.get(gram) ?? 0) + 1);
	return counts;
}

/**
 * Sørensen–Dice coefficient over two n-gram bags: `2 × shared / (|a| + |b|)`,
 * from `0` (nothing in common) to `1` (identical bags).
 */
export function diceCoefficient(
	a: readonly string[],
	b: readonly string[],
): number {
	if (a.length === 0 || b.length === 0) return 0;

	const counts = countGrams(a);
	let shared = 0;
	for (const gram of b) {
		const remaining = counts.get(gram) ?? 0;
		if (remaining === 0) continue;
		counts.set(gram, remaining - 1);
		shared += 1;
	}

	return (2 * shared) / (a.length + b.length);
}

export type NgramSearchOptions = BaseAlgorithmOptions & {
	/** Gram size. `3` (trigrams) by default. */
	size?: number;
};

/**
 * Trigram similarity: compares the bags of overlapping character n-grams with
 * the Sørensen–Dice coefficient.
 *
 * Order-insensitive and forgiving of word shuffles and inserted noise, which
 * is where edit distance struggles — `"pro macbook 16"` still scores well
 * against `"MacBook Pro 16"`. The default threshold is `0.4`.
 */
export class NgramSearchAlgorithm extends BaseAlgorithm<"ngram"> {
	private readonly size: number;
	private cachedQuery: string | undefined;
	private cachedGrams: readonly string[] = [];

	constructor(options: NgramSearchOptions = {}) {
		super("ngram", { threshold: 0.4, ...options });
		this.size = Math.max(1, Math.floor(options.size ?? 3));
	}

	private gramsFor(query: string): readonly string[] {
		if (this.cachedQuery !== query) {
			this.cachedQuery = query;
			this.cachedGrams = toNgrams(query, this.size);
		}
		return this.cachedGrams;
	}

	protected override score(
		candidate: string,
		query: string,
	): AlgorithmScore | null {
		const prepared = this.prepare(query);
		const confidence = diceCoefficient(
			toNgrams(this.prepare(candidate), this.size),
			this.gramsFor(prepared),
		);
		return confidence <= 0 ? null : { confidence };
	}
}

/** Creates an {@link NgramSearchAlgorithm}. */
export function NgramSearch(
	options?: NgramSearchOptions,
): NgramSearchAlgorithm {
	return new NgramSearchAlgorithm(options);
}
