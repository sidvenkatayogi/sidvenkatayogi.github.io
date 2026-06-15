---
title: "TIGER"
excerpt: "<img src='/images/tiger_rec.png' width='500' height='auto'>"
slug: tiger
order: 14
tags: [AI/ML, RecSys, Replication]
---
#### My implementation of TIGER, from the 2023 paper [Recommender Systems with Generative Retrieval](http://arxiv.org/abs/2305.05065) (Rajput et al.), trained and evaluated on Amazon Beauty.
<br />

| Metric | Mine | Paper |
|:---:|:---:|:---:|
| Recall@5 | 0.0312 | 0.0454 |
| NDCG@5 | 0.0210 | 0.0321 |
| Recall@10 | 0.0486 | 0.0648 |
| NDCG@10 | 0.0265 | 0.0384 |

<br />

Invalid-ID rate @10 ≈ 0.0006. Best checkpoint at step 20K (val NDCG@10 = 0.0377).
<br />
<br />

NDCG (Normalized Discounted Cumulative Gain) measures ranking quality, rewarding the correct item appearing higher in the top-K list. Hits are discounted by their rank and normalized so a perfect ranking scores 1.0.
<br />
<br />

### Future Work

- Improve hyperparameters or training behavior to match or improve on original paper's reported metrics. Current test metrics ended up at ~70% of paper reported.
- Add implementations for [PLUM](https://arxiv.org/abs/2510.07784) and [STATIC](https://arxiv.org/abs/2602.22647)
<br />
<br />

### References

- [Recommender Systems with Generative Retrieval](https://arxiv.org/abs/2305.05065) — Rajput et al., NeurIPS 2023.
- [Autoregressive Image Generation using Residual Quantization](https://arxiv.org/abs/2203.01941) — Lee et al. (RQ-VAE).

<br />