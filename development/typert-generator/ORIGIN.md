# Maintained source origin

Upstream: https://github.com/deepseek-ai/deepseek-harness
Commit: 477b4f420553e8a52c2fbccc464d7561b239c443 (dsh-v0.1.7-rc.2)
Original package path: packages/typert/generator
License: upstream MIT; LICENSE and LICENSE.upstream retain the exact root notice.

All eight src/*.ts files are copied directly from the pinned Git objects without implementation changes. Metadata normalizes workspace selectors to the rc.2 cohort and pins the generator's actual TypeScript 6.0.3 and gen-mapping 0.3.13 dependencies. Its public exports, including ./tsdown, remain available.

The maintained subagent Typert producer uses this real analyzer and emitter in host/check mode. It resolves the generator compiler through the build tools' locked nexttavern-typert-typescript alias while the ordinary checker keeps TypeScript 5.9.3. The canonical source manifest owns every input, generated artifact, resource and delivery mapping.
