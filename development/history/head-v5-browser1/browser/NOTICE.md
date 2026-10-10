# Owned author browser runtime

The maintained browser compiler, partition controller, DOM/frame runtime and
provider are NextTavern source under GPL-3.0-only. The unique source manifest
owns their source/resource mappings and actual generated ESM/IIFE entries.
Original role cards and third-party helper programs are not part of this package.

This independent component carries the complete published TypeScript 5.9.3
package beneath node_modules/typescript, including its lib declarations,
LICENSE.txt and ThirdPartyNoticeText.txt. TypeScript is Apache-2.0. The existing
locked offline library assembler copies those published files without package
installation or lifecycle scripts; there is no build-tools runtime fallback.

The public async factory admits the actual protected package through Core's
verifyOwnedPackage callback once, then retains the same physical generation.
Only its fixed module/TypeScript layout can produce private artifact identities.
Caller hashes, worker URLs and serialized artifact data cannot grant admission.
Actual code compilation is bounded in a terminable worker; compiled programs
and child/guard artifacts are DATA, not Source, BrowserSession or Native rights.

assets/runtime.json describes the fixed provider, partition, AST worker, child
and guard roles. assets/source-inputs.json records their actual registered source
graphs. The product inventory protects all delivered bytes, including licenses.
The first physical ESM generation cannot be replaced in place and still use a
cached provider; a changed generation needs a fresh process or protected URL.

The child borrows actual owner-supplied snapshots and awaits its complete startup
chain. Startup cannot write player state; detached Promise calls are refused by
the positive AST profile. Actual scope, Source, current selection and Native
player operation ownership remain Core responsibilities. This component makes
no model requests and supplies no fake snapshot, Native acknowledgement or
BrowserSession. It does not contain AuthorHost-v5, schema executor-v4, journal,
replay, setting storage or raw model generation implementations.
