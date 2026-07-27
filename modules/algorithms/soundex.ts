import { BaseAlgorithm, type BaseAlgorithmOptions } from "../baseAlgorithm.ts";
import type { AlgorithmScore } from "../types.ts";

const SOUNDEX_CODES: Readonly<Record<string, string>> = {
	b: "1",
	f: "1",
	p: "1",
	v: "1",
	c: "2",
	g: "2",
	j: "2",
	k: "2",
	q: "2",
	s: "2",
	x: "2",
	z: "2",
	d: "3",
	t: "3",
	l: "4",
	m: "5",
	n: "5",
	r: "6",
};

/**
 * The classic Soundex code: an initial letter plus three digits, so
 * `"Robert"` and `"Rupert"` both encode to `R163`. Returns `""` for input
 * with no letters in it.
 */
export function soundex(value: string): string {
	const letters = value.toLowerCase().replace(/[^a-z]/g, "");
	const first = letters[0];
	if (first === undefined) return "";

	let code = first.toUpperCase();
	let previous = SOUNDEX_CODES[first] ?? "";

	for (let i = 1; i < letters.length && code.length < 4; i += 1) {
		const letter = letters[i];
		if (letter === undefined) continue;
		const digit = SOUNDEX_CODES[letter] ?? "";
		if (digit !== "" && digit !== previous) code += digit;
		if (letter !== "h" && letter !== "w") previous = digit;
	}

	return code.padEnd(4, "0");
}

export type SoundexOptions = BaseAlgorithmOptions & {
	/**
	 * Also match when any single word of the candidate sounds like the query.
	 * `true` by default; those hits score `0.75` rather than `1`.
	 */
	matchTokens?: boolean;
};

/**
 * Phonetic matching: entries that *sound* like the query, however they are
 * spelled. Catches the misspellings edit distance misses — `"phone"` against
 * `"faun"` — at the cost of collapsing genuinely different words that happen
 * to share a code.
 *
 * Whole-string code equality scores `1`; a single matching word inside a
 * longer entry scores `0.75` and reports its `position`.
 */
export class SoundexAlgorithm extends BaseAlgorithm<"soundex"> {
	private readonly matchTokens: boolean;

	constructor(options: SoundexOptions = {}) {
		super("soundex", options);
		this.matchTokens = options.matchTokens ?? true;
	}

	protected override score(
		candidate: string,
		query: string,
	): AlgorithmScore | null {
		const target = soundex(query);
		if (target === "") return null;

		if (soundex(candidate) === target) return { confidence: 1, position: 0 };
		if (!this.matchTokens) return null;

		let offset = 0;
		for (const token of candidate.split(/(\s+)/)) {
			if (token.trim() !== "" && soundex(token) === target) {
				return { confidence: 0.75, position: offset };
			}
			offset += token.length;
		}
		return null;
	}
}

/** Creates a {@link SoundexAlgorithm}. */
export function SoundexSearch(options?: SoundexOptions): SoundexAlgorithm {
	return new SoundexAlgorithm(options);
}
