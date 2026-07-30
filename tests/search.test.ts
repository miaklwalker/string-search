import assert from "node:assert";
import test, { describe } from "node:test";
import {
	KMP,
	NaiveSearch,
	Search,
	SearchConfigError,
} from "../modules/index.ts";
import {
	alwaysMatch,
	MODELS,
	neverMatch,
	StubAlgorithm,
} from "./support.ts";

describe("Search registration", () => {
	test("registers under the algorithm's own name", () => {
		const search = new Search().register(NaiveSearch()).register(KMP());
		assert.deepStrictEqual(search.algorithms, ["naive", "kmp"]);
	});

	test("rejects a duplicate name", () => {
		const search = new Search().register(NaiveSearch());
		assert.throws(() => search.register(NaiveSearch()), SearchConfigError);
	});
});

describe("Search.defineDataset", () => {
	test("rejects non-string entries", () => {
		const search = new Search().register(NaiveSearch());
		assert.throws(
			() => search.defineDataset(["fine", 7 as unknown as string]),
			SearchConfigError,
		);
	});

	test("searching without a dataset throws", () => {
		const search = new Search().register(NaiveSearch());
		assert.throws(() => search.search("iPad Mini"), SearchConfigError);
	});

	test("searching without an algorithm throws", () => {
		const search = new Search().defineDataset(MODELS);
		assert.throws(() => search.search("iPad Mini"), SearchConfigError);
	});
});

describe("Search.runOrder", () => {
	test("runs algorithms in the given order", () => {
		const result = new Search()
			.register(alwaysMatch("first", 0.4))
			.register(alwaysMatch("second", 0.4))
			.defineDataset(["a"])
			.runOrder(["second", "first"])
			.search("a");

		assert.deepStrictEqual(result.ranAlgorithms, ["second", "first"]);
	});

	test("falls back to registration order", () => {
		const result = new Search()
			.register(alwaysMatch("first", 0.4))
			.register(alwaysMatch("second", 0.4))
			.defineDataset(["a"])
			.search("a");

		assert.deepStrictEqual(result.ranAlgorithms, ["first", "second"]);
	});

	test("a subset leaves the rest unrun", () => {
		const result = new Search()
			.register(alwaysMatch("first", 0.4))
			.register(alwaysMatch("second", 0.4))
			.defineDataset(["a"])
			.runOrder(["first"])
			.search("a");

		assert.deepStrictEqual(result.ranAlgorithms, ["first"]);
		assert.deepStrictEqual(Object.keys(result.byAlgorithm), ["first"]);
	});

	test("rejects an unregistered name at runtime", () => {
		const search = new Search().register(NaiveSearch()).defineDataset(MODELS);
		assert.throws(
			() => search.runOrder(["nope" as unknown as "naive"]),
			SearchConfigError,
		);
	});

	test("rejects a repeated name", () => {
		const search = new Search()
			.register(NaiveSearch())
			.register(KMP())
			.defineDataset(MODELS);
		assert.throws(() => search.runOrder(["naive", "naive"]), SearchConfigError);
	});
});

describe("Search outcome behavior", () => {
	test("find-all is the default and runs everything", () => {
		const result = new Search()
			.register(alwaysMatch("first", 0.4))
			.register(alwaysMatch("second", 0.4))
			.defineDataset(MODELS)
			.cullMatchedRows(false)
			.search("anything");

		assert.deepStrictEqual(result.ranAlgorithms, ["first", "second"]);
		assert.strictEqual(result.matches.length, MODELS.length * 2);
	});

	test("a global stop-on-match ends the pipeline at the first hit", () => {
		const result = new Search()
			.register(alwaysMatch("first", 0.4))
			.register(alwaysMatch("second", 0.4))
			.defineDataset(MODELS)
			.defineBehavior("stop-on-match")
			.search("anything");

		assert.deepStrictEqual(result.ranAlgorithms, ["first"]);
		assert.strictEqual(result.matches.length, 1);
	});

	test("a global stop-on-match still moves past algorithms that find nothing", () => {
		const result = new Search()
			.register(neverMatch("first"))
			.register(alwaysMatch("second", 0.4))
			.defineDataset(MODELS)
			.defineBehavior("stop-on-match")
			.search("anything");

		assert.deepStrictEqual(result.ranAlgorithms, ["first", "second"]);
		assert.strictEqual(result.best?.algorithm, "second");
	});

	test("stopOnMatch on a registration overrides a global find-all", () => {
		const result = new Search()
			.register(alwaysMatch("first", 0.4), { stopOnMatch: true })
			.register(alwaysMatch("second", 0.4))
			.defineDataset(MODELS)
			.defineBehavior("find-all")
			.search("anything");

		assert.deepStrictEqual(result.ranAlgorithms, ["first"]);
		assert.strictEqual(result.matches.length, 1);
	});

	test("stopOnMatch: false on a registration overrides a global stop-on-match", () => {
		const result = new Search()
			.register(alwaysMatch("first", 0.4), { stopOnMatch: false })
			.register(alwaysMatch("second", 0.4))
			.defineDataset(MODELS)
			.defineBehavior("stop-on-match")
			.cullMatchedRows(false)
			.search("anything");

		assert.deepStrictEqual(result.ranAlgorithms, ["first", "second"]);
		assert.strictEqual(result.matches.length, MODELS.length + 1);
	});

	test("an explicit behavior wins over the stopOnMatch shorthand", () => {
		const result = new Search()
			.register(alwaysMatch("first", 0.4), {
				stopOnMatch: true,
				behavior: "find-all",
			})
			.register(alwaysMatch("second", 0.4))
			.defineDataset(MODELS)
			.search("anything");

		assert.deepStrictEqual(result.ranAlgorithms, ["first", "second"]);
	});
});

