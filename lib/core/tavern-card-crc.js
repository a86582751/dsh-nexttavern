// Generated from runtime/alpha3/src/core/tavern-card-crc.ts; edit the TypeScript source.
const crcTable = Uint32Array.from({ length: 256 }, (_, seed) => {
    let value = seed;
    for (let i = 0; i < 8; i++)
        value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    return value >>> 0;
});
export function pngCrc(bytes) {
    let crc = 0xffffffff;
    for (const byte of bytes)
        crc = (crcTable[(crc ^ byte) & 255] ?? 0) ^ (crc >>> 8);
    return (crc ^ 0xffffffff) >>> 0;
}
