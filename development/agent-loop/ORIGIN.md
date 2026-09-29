Source: deepseek-ai/deepseek-harness
Commit: 477b4f420553e8a52c2fbccc464d7561b239c443
Upstream path: packages/core/agent-loop
Version: 0.1.7-rc.2
License: MIT (see LICENSE.upstream)

Local delta: src/agent.ts adds an idle-only, durable programmatic assistant turn commit API. The first programmatic surface reserves the native empty system head before the assistant so a later model turn remains cold-readable; existing system heads are retained, and a new commit behind a non-system head is refused before appending. src/runtime-context.ts also refuses to introduce a late system head during a real player request; the loop retains a closed error turn instead of corrupting that older transcript. Relative TypeScript imports were normalized to the repository's `.js` source convention, and src/index.ts uses the pinned Cordis 4.0.4 fiber state numbers because that package declares an ambient const enum without a runtime export. Package identity and override metadata are reserved for integration.
