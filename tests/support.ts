import { BaseAlgorithm, type BaseAlgorithmOptions } from "../modules/index.ts";
import type { AlgorithmScore } from "../modules/index.ts";

/** A small, stable dataset every test can share. */
export const MODELS: readonly string[] = [
	"iPhone 15 Pro",
	"iPhone 15 Pro Max",
	"MacBook Pro 16",
	"MacBook Air 13",
	"iPad Mini",
	"Apple Watch Ultra 2",
];

/** Serial-ish strings for exercising ambiguous-character folding. */
export const SERIALS: readonly string[] = [
	"MODEL-1O5B",
	"MODEL-2Z7G",
	"PLAIN-TEXT",
];

/**
 * An algorithm that matches whatever it is told to, so tests can assert on
 * pipeline behavior without depending on a real algorithm's scoring.
 */
export class StubAlgorithm<TName extends string> extends BaseAlgorithm<TName> {
	/** Every candidate this stub was asked to score, in order. */
	readonly seen: string[] = [];

	constructor(
		name: TName,
		private readonly matcher: (candidate: string) => number | null,
		options: BaseAlgorithmOptions = {},
	) {
		super(name, options);
	}

	protected override score(candidate: string): AlgorithmScore | null {
		this.seen.push(candidate);
		const confidence = this.matcher(candidate);
		return confidence === null ? null : { confidence };
	}
}

/** Matches every candidate at a fixed confidence. */
export function alwaysMatch<TName extends string>(
	name: TName,
	confidence = 1,
): StubAlgorithm<TName> {
	return new StubAlgorithm(name, () => confidence);
}

/** Matches nothing. */
export function neverMatch<TName extends string>(
	name: TName,
): StubAlgorithm<TName> {
	return new StubAlgorithm(name, () => null);
}

export type Equal<A, B> =
	(<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2
		? true
		: false;

export type Expect<T extends true> = T;
