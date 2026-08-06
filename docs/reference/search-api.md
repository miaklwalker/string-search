---
title: "Search Class"
description: "The full method signature reference for the Search class."
---

```ts
class Search<TAlgorithms extends string = never> {
	get algorithms(): TAlgorithms[];

	register<TName extends string>(
		algorithm: BaseAlgorithm<TName>,
		options?: RegistrationOptions,
	): Search<TAlgorithms | TName>;

	defineDataset(dataset: readonly string[]): this;

	runOrder(order: readonly TAlgorithms[]): this;

	defineBehavior(behavior: MatchBehavior): this;

	cullMatchedRows(enabled?: boolean): this;

	search(query: string): SearchResult;
}
```

## `new Search()`

Takes no arguments. `TAlgorithms` starts at `never` and widens with each
`.register()` call. See
[Run Order and Type Safety](../guides/run-order-and-type-safety).

## `algorithms`

A getter, not a method. Returns the names of every registered algorithm, in
registration order, typed as `TAlgorithms[]`.

## `register(algorithm, options?)`

| Parameter   | Type                          | Notes                                                          |
| ----------- | ------------------------------ | ---------------------------------------------------------------- |
| `algorithm` | `BaseAlgorithm<TName>`         | An algorithm instance, typically from a factory like `NaiveSearch()`. |
| `options`   | `RegistrationOptions` (optional) | `stopOnMatch`, `behavior`, `threshold`, `limit`. See [Types](types). |

Throws `SearchConfigError` if `algorithm.name` is already registered. Returns
`Search<TAlgorithms | TName>`, the same instance, retyped.

## `defineDataset(dataset)`

Takes `readonly string[]`. Throws `SearchConfigError` if `dataset` is not an
array, or if any entry is not a string (the error names the offending
index). Returns `this`.

## `runOrder(order)`

Takes `readonly TAlgorithms[]`: only names already registered on this
instance type-check. Throws `SearchConfigError` at runtime for an
unregistered name or a name repeated in the list. Returns `this`. Optional:
without it, `.search()` uses registration order.

## `defineBehavior(behavior)`

Takes `"find-all" | "stop-on-match"`. Sets the pipeline-wide default; an
algorithm registered with its own `behavior` or `stopOnMatch` ignores it.
Returns `this`. `"find-all"` is the default if never called.

## `cullMatchedRows(enabled = true)`

Takes an optional `boolean`, defaulting to `true` if called with no argument.
Controls whether a row matched by an earlier algorithm in the run order is
skipped by later ones. `true` from the moment a `Search` is constructed, even
without calling this method. Returns `this`.

## `search(query)`

Takes the query string. Throws `SearchConfigError` if no dataset was defined
or nothing was registered. Runs every algorithm in the resolved run order,
honoring each one's resolved behavior, threshold, limit and culling, and
returns a `SearchResult`. See [Working with Results](../guides/working-with-results)
for the shape and [Types](types) for the full definition.
