import type en from "./en";

type DeepString<T> = { [K in keyof T]: T[K] extends string ? string : DeepString<T[K]> };

/** Every locale must provide exactly the keys of the English source. */
export type Translation = DeepString<typeof en>;
