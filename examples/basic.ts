import {
	KMP,
	Levenshtein,
	NaiveSearch,
	NormalizedNaive,
	Search,
} from "../modules/index.ts";

const allModels = [
	"iPhone 15 Pro",
	"iPhone 15 Pro Max",
	"MacBook Pro 16",
	"MacBook Air 13",
	"iPad Mini",
	"Apple Watch Ultra 2",
];

/**
 * Cheap-to-expensive: try an exact match first, then a normalised one, then
 * substring, and only fall back to edit distance if nothing else landed.
 * `stop-on-match` means the pipeline stops as soon as one of them hits, so
 * Levenshtein never runs on an exact query.
 */
const catalogue = new Search()
	.register(NaiveSearch())
	.register(NormalizedNaive())
	.register(KMP())
	.register(Levenshtein({ threshold: 0.75 }))
	.defineDataset(allModels)
	.runOrder(["naive", "normalized-naive", "kmp", "levenshtein"])
	.defineBehavior("stop-on-match");

// Exact hit — only `naive` runs.
console.log(catalogue.search("iPad Mini"));

// Typo — naive, normalized-naive and kmp all miss, levenshtein saves it.
console.log(catalogue.search("MacBook Pr 16"));

/**
 * The same registry with the opposite behavior: every algorithm runs and
 * every match is reported, which is what you want when you are ranking
 * suggestions rather than resolving one entry.
 */
const suggestions = new Search()
	.register(KMP())
	.register(Levenshtein({ threshold: 0.4 }))
	.defineDataset(allModels)
	.defineBehavior("find-all");

const result = suggestions.search("MacBook");
console.log(result.best);
console.log(result.byAlgorithm.kmp);
