import assert from "node:assert";
import test, { describe } from "node:test";
import {
	KMP,
	Levenshtein,
	NaiveSearch,
	NormalizedNaive,
	Search,
	SearchConfigError,
} from "../modules/index.ts";
import type { Equal, Expect } from "./support.ts";

describe("Search type inference", () => {
	test("register widens the union of known algorithm names", () => {
		const search = new Search()
			.register(NaiveSearch())
			.register(NormalizedNaive())
			.register(KMP());

		type Names = typeof search extends Search<infer TNames> ? TNames : never;
		type _Names = Expect<Equal<Names, "naive" | "normalized-naive" | "kmp">>;
		type _Getter = Expect<
			Equal<typeof search.algorithms, ("naive" | "normalized-naive" | "kmp")[]>
		>;

		assert.deepStrictEqual(search.algorithms, [
			"naive",
			"normalized-naive",
			"kmp",
		]);
	});

	test("runOrder only accepts registered names", () => {
		const search = new Search().register(NaiveSearch()).register(Levenshtein());

		assert.throws(() => {
			// @ts-expect-error "kmp" was never registered.
			search.runOrder(["naive", "kmp"]);
		}, SearchConfigError);

		assert.throws(() => {
			// @ts-expect-error a typo is a compile error, not a silent no-op.
			search.runOrder(["levenstein"]);
		}, SearchConfigError);

		search.runOrder(["levenshtein", "naive"]);
		assert.deepStrictEqual(search.algorithms, ["naive", "levenshtein"]);
	});

	test("a fresh Search has no algorithms to order", () => {
		const search = new Search();

		assert.throws(() => {
			// @ts-expect-error nothing is registered, so nothing can be ordered.
			search.runOrder(["naive"]);
		}, SearchConfigError);

		search.runOrder([]);
		assert.deepStrictEqual(search.algorithms, []);
	});

	test("algorithm names are literal types, not string", () => {
		type _Naive = Expect<
			Equal<ReturnType<typeof NaiveSearch>["name"], "naive">
		>;
		type _Kmp = Expect<Equal<ReturnType<typeof KMP>["name"], "kmp">>;
		assert.strictEqual(KMP().name, "kmp");
	});
});
