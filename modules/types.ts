/** Flattens an intersection into a single, readable object type. */
export type Prettify<T> = { [K in keyof T]: T[K] } & {};

/**
 * What happens once an algorithm produces a match.
 *
 * - `find-all` — the algorithm scans the whole dataset and the pipeline moves
 *   on to the next algorithm in the run order.
 * - `stop-on-match` — the algorithm returns its first hit, and the pipeline
 *   ends there. Later algorithms in the run order never run.
 */
export type MatchBehavior = "stop-on-match" | "find-all";

/** A single hit produced by an algorithm. */
export type AlgorithmMatch = {
	/** Index of the matching entry in the dataset. */
	index: number;
	/** How sure the algorithm is: `0` (no match) through `1` (perfect match). */
	confidence: number;
	/** The dataset entry that matched, verbatim. */
	candidate: string;
	/**
	 * Offset inside `candidate` where the match begins. Only set by positional
	 * algorithms (substring, prefix, KMP, Boyer-Moore, ...).
	 */
	position?: number;
};

/** An {@link AlgorithmMatch} tagged with the algorithm that produced it. */
export type SearchMatch = Prettify<AlgorithmMatch & { algorithm: string }>;

/**
 * What `BaseAlgorithm.score` returns for one candidate. `null` (returned
 * instead of this object) means "not a match".
 */
export type AlgorithmScore = {
	/** `0` through `1`. Values outside that range are clamped. */
	confidence: number;
	/** Offset inside the candidate where the match begins, if meaningful. */
	position?: number;
};

/** The resolved settings for a single algorithm's turn in the pipeline. */
export type AlgorithmRunContext = {
	/** The string being searched for, verbatim as passed to `.search()`. */
	query: string;
	/** The behavior resolved from the registration options and the global default. */
	behavior: MatchBehavior;
	/** Minimum confidence for a score to count as a match. */
	threshold: number;
	/** Maximum number of matches to collect. `Infinity` when uncapped. */
	limit: number;
	/**
	 * Indices already claimed by an earlier algorithm in the run order. Empty
	 * when `cullMatchedRows` is off. `BaseAlgorithm.run` skips scoring these
	 * entirely, rather than scoring them and discarding the result.
	 */
	culled: ReadonlySet<number>;
};

/** What every algorithm's `run` returns. */
export type AlgorithmResult = {
	/** The name of the algorithm that produced these matches. */
	algorithm: string;
	/** Every match it found, in dataset order. */
	matches: AlgorithmMatch[];
};

/**
 * Per-algorithm overrides supplied at `.register()` time. Anything left unset
 * falls back to the algorithm's own default, then to the global setting.
 */
export type RegistrationOptions = {
	/**
	 * Shorthand for `behavior`. `true` is `"stop-on-match"`, `false` is
	 * `"find-all"`. `false` by default — that is, unset, so the global
	 * behavior applies.
	 */
	stopOnMatch?: boolean;
	/** Overrides the global behavior for this algorithm only. Wins over `stopOnMatch`. */
	behavior?: MatchBehavior;
	/** Overrides the algorithm's own confidence threshold. */
	threshold?: number;
	/** Caps how many matches this algorithm may contribute. Ignored when stopping on match. */
	limit?: number;
};

/** The result of a `.search()` call. */
export type SearchResult = {
	/** The query, verbatim. */
	query: string;
	/** `true` when at least one algorithm produced a match. */
	matched: boolean;
	/** The highest-confidence match, or `null` when nothing matched. */
	best: SearchMatch | null;
	/** Every match, in run order then dataset order, each tagged with its algorithm. */
	matches: SearchMatch[];
	/** The same matches grouped by algorithm name. Algorithms that ran but found nothing map to `[]`. */
	byAlgorithm: Record<string, AlgorithmMatch[]>;
	/** The algorithms that actually ran — shorter than the run order when the pipeline stopped early. */
	ranAlgorithms: string[];
};

/** Thrown when the pipeline is misconfigured: duplicate names, no dataset, unknown run order entries. */
export class SearchConfigError extends Error {
	override name = "SearchConfigError";
}

/** Clamps a raw score into the `0`–`1` range algorithms are contracted to return. */
export function clampConfidence(confidence: number): number {
	if (!Number.isFinite(confidence)) return 0;
	if (confidence < 0) return 0;
	if (confidence > 1) return 1;
	return confidence;
}
