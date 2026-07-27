import assert from "node:assert";
import test, { describe } from "node:test";
import {
	type AnyAlgorithm,
	BoyerMoore,
	buildAmbiguityMap,
	buildBadCharacterTable,
	buildFailureTable,
	DEFAULT_AMBIGUITY_GROUPS,
	diceCoefficient,
	foldAmbiguous,
	FuzzySubsequence,
	horspoolIndexOf,
	JaroWinkler,
	jaroWinklerSimilarity,
	KMP,
	kmpIndexOf,
	Levenshtein,
	levenshteinDistance,
	NaiveSearch,
	NgramSearch,
	NormalizedNaive,
	PrefixSearch,
	Search,
	soundex,
	SoundexSearch,
	SubstringSearch,
	toNgrams,
} from "../modules/index.ts";
import { MODELS, SERIALS } from "./support.ts";

/** Runs one algorithm over `dataset` on its own and returns the matches. */
function run(
	algorithm: AnyAlgorithm,
	query: string,
	dataset: readonly string[] = MODELS,
) {
	return new Search().register(algorithm).defineDataset(dataset).search(query)
		.matches;
}

describe("NaiveSearch", () => {
	test("matches an exact entry with full confidence", () => {
		const matches = run(NaiveSearch(), "iPad Mini");
		assert.strictEqual(matches.length, 1);
		assert.strictEqual(matches[0]?.index, 4);
		assert.strictEqual(matches[0]?.confidence, 1);
		assert.strictEqual(matches[0]?.candidate, "iPad Mini");
	});

	test("ignores case by default and respects it when asked", () => {
		assert.strictEqual(run(NaiveSearch(), "ipad mini").length, 1);
		assert.strictEqual(
			run(NaiveSearch({ caseSensitive: true }), "ipad mini").length,
			0,
		);
	});

	test("does not match a partial entry", () => {
		assert.strictEqual(run(NaiveSearch(), "iPad").length, 0);
	});
});

describe("NormalizedNaive", () => {
	test("folds ambiguous characters before comparing", () => {
		const matches = run(NormalizedNaive(), "model 105 8", SERIALS);
		assert.strictEqual(matches.length, 1);
		assert.strictEqual(matches[0]?.candidate, "MODEL-1O5B");
		assert.strictEqual(matches[0]?.confidence, 0.9);
	});

	test("plain naive rejects what normalized naive accepts", () => {
		assert.strictEqual(run(NaiveSearch(), "model 105 8", SERIALS).length, 0);
	});

	test("an exact hit still outranks a folded one", () => {
		const matches = run(NormalizedNaive(), "PLAIN-TEXT", SERIALS);
		assert.strictEqual(matches[0]?.confidence, 1);
	});

	test("custom ambiguity groups replace the defaults", () => {
		const matches = run(
			NormalizedNaive({ ambiguityGroups: ["aeiou"] }),
			"ipad mono",
			["iPad Mini"],
		);
		assert.strictEqual(matches.length, 1);
	});

	test("buildAmbiguityMap folds both cases onto the group's first character", () => {
		const map = buildAmbiguityMap(DEFAULT_AMBIGUITY_GROUPS);
		assert.strictEqual(map.get("l"), "1");
		assert.strictEqual(map.get("I"), "1");
		assert.strictEqual(map.get("O"), "0");
		assert.strictEqual(map.get("s"), "5");
	});

	test("foldAmbiguous can keep punctuation", () => {
		const map = buildAmbiguityMap(DEFAULT_AMBIGUITY_GROUPS);
		assert.strictEqual(foldAmbiguous("A-B", map), "a-8");
		assert.strictEqual(
			foldAmbiguous("A-B", map, { stripNonAlphanumeric: true }),
			"a8",
		);
	});
});

describe("SubstringSearch", () => {
	test("reports where inside the candidate the hit starts", () => {
		const matches = run(SubstringSearch(), "Pro");
		assert.deepStrictEqual(
			matches.map((match) => match.index),
			[0, 1, 2],
		);
		assert.strictEqual(matches[0]?.position, 10);
	});

	test("confidence is how much of the candidate the query covers", () => {
		const matches = run(SubstringSearch(), "iPad Mini");
		assert.strictEqual(matches[0]?.confidence, 1);
	});
});

describe("PrefixSearch", () => {
	test("only matches at the start of an entry", () => {
		const matches = run(PrefixSearch(), "iPhone");
		assert.deepStrictEqual(
			matches.map((match) => match.index),
			[0, 1],
		);
		assert.strictEqual(matches[0]?.position, 0);
	});

	test("ignores a hit in the middle", () => {
		assert.strictEqual(run(PrefixSearch(), "Pro").length, 0);
	});
});

describe("KMP", () => {
	test("buildFailureTable computes borders", () => {
		assert.deepStrictEqual(buildFailureTable("ababaca"), [0, 0, 1, 2, 3, 0, 1]);
	});

	test("kmpIndexOf agrees with indexOf", () => {
		const table = buildFailureTable("aba");
		assert.strictEqual(kmpIndexOf("abcabab", "aba", table), 3);
		assert.strictEqual(
			kmpIndexOf("abcabab", "zzz", buildFailureTable("zzz")),
			-1,
		);
	});

	test("finds substrings and reports position", () => {
		const matches = run(KMP(), "Pro");
		assert.deepStrictEqual(
			matches.map((match) => match.index),
			[0, 1, 2],
		);
		assert.strictEqual(matches[0]?.position, 10);
	});

	test("reuses one failure table across the dataset", () => {
		const algorithm = KMP();
		assert.strictEqual(run(algorithm, "Pro").length, 3);
		assert.strictEqual(run(algorithm, "Mini").length, 1);
	});
});

