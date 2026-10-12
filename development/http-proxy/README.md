# Maintained HTTP proxy compatibility fork

This library retains the four upstream proxy-policy functions and process-wide installation/disposal behavior. The launcher installs it before mounting plugins.

Both policy dispatchers and a nested direct dispatcher use HTTP/1.1. With the deployed Undici 8.11 peer, the HTTP/2 bridge to Node 24 built-in fetch drops response headers and leaves Brotli bodies compressed. The policy owner selects the compatible transport; callers and SSE parsers consume the ordinary decoded fetch response. HTTP/2 multiplexing is unavailable for these dispatchers; latency impact has not been measured.

No model requests, retries, or fallback requests are added. No content sniffing, decoder patch, or response wrapper is introduced. With no prior policy and no configured proxy, the original early-return path remains in use.

The canonical source mapping owns generated lib outputs and the Host override. This private same-name fork is not an upstream or npm release.
