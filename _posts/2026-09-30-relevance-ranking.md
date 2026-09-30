---
layout: post
title: 'Relevance Ranking with Jev and Qwev (Qwen)'
date: 2026-09-30
slug: relevance-ranking-jev-qwen
# excerpt: 'I experimented with relevance ranking using Jev by TypeSafe AI. Here are my thoughts!'
---
<br />

#### This weekend, I experimented with relevance ranking using [Jev by TypeSafe AI](https://typesafe.ai/blog/introducing-system-one-models-and-jev). Here are my thoughts!
<br />

### The Approach

I framed the task into four classification probabilities: **Exact, Substitute, Complement, and Irrelevant**. Then I used the probabilities to calculate a relevance score.
<br />
<br />

I also adapted [Together AI’s Tev methodology](https://lnkd.in/gWWve2w7) to train a separate Qwen3.5-4B model on ~20k examples, using 1× NVIDIA RTX 6000 Ada with 48 GB VRAM. Instead of generating an answer token, it uses a four-class head and returns probabilities directly (**no autoregressive token generation and decode step!!**)
<br />
<br />

### Ranking Results

Results using Amazon’s shopping-query dataset. **NDCG@10 is higher-is-better**, and latency is the median per query.
<br />

<div class="relevance-results" markdown="1">

| Model | NDCG@10 | Median latency per query | Hardware / serving |
| :--- | ---: | ---: | :--- |
| Trained Qwen | .809 | 1,463 ms | 1× RTX 6000 Ada 48 GB, via Runpod |
| Jev | .807 | 197 ms | TypeSafe network API |
| BGE reranker | .770 | 44 ms | 1× RTX 6000 Ada 48 GB, via Runpod |
| Untuned Qwen | .745 | 1,442 ms | 1× RTX 6000 Ada 48 GB, via Runpod |
| MiniLM reranker | .740 | 19 ms | 1× RTX 6000 Ada 48 GB, via Runpod |
| BGE embeddings | .739 | 7 ms | 1× RTX 6000 Ada 48 GB, via Runpod |
| BM25 | .703 | 0.67 ms | Runpod host x86 CPU; exact CPU model not recorded |

</div>
<br />
<br />

### Classification Accuracy

Classification accuracy on the same **20,216 test pairs**. Four-class accuracy uses Exact / Substitute / Complement / Irrelevant. For binary accuracy, Exact + Substitute + Complement are considered Relevant.
<br />

<div class="relevance-results" markdown="1">

| Model | Four-class accuracy | Binary accuracy |
| :--- | ---: | ---: |
| Trained Qwen | 60.61% | 85.47% |
| Jev | 56.32% | 79.64% |
| Untuned Qwen | 50.66% | 83.34% |

</div>

The **predict-always-relevant baseline is 83.42%** for this dataset.
<br />
<br />

### My Takeaways

The simply trained Qwen didn't get a significant NDCG advantage over Jev, which is fully zero-shot! Jev is pretty impressive, but also I have no idea about parameter counts/comparisons.
<br />
<br />

I do think I could've had a significantly stronger training protocol for Qwen. I think a teacher-student protocol and also training my own encoder would have better results. I'm probably underutilizing the current parameters now.
<br />
<br />

Regarding the speed: without the decode step, prefill dominates processing and is the primary bottleneck (mostly compute-bound). **BGE reranking was ~33× faster on the same GPU**, while giving up some ranking quality.
<br />
<br />

Qwen used reference kernels, so this didn’t fully optimize serving/inference. First things to add are maybe better linear attention kernels and prefix caching.
<br />
<br />

This entire project cost about **$5.36** (Jev was ~$0.50, the rest was Runpod GPU costs). 

<br />
<br />


### Make a classifier or just use Jev?
Jev could really help with relevance + ranking without having to train and host large foundational models yourself. If you’ve been wanting to implement some candidate ranking for any kind of recommendation features on your platform, but haven’t had the bandwidth to make it good, Jev is a promising option, while being relatively cheap 😸
