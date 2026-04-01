---
title: "Chrom.io"
excerpt: "<img src='/images/chromio.png' width='500' height='auto'>"
slug: chromio
order: 8
---
#### Work for my project in Texas Luminescence, Chrom.io (text-to-color palette generator). This project did get scrapped because the final full stack product was pretty basic, but I learned a lot experimenting on the ML end!

<br />


#### The main thing I did was design and execute an RLVR fine-tuning protocol to improve color palette generation in small LLMs. Used deterministic reward metrics for aesthetic output, and serverless LoRA fine-tuning on the Fireworks.ai platform

<br />

### Improved Qwen3-8B palette similarity scores by 13% over baseline, beating gpt-5-mini and gpt-4o!
<br />
 

#### Need to do a write-up of this project eventually because it was really interesting, but basically we used this [paper](https://arxiv.org/abs/2508.08987) + fine tuning to get SOTA performance.

<br />

### [Github Repository!](https://github.com/sidvenkatayogi/chromio) (mainly look at /ml and /experiments)

<br />
<br />

(score_R is generated pallete similarity to ground truth palettes)
![](/images/chromio.png)