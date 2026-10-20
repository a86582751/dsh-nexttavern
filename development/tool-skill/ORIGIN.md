# Maintained source origin

Upstream: https://github.com/deepseek-ai/deepseek-harness
Commit: 477b4f420553e8a52c2fbccc464d7561b239c443 (dsh-v0.1.7-rc.2)
Original package path: packages/skill/tool-skill
License: upstream MIT; the complete root LICENSE is retained.

Exact upstream raw-byte SHA-256:
- `src/index.ts`: `fb7b9f7558d516854ffe159803586decd1da003d7f10e04e026c4b7ca3622a1c`
- `package.json`: `e5fb8390f599199be33b473df1af7733dc4adb7c65b0391766ba9a33d5bfd76c`
- root `LICENSE`: `ebb4f09972aee8608be255debaf78451a68e95c290f55c240dec2ecfa16ea6be`

This maintained TypeScript fork preserves the upstream skill loader, catalog, invocation, scope and teardown behavior. Its only runtime changes are the two pre-step early returns for a first-step enter decision whose messages are empty, matching the existing AgentInstructions contract. A completed dedicated card conversion can intentionally return that empty entrance; appending a catalog or invoked skill afterward would revive the turn and spend an unrelated Main request.

The canonical release/source-manifest.json owns generated JavaScript, host override, package and public delivery mappings. Installed or bundled JavaScript is not a maintenance source.
