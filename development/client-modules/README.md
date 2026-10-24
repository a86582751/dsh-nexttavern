# Maintained rc.2 client modules

This MIT fork preserves the upstream `@deepseek-ai/dsh-client-modules@0.1.7-rc.2`
package and export names. `ORIGIN.json` records the exact upstream Git sources.
Only TypeScript is maintained; the central source manifest owns every generated
module, browser wrapper, Host payload and public mapping.

The Node registry treats filesystem metadata as an observation hint. It retains
the accepted graph and executable revision when a changed file has identical
bytes. This prevents a shared hardlink's metadata change from replacing live
browser providers. Different executable bytes follow the existing publication
path. A failed artifact read leaves the accepted artifact and baseline intact.

The browser implementation and legal hot replacement behavior are unchanged.
This change does not make arbitrary live provider replacement safe. Host
activation and rollback remain manual operations; installing the product only
carries this package's payload. Added normal, retry and fallback model requests
are all zero.

The upstream Node module remains together because it owns the artifact table,
graph composition and publication. Its existing size is retained for this
bounded change rather than introducing a second artifact owner.
