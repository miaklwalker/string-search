---
title: "Run Order and Type Safety"
description: "How register widens the Search instance's type so runOrder only accepts algorithms you actually registered."
---

This is the library's headline feature: a typo in a run order is a compile
error, not a search that silently returns nothing.

## How the widening works

`Search` carries a type parameter, `TAlgorithms`, that starts at `never`:

```ts
class Search<TAlgorithms extends string = never> {
	register<TName extends string>(
		algorithm: BaseAlgorithm<TName>,
		options?: RegistrationOptions,
	): Search<TAlgorithms | TName>;

	runOrder(order: readonly TAlgorithms[]): this;
}
```

Each algorithm's `name` is a literal type parameter on `BaseAlgorithm`, not
just `string`: `NaiveSearch()` returns a `NaiveSearchAlgorithm` whose `name`
is typed `"naive"`, not `string`. Every `.register()` call widens the
instance's `TAlgorithms` union with that literal:

```ts
const search = new Search()        // Search<never>
	.register(NaiveSearch())          // Search<"naive">
	.register(NormalizedNaive())      // Search<"naive" | "normalized-naive">
	.register(KMP());                 // Search<"naive" | "normalized-naive" | "kmp">
```

`runOrder`'s parameter type is `readonly TAlgorithms[]`: at this point,
`readonly ("naive" | "normalized-naive" | "kmp")[]`. Pass anything outside
that union and the compiler rejects it before the code ever runs:

```ts
search.runOrder(["naive", "kmp"]);       // fine — both were registered
search.runOrder(["levenstein"]);         // compile error — "levenstein" is not
                                          // in the union ("kmp" was never
                                          // registered under that spelling)
```

The `algorithms` getter reflects the same union, so `search.algorithms` is
typed as `("naive" | "normalized-naive" | "kmp")[]`, not `string[]`, useful
if you pass it on to something else that also wants exact names.

## Runtime checks for the JavaScript case

The type system only protects TypeScript callers with the compiler in the
loop. `runOrder` also validates at runtime, throwing `SearchConfigError` for:

- a name that was never registered
- the same name appearing twice in the order

```ts
const search = new Search().register(NaiveSearch()).register(Levenshtein());

search.runOrder(["naive", "kmp"]);        // throws: "kmp" is not registered
search.runOrder(["naive", "naive"]);      // throws: "naive" appears twice
```

This is what catches the equivalent mistake from plain JavaScript, or from a
name built dynamically at runtime where the compiler cannot see the literal.

## Omitting `runOrder`

`runOrder` is optional. Without it, `.search()` runs every registered
algorithm in the order it was registered:

```ts
new Search()
	.register(NaiveSearch())
	.register(KMP())
	.defineDataset(allModels)
	.search("iPad Mini"); // runs naive, then kmp — registration order
```

Call it when you want a subset, a different order, or per-algorithm behavior
overrides tied to position. See
[Cheap-to-Expensive Cascades](cascades) for why order usually matters more
than it looks like it should.
