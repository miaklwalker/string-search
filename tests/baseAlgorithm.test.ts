import assert from "node:assert";
import test, { describe } from "node:test";
import type { AlgorithmRunContext } from "../modules/index.ts";
import { alwaysMatch, MODELS, StubAlgorithm } from "./support.ts";

function context(
	overrides: Partial<AlgorithmRunContext> = {},
): AlgorithmRunContext {
	return {
		query: "anything",
		behavior: "find-all",
		threshold: 0,
		limit: Number.POSITIVE_INFINITY,
		culled: new Set(),
		...overrides,
	};
}

describe("BaseAlgorithm.run", () => {
	test("returns index, confidence and candidate for every match", () => {
		const result = alwaysMatch("stub", 0.5).run(MODELS, context());

		assert.strictEqual(result.algorithm, "stub");
		assert.strictEqual(result.matches.length, MODELS.length);
		assert.deepStrictEqual(result.matches[0], {
			index: 0,
			confidence: 0.5,
			candidate: "iPhone 15 Pro",
		});
	});

	test("stop-on-match returns at most one match and stops scanning", () => {
		const algorithm = alwaysMatch("stub");
		const result = algorithm.run(
			MODELS,
			context({ behavior: "stop-on-match" }),
		);

		assert.strictEqual(result.matches.length, 1);
		assert.strictEqual(algorithm.seen.length, 1);
	});

	test("drops scores below the threshold", () => {
		const algorithm = new StubAlgorithm("stub", (candidate) =>
			candidate.startsWith("iPhone") ? 0.9 : 0.2,
		);
		const result = algorithm.run(MODELS, context({ threshold: 0.5 }));

		assert.deepStrictEqual(
			result.matches.map((match) => match.candidate),
			["iPhone 15 Pro", "iPhone 15 Pro Max"],
		);
	});

	test("a zero score never matches, even with a zero threshold", () => {
		const result = new StubAlgorithm("stub", () => 0).run(MODELS, context());
		assert.deepStrictEqual(result.matches, []);
	});

	test("clamps out-of-range confidences into 0-1", () => {
		const result = new StubAlgorithm("stub", () => 42).run(MODELS, context());
		assert.strictEqual(result.matches[0]?.confidence, 1);
	});

	test("honours the match limit", () => {
		const result = alwaysMatch("stub").run(MODELS, context({ limit: 2 }));
		assert.strictEqual(result.matches.length, 2);
	});

	test("an empty query matches nothing and scores nothing", () => {
		const algorithm = alwaysMatch("stub");
		const result = algorithm.run(MODELS, context({ query: "" }));

		assert.deepStrictEqual(result.matches, []);
		assert.deepStrictEqual(algorithm.seen, []);
	});

	test("skips culled indices without scoring them", () => {
		const algorithm = alwaysMatch("stub");
		const result = algorithm.run(MODELS, context({ culled: new Set([0, 2]) }));

		assert.strictEqual(result.matches.length, MODELS.length - 2);
		assert.strictEqual(algorithm.seen.length, MODELS.length - 2);
		assert.ok(!result.matches.some((match) => match.index === 0));
		assert.ok(!result.matches.some((match) => match.index === 2));
	});
});
