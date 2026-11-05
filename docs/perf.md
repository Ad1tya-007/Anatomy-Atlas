# Performance

Numbers below compare **Phase 0 HEAD** (`e0d504f`, one JS chunk, always-on render loop, original 1024px maps) with **this branch**. GPU timings used Metal in Chrome; Lighthouse used SwiftShader and 4× CPU throttle. Absolute frame times on SwiftShader are not device numbers.

Reproduce:

```bash
npm run build
npx tsx scripts/perf.ts --label after --gpu
npm run perf:budgets
npm run perf:lighthouse
ATLAS_LH_PRESET=mobile npm run perf:lighthouse
npm run perf:model
```

## Bundle

|                          | Before                        | After                                 |
| ------------------------ | ----------------------------- | ------------------------------------- |
| First-load JS, gzip      | 500 kB (1.77 MB raw, 1 chunk) | 526 kB (1.85 MB raw, scene preloaded) |
| Render-blocking JS, gzip | 500 kB                        | **216 kB**                            |
| Lazy JS, gzip            | 0                             | 164 kB (progress 108 kB, tutor 41 kB) |
| CSS, gzip                | 14 kB                         | 15 kB                                 |
| JS chunks                | 1                             | 20                                    |

The 3D scene is a dynamic `import()` so the shell can paint first. A Vite plugin `modulepreload`s that chunk (tagged `data-scene`) so it still downloads in parallel with the app bundle. `scripts/check-budgets.ts` fails CI if render-blocking JS exceeds 240 kB gzip, first-load JS exceeds 560 kB gzip, or the largest lazy chunk exceeds 130 kB gzip.

## Model

|                                             | Before  | After                                                                    |
| ------------------------------------------- | ------- | ------------------------------------------------------------------------ |
| GLB                                         | 3.26 MB | **3.06 MB**                                                              |
| Estimated GPU texture memory (with mipmaps) | ~328 MB | **~176 MB**                                                              |
| Triangles                                   | 508,782 | 508,782                                                                  |
| Compression                                 | Draco   | Draco (meshopt was 5.2 MB; see [ADR 0003](adr/0003-draco-vs-meshopt.md)) |

38 normal maps that were 1024×1024 are now 512×512. Geometry bytes are copied through, not re-encoded.

## Runtime (GPU, 1440×900)

|                                    | Before    | After       |
| ---------------------------------- | --------- | ----------- |
| Idle frames / 5 s                  | 300       | **0**       |
| Idle main-thread, 5 s              | 688 ms    | **2 ms**    |
| Orbit median draw calls            | 520       | **263**     |
| Orbit median triangles             | 1,484,950 | **742,526** |
| Orbit median frame                 | 16.7 ms   | 16.7 ms     |
| Time to `data-model-state="ready"` | ~0.7 s    | ~0.7 s      |

`Canvas frameloop="demand"` plus a store subscription that calls `invalidate()`. Contact shadows re-render once after bones stop moving, which is why orbit draw calls drop by about half (the shadow pass used to double every frame). Adaptive DPR steps 1 → 1.25 → 1.5 → 1.75 from back-to-back frame times; idle gaps are ignored, so the demand loop cannot be mistaken for a slow GPU.

## Lighthouse CI (median of 3, SwiftShader)

|             | Before desktop | After desktop | After mobile      |
| ----------- | -------------- | ------------- | ----------------- |
| Performance | 71             | **91**        | 66                |
| FCP / LCP   | 252 / 258 ms   | 252 / 252 ms  | 913 / 913 ms      |
| TBT         | 768 ms         | **216 ms**    | 4011 ms (warning) |
| CLS         | 0              | 0             | 0                 |
| Transfer    | 3.6 MB         | 3.6 MB        | 3.6 MB            |

Desktop assertions error on FCP < 1 s, LCP < 1.2 s, CLS < 0.05, accessibility ≥ 0.85, best-practices ≥ 0.95, script transfer < 600 kB. Mobile TBT is a warning: software WebGL plus 4× throttle evaluates the full skeleton on the CPU. Real-device GPU idle cost is the 0-frames row above.

## Web Vitals in production

`startVitals()` loads `web-vitals` after first paint and beacons `{path, metrics, viewport, dpr, connection}` to `POST /api/vitals` when the page hides. The function writes one JSON line per metric (`type: "web-vital"`). Nothing is stored; no IP or user id is logged.
