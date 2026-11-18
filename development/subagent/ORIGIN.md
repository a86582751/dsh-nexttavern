# Maintained source origin

Upstream: https://github.com/deepseek-ai/deepseek-harness
Commit: 477b4f420553e8a52c2fbccc464d7561b239c443 (dsh-v0.1.7-rc.2)
Original package path: packages/subagent/subagent
License: upstream MIT; copied source retains its original notices.

The runtime extends the host-installed `@deepseek-ai/dsh-subagent` service (minimum `0.2.2-rc.5`) and registers the host's Typert contribution for the file-URL plugin. Harness owns provider registration, named activations, browser access and continuation. The maintained TypeScript adds the Native one-shot spawn operation. One-shot children use the host descriptor, with author and Ruby activation provenance stored in separate Native events. The root release manifest owns the build, package and license mappings.
