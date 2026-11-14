# Native V4 relationship authority

This minimal TypeScript closure derives from DeepSeek's MIT-licensed source at
commit `477b4f420553e8a52c2fbccc464d7561b239c443` in
`packages/session/session-format-v3-to-v4/src/`:

- `relationships.ts`: complete released lifecycle/surface/tool/retry/compaction/title/command rules.
- `developer.ts`: complete developer-field validation.
- `message-sources.ts`: message-source validation only.
- `sources.ts`: `mapEventMessages` only.
- `facts.ts`: `catalogFact` only.
- `validation.ts`: `validateDeliveryAccepted`, plus the adapted shared relationship entry.

The source came directly from this Git object's `.ts` files. It is not extracted
from generated JavaScript. No migration or encoder implementation is included.
The original copyright and MIT grant are retained in [LICENSE](LICENSE).

Maintenance changes replace full event-array ownership with a bounded indexed
reader, retain the released orphan-compaction lookahead across read boundaries,
and journal only mutations from the newly checked tail for failed-read rollback.
Cold and hot consumers use this one algorithm. The locked upstream whole
validator is a differential test oracle, not a second production pass.

Original Git-blob bytes (before extraction or maintenance edits):

| Upstream `.ts` file | SHA-256 |
| --- | --- |
| `developer.ts` | `176b7ad6479672351ca08419ff6fca35d635289e9651a672b009ed972d973e5b` |
| `facts.ts` | `3e8bfc595302191e1acd290106b2d393512003e11736952b84f4295c936d5858` |
| `message-sources.ts` | `880cf946c56416cabb3aba30a17be32d39f60961ff6568460567442b8fba28d0` |
| `relationships.ts` | `4802f65c6dee1d5da515116f7171e408cc9bf63219e04fd669d22db484493ebb` |
| `sources.ts` | `3848aeb9c12e5c962c882405d88173956483103d4b53670b5f25f3185018e004` |
| `validation.ts` | `c726ae5cae703afc898e240ac1e65b8ea5a96e9fa20ab2a1890e93d043b3f6dd` |
