import type { AnyAlgorithm, BaseAlgorithm } from "./baseAlgorithm.ts";
import {
	type AlgorithmMatch,
	type MatchBehavior,
	type RegistrationOptions,
	SearchConfigError,
	type SearchMatch,
	type SearchResult,
} from "./types.ts";

type Registration = {
	algorithm: AnyAlgorithm;
	options: RegistrationOptions;
};

/** Resolves one algorithm's behavior from its registration and the global default. */
function resolveBehavior(
	options: RegistrationOptions,
	fallback: MatchBehavior,
): MatchBehavior {
	if (options.behavior !== undefined) return options.behavior;
	if (options.stopOnMatch !== undefined) {
		return options.stopOnMatch ? "stop-on-match" : "find-all";
	}
	return fallback;
}

/**
 * A search pipeline: a set of registered algorithms, a dataset, an optional
 * run order and an outcome behavior.
 *
 * ```ts
 * const results = new Search()
 *   .register(NaiveSearch())
 *   .register(KMP(), { stopOnMatch: true })
 *   .register(Levenshtein())
 *   .defineDataset(allModels)
 *   .runOrder(["naive", "kmp", "levenshtein"])
 *   .defineBehavior("find-all")
 *   .search("iPhone 15 Pro");
 * ```
 *
 * `register` widens the instance's type parameter with the algorithm's literal
 * name, so `runOrder` only accepts algorithms that were actually registered —
 * `"levenstein"` is a compile error, not a silent no-op.
 */
export class Search<TAlgorithms extends string = never> {
	private readonly registry = new Map<string, Registration>();
	private dataset: readonly string[] | undefined;
	private order: readonly string[] | undefined;
	private behavior: MatchBehavior = "find-all";
	private cullRows = true;

	/** The algorithms registered so far, in registration order. */
	get algorithms(): TAlgorithms[] {
		return [...this.registry.keys()] as TAlgorithms[];
	}

	/**
	 * Adds an algorithm to the pipeline under its own `name`, optionally
	 * overriding the global behavior, threshold or match limit for it alone.
	 *
	 * ```ts
	 * search.register(KMP(), { stopOnMatch: true }); // false by default
	 * ```
	 */
	register<TName extends string>(
		algorithm: BaseAlgorithm<TName>,
		options: RegistrationOptions = {},
	): Search<TAlgorithms | TName> {
		if (this.registry.has(algorithm.name)) {
			throw new SearchConfigError(
				`An algorithm named "${algorithm.name}" is already registered. Algorithm names must be unique within a pipeline.`,
			);
		}
		this.registry.set(algorithm.name, { algorithm, options });
		return this as unknown as Search<TAlgorithms | TName>;
	}

	/** Sets the array of strings every algorithm will search. */
	defineDataset(dataset: readonly string[]): this {
		if (!Array.isArray(dataset)) {
			throw new SearchConfigError("A dataset must be an array of strings.");
		}
		const offender = dataset.findIndex((entry) => typeof entry !== "string");
		if (offender !== -1) {
			throw new SearchConfigError(
				`A dataset must contain only strings; index ${String(offender)} is ${typeof dataset[offender]}.`,
			);
		}
		this.dataset = dataset;
		return this;
	}

	/**
	 * Restricts and orders the algorithms that run. Only registered names are
	 * accepted, and a subset is fine — anything left out simply never runs.
	 * Without a run order, algorithms run in registration order.
	 */
	runOrder(order: readonly TAlgorithms[]): this {
		for (const name of order) {
			if (!this.registry.has(name)) {
				throw new SearchConfigError(
					`"${name}" is not a registered algorithm. Registered: ${this.algorithms.join(", ") || "(none)"}.`,
				);
			}
		}
		const duplicate = order.find(
			(name, index) => order.indexOf(name) !== index,
		);
		if (duplicate !== undefined) {
			throw new SearchConfigError(
				`"${duplicate}" appears more than once in the run order.`,
			);
		}
		this.order = order;
		return this;
	}

	/**
	 * Sets the outcome behavior for the whole pipeline. `find-all` by default.
	 * An algorithm registered with its own `behavior` / `stopOnMatch` ignores this.
	 */
	defineBehavior(behavior: MatchBehavior): this {
		this.behavior = behavior;
		return this;
	}

	/**
	 * Controls whether a row that one algorithm marks as a match is removed
	 * from the pool that later algorithms in the run order search through.
	 * `true` by default.
	 *
	 * In a `find-all` pipeline, several algorithms otherwise all score the
	 * same candidate that an earlier one already claimed — wasted work on
	 * expensive algorithms, and duplicate matches to sift through. With
	 * culling on, once any algorithm matches a row, later algorithms skip
	 * scoring it entirely rather than scoring it and finding it again.
	 *
	 * Call `.cullMatchedRows(false)` to have every algorithm see the whole
	 * dataset regardless of what earlier ones matched — the old behavior.
	 *
	 * ```ts
	 * search.cullMatchedRows(false); // every algorithm sees every row
	 * ```
	 */
	cullMatchedRows(enabled = true): this {
		this.cullRows = enabled;
		return this;
	}

	/** Runs the pipeline against `query` and returns every match it produced. */
	search(query: string): SearchResult {
		if (this.dataset === undefined) {
			throw new SearchConfigError(
				"No dataset defined. Call .defineDataset([...]) before .search().",
			);
		}
		if (this.registry.size === 0) {
			throw new SearchConfigError(
				"No algorithms registered. Call .register(SomeAlgorithm()) before .search().",
			);
		}

		const order = this.order ?? [...this.registry.keys()];
		const matches: SearchMatch[] = [];
		const byAlgorithm: Record<string, AlgorithmMatch[]> = {};
		const ranAlgorithms: string[] = [];
		const culled = new Set<number>();

		for (const name of order) {
			const registration = this.registry.get(name);
			if (registration === undefined) {
				throw new SearchConfigError(
					`"${name}" is in the run order but is no longer registered.`,
				);
			}

			const behavior = resolveBehavior(registration.options, this.behavior);
			const result = registration.algorithm.run(this.dataset, {
				query,
				behavior,
				threshold:
					registration.options.threshold ?? registration.algorithm.threshold,
				limit: registration.options.limit ?? Number.POSITIVE_INFINITY,
				culled,
			});

			ranAlgorithms.push(name);
			byAlgorithm[name] = result.matches;
			for (const match of result.matches) {
				matches.push({ ...match, algorithm: name });
				if (this.cullRows) culled.add(match.index);
			}

			if (behavior === "stop-on-match" && result.matches.length > 0) break;
		}

		let best: SearchMatch | null = null;
		for (const match of matches) {
			if (best === null || match.confidence > best.confidence) best = match;
		}

		return {
			query,
			matched: matches.length > 0,
			best,
			matches,
			byAlgorithm,
			ranAlgorithms,
		};
	}
}