describe("Search.cullMatchedRows", () => {
	test("is on by default — a later algorithm skips rows an earlier one already matched", () => {
		const result = new Search()
			.register(alwaysMatch("first", 0.4))
			.register(alwaysMatch("second", 0.4))
			.defineDataset(MODELS)
			.search("anything");

		assert.strictEqual(result.byAlgorithm.first?.length, MODELS.length);
		assert.strictEqual(result.byAlgorithm.second?.length, 0);
		assert.strictEqual(result.matches.length, MODELS.length);
	});

	test("only culls the rows actually matched, not the whole dataset", () => {
		const matchesPro = new StubAlgorithm("first", (candidate) =>
			candidate.includes("Pro") ? 0.9 : null,
		);
		const result = new Search()
			.register(matchesPro)
			.register(alwaysMatch("second", 0.4))
			.defineDataset(MODELS)
			.search("anything");

		const proIndices = MODELS.map((_, index) => index).filter((index) =>
			MODELS[index]?.includes("Pro"),
		);

		assert.strictEqual(result.byAlgorithm.first?.length, proIndices.length);
		assert.strictEqual(
			result.byAlgorithm.second?.length,
			MODELS.length - proIndices.length,
		);
		for (const match of result.byAlgorithm.second ?? []) {
			assert.ok(!proIndices.includes(match.index));
		}
	});

	test("disabling it restores every algorithm seeing every row", () => {
		const result = new Search()
			.register(alwaysMatch("first", 0.4))
			.register(alwaysMatch("second", 0.4))
			.defineDataset(MODELS)
			.cullMatchedRows(false)
			.search("anything");

		assert.strictEqual(result.byAlgorithm.first?.length, MODELS.length);
		assert.strictEqual(result.byAlgorithm.second?.length, MODELS.length);
		assert.strictEqual(result.matches.length, MODELS.length * 2);
	});

	test("re-enabling after disabling takes effect again", () => {
		const result = new Search()
			.register(alwaysMatch("first", 0.4))
			.register(alwaysMatch("second", 0.4))
			.defineDataset(MODELS)
			.cullMatchedRows(false)
			.cullMatchedRows(true)
			.search("anything");

		assert.strictEqual(result.byAlgorithm.second?.length, 0);
	});
});

describe("Search results", () => {
	test("reports the highest-confidence match as best", () => {
		const result = new Search()
			.register(alwaysMatch("weak", 0.3))
			.register(alwaysMatch("strong", 0.95))
			.defineDataset(["only"])
			.cullMatchedRows(false)
			.search("only");

		assert.strictEqual(result.best?.algorithm, "strong");
		assert.strictEqual(result.best?.confidence, 0.95);
		assert.strictEqual(result.matched, true);
	});

	test("tags every match with its algorithm and groups them", () => {
		const result = new Search()
			.register(NaiveSearch())
			.register(KMP())
			.defineDataset(MODELS)
			.cullMatchedRows(false)
			.search("iPad Mini");

		assert.deepStrictEqual(
			result.matches.map((match) => match.algorithm),
			["naive", "kmp"],
		);
		assert.strictEqual(result.byAlgorithm.naive?.length, 1);
		assert.strictEqual(result.byAlgorithm.kmp?.[0]?.index, 4);
	});

	test("no match leaves best null and matched false", () => {
		const result = new Search()
			.register(NaiveSearch())
			.defineDataset(MODELS)
			.search("Nothing At All");

		assert.strictEqual(result.matched, false);
		assert.strictEqual(result.best, null);
		assert.deepStrictEqual(result.byAlgorithm.naive, []);
	});

	test("a per-registration threshold overrides the algorithm's own", () => {
		const strict = new Search()
			.register(KMP(), { threshold: 0.9 })
			.defineDataset(MODELS)
			.search("Pro");
		const loose = new Search()
			.register(KMP())
			.defineDataset(MODELS)
			.search("Pro");

		assert.strictEqual(strict.matched, false);
		assert.strictEqual(loose.matched, true);
	});

	test("a per-registration limit caps a find-all algorithm", () => {
		const result = new Search()
			.register(alwaysMatch("stub", 0.4), { limit: 2 })
			.defineDataset(MODELS)
			.search("anything");

		assert.strictEqual(result.matches.length, 2);
	});

	test("echoes the query back", () => {
		const result = new Search()
			.register(NaiveSearch())
			.defineDataset(MODELS)
			.search("iPad Mini");

		assert.strictEqual(result.query, "iPad Mini");
	});
});
