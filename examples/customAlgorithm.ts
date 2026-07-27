import {
	type AlgorithmScore,
	BaseAlgorithm,
	type BaseAlgorithmOptions,
	NaiveSearch,
	Search,
} from "../modules/index.ts";

type TokenOverlapOptions = BaseAlgorithmOptions & {
	/** Words too generic to count towards a match. */
	stopWords?: readonly string[];
};

/**
 * Scores an entry by how many of the query's words it contains — the kind of
 * rule that is specific to one dataset and so never ships in a library.
 *
 * Only `score` is required: the base class owns the loop over the dataset and
 * all of the threshold, limit and stop-on-match bookkeeping.
 */
class TokenOverlapAlgorithm extends BaseAlgorithm<"token-overlap"> {
	private readonly stopWords: ReadonlySet<string>;

	constructor(options: TokenOverlapOptions = {}) {
		super("token-overlap", { threshold: 0.5, ...options });
		this.stopWords = new Set(options.stopWords ?? ["the", "a", "of"]);
	}

	private tokenize(value: string): string[] {
		return this.prepare(value)
			.split(/\W+/)
			.filter((token) => token !== "" && !this.stopWords.has(token));
	}

	protected override score(
		candidate: string,
		query: string,
	): AlgorithmScore | null {
		const wanted = this.tokenize(query);
		if (wanted.length === 0) return null;

		const present = new Set(this.tokenize(candidate));
		const overlap = wanted.filter((token) => present.has(token)).length;
		return overlap === 0 ? null : { confidence: overlap / wanted.length };
	}
}

const TokenOverlap = (options?: TokenOverlapOptions) =>
	new TokenOverlapAlgorithm(options);

const search = new Search()
	.register(NaiveSearch())
	.register(TokenOverlap(), { limit: 3 })
	.defineDataset([
		"iPhone 15 Pro",
		"iPhone 15 Pro Max",
		"MacBook Pro 16",
		"iPad Mini",
	])
	// The custom name is part of the union, so this type-checks.
	.runOrder(["naive", "token-overlap"]);

console.log(search.search("pro iphone"));