describe("BoyerMoore", () => {
	test("horspoolIndexOf agrees with indexOf", () => {
		const needle = "pro";
		const table = buildBadCharacterTable(needle);
		assert.strictEqual(horspoolIndexOf("macbook pro 16", needle, table), 8);
		assert.strictEqual(horspoolIndexOf("macbook air 13", needle, table), -1);
	});

	test("finds the same hits as KMP", () => {
		assert.deepStrictEqual(
			run(BoyerMoore(), "Pro").map((match) => match.index),
			run(KMP(), "Pro").map((match) => match.index),
		);
	});
});

describe("Levenshtein", () => {
	test("levenshteinDistance counts edits", () => {
		assert.strictEqual(levenshteinDistance("kitten", "sitting"), 3);
		assert.strictEqual(levenshteinDistance("", "abc"), 3);
		assert.strictEqual(levenshteinDistance("same", "same"), 0);
	});

	test("catches a typo above the default threshold", () => {
		const matches = run(Levenshtein(), "MacBook Pr 16");
		assert.strictEqual(matches[0]?.candidate, "MacBook Pro 16");
		assert.ok((matches[0]?.confidence ?? 0) > 0.9);
	});

	test("rejects an unrelated entry", () => {
		assert.strictEqual(run(Levenshtein(), "totally different").length, 0);
	});

	test("maxDistance rejects beyond a fixed edit budget", () => {
		assert.strictEqual(
			run(Levenshtein({ maxDistance: 0 }), "MacBook Pr 16").length,
			0,
		);
	});
});

describe("JaroWinkler", () => {
	test("jaroWinklerSimilarity rewards a shared prefix", () => {
		const withPrefix = jaroWinklerSimilarity("martha", "marhta");
		assert.ok(withPrefix > 0.96 && withPrefix < 0.97);
		assert.strictEqual(jaroWinklerSimilarity("abc", "xyz"), 0);
	});

	test("matches a transposition above the default threshold", () => {
		const matches = run(JaroWinkler(), "iPad Mimi");
		assert.strictEqual(matches[0]?.candidate, "iPad Mini");
	});
});

describe("NgramSearch", () => {
	test("toNgrams keeps short strings whole", () => {
		assert.deepStrictEqual(toNgrams("abcd", 3), ["abc", "bcd"]);
		assert.deepStrictEqual(toNgrams("ab", 3), ["ab"]);
		assert.deepStrictEqual(toNgrams("", 3), []);
	});

	test("diceCoefficient is 1 for identical bags and 0 for disjoint ones", () => {
		assert.strictEqual(diceCoefficient(["ab", "bc"], ["ab", "bc"]), 1);
		assert.strictEqual(diceCoefficient(["ab"], ["zz"]), 0);
	});

	test("survives shuffled words, which edit distance does not", () => {
		const matches = run(NgramSearch(), "Pro MacBook 16");
		assert.strictEqual(matches[0]?.candidate, "MacBook Pro 16");
		assert.strictEqual(run(Levenshtein(), "Pro MacBook 16").length, 0);
	});
});

describe("SoundexSearch", () => {
	test("soundex encodes homophones identically", () => {
		assert.strictEqual(soundex("Robert"), "R163");
		assert.strictEqual(soundex("Rupert"), "R163");
		assert.strictEqual(soundex("Tymczak"), "T522");
		assert.strictEqual(soundex("!!!"), "");
	});

	test("matches a whole entry that sounds alike", () => {
		const matches = run(SoundexSearch(), "Ruppert", ["Robert", "Alice"]);
		assert.strictEqual(matches[0]?.candidate, "Robert");
		assert.strictEqual(matches[0]?.confidence, 1);
	});

	test("a single matching word scores lower and reports its offset", () => {
		const matches = run(SoundexSearch(), "Ruppert", ["Alice and Robert"]);
		assert.strictEqual(matches[0]?.confidence, 0.75);
		assert.strictEqual(matches[0]?.position, 10);
	});

	test("token matching can be turned off", () => {
		assert.strictEqual(
			run(SoundexSearch({ matchTokens: false }), "Ruppert", [
				"Alice and Robert",
			]).length,
			0,
		);
	});
});

describe("FuzzySubsequence", () => {
	test("matches an initialism", () => {
		const matches = run(FuzzySubsequence(), "mbp");
		assert.strictEqual(matches[0]?.candidate, "MacBook Pro 16");
		assert.strictEqual(matches[0]?.position, 0);
	});

	test("requires the characters in order", () => {
		assert.strictEqual(run(FuzzySubsequence(), "pbm").length, 0);
	});

	test("an exact match scores 1", () => {
		const matches = run(FuzzySubsequence(), "iPad Mini", ["iPad Mini"]);
		assert.strictEqual(matches[0]?.confidence, 1);
	});
});
