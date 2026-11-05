# 0001. BM25 first, embeddings as a comparison

## Context

The tutor has to ground every answer in this atlas (a few hundred bone, landmark, joint, and walk documents) and refuse questions the corpus does not cover. Interviewers will ask why the retriever is the way it is, so the choice has to be measured, not guessed.

## Decision

Ship **BM25** as the production retriever. Title (parenthetical stripped) ×3, aliases ×2, body ×1. Strip the parenthetical so a landmark titled "Head (Femur)" does not outrank the femur itself.

Keep **embedding** and **hybrid (RRF, k = 60)** implementations behind `npm run eval -- --mode`. The weekly GitHub Action loops those modes when `AI_GATEWAY_API_KEY` is set.

## Why BM25

- The corpus is small, named, and keyword-shaped: "greater trochanter", "foramen magnum", "C1".
- BM25 needs no API key, so every commit can check recall. On the 69-case suite it is **0.96** at k = 6 (the two misses are `fact-ankle-bumps` and `fact-foramen-magnum`).
- Embeddings add a download of `openai/text-embedding-3-small` at 256 dimensions and a cold-start round trip. They are worth it only if they recover those misses without dropping tool-call questions.

## Status

Accepted. Revisit when live embedding and hybrid numbers are in `evals/results/`.
