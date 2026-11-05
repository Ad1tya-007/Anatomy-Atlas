# 0003. Keep Draco; shrink the normal maps instead

## Context

The skeleton GLB is the largest download (~3.3 MB) and the longest main-thread work after parse (texture upload). Phase 1 asked to compare Draco with meshopt and switch if meshopt is better.

## Decision

**Keep `KHR_draco_mesh_compression`.** Downsize the 38 1024×1024 normal maps to 512×512 JPEG, copying the Draco geometry bytes through unchanged (`scripts/resize-normal-maps.ts`). Pixel difference at a frontal close-up is <0.2 mean absolute per channel.

## Measurements (`npm run perf:model`)

|                 | GLB (raw) | Decoder                      | Median parse |
| --------------- | --------- | ---------------------------- | ------------ |
| Draco (shipped) | 3.21 MB   | ~75 kB gzip (wasm + wrapper) | 108 ms       |
| meshopt, high   | 5.18 MB   | bundled with three           | 106 ms       |

Meshopt decode is similar, but the file is larger because glTF-Transform's `meshopt()` always quantizes, then cannot re-apply Draco without an encoder, and the JPEG payload stays uncompressed-by-Draco.

Texture memory with mipmaps dropped from ~328 MB to ~176 MB. That is the first-render cost that actually moved.

## Status

Accepted. Revisit if a meshopt pipeline can beat Draco on _transfer + decoder_ together without changing vertex positions (landmarks sit on bounding boxes, but selection still uses the mesh).
