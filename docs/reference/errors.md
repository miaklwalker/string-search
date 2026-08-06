---
title: "Errors"
description: "SearchConfigError and every situation the pipeline throws it for."
---

## `SearchConfigError`

```ts
class SearchConfigError extends Error {
	override name = "SearchConfigError";
}
```

The only error type the package throws. It extends `Error` and sets `name`
to `"SearchConfigError"`, so `instanceof Error` and `instanceof
SearchConfigError` both work, and the name is preserved through logging even
after minification.

It is thrown for every pipeline misconfiguration:

| Situation                                                    | Thrown from        |
| -------------------------------------------------------------- | -------------------- |
| Registering an algorithm name that is already registered       | `.register()`        |
| A dataset that is not an array                                 | `.defineDataset()`   |
| A dataset containing a non-string entry                        | `.defineDataset()`   |
| A `runOrder` entry that was never registered                   | `.runOrder()`        |
| The same name appearing more than once in a run order          | `.runOrder()`        |
| Calling `.search()` before `.defineDataset()`                  | `.search()`          |
| Calling `.search()` with nothing registered                    | `.search()`          |

```ts
import { NaiveSearch, Search, SearchConfigError } from "@michaelrwalker/search";

try {
	new Search().register(NaiveSearch()).register(NaiveSearch());
} catch (error) {
	if (error instanceof SearchConfigError) {
		console.error(error.message); // 'An algorithm named "naive" is
		                               // already registered...'
	}
}
```

## What is not a `SearchConfigError`

Bad input to `.search(query)` itself does not throw: an empty string simply
matches nothing (`BaseAlgorithm.run` returns immediately for a zero-length
query), and a query that matches no entry returns a `SearchResult` with
`matched: false` and `best: null` rather than throwing. `SearchConfigError`
is reserved for pipeline setup mistakes the compiler cannot catch in plain
JavaScript, not for a plain "no results."
