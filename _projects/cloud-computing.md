---
title: "CS 378 (Cloud Computing)"
excerpt: "<img src='/images/cloud.jpg' width='500' height='auto'>"
slug: cloud-computing
order: 16
tags: [Coursework, Systems, Data, AI/ML]
---

### Projects for CS 378: Cloud Computing aka Applied Distributed Systems with Dr. Kia Teymourian.
<br />

#### Unfortunately can't share the code publicly, but if you'd like to see the code please reach out!
<br />

#### External Sort
Sorting a huge database that exceeds the capacity of RAM on the machine. My solution implements k-way merge, parallel/concurrent processing, and data processing pipelines. Ran on Google Cloud GCE. Sorted the [FOIL NYC Taxi Dataset](https://chriswhong.com/open-data/foil_nyc_taxi/).
<br />
<br />

#### Map Reduce
Implementing Map and Reduce over huge database. Map and Reduce run on 2 separate machines connected via socket connection. Ran on Google Cloud GCE. Foil NYC Taxi Dataset again.
<br />
<br />

#### Distributed MapReduce
Implementing MapReduce across five machines connected via sockets, with two mappers, two reducers, and a final aggregation node. Ran concurrent jobs to find the top earning hours and drivers using multithreading and batched data transfers. GCP
<br />
<br />

#### Hadoop MapReduce
Analyzing taxi data using Apache Hadoop. Implemented chained MapReduce jobs to count GPS errors by hour, identify taxis with the highest GPS error rates, and rank taxis by average speed. Used min-heaps for efficient top-K selection. Ran on a 3 machine Google Cloud cluster.
<br />
<br />

#### We also got to take a field trip to [TACC](https://tacc.utexas.edu/systems/horizon/)!!! (pictured)
<br />

<div style="display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 1rem; align-items: start;">
  <img src="/images/cc1.jpeg" alt="TACC field trip photo 1" style="display: block; width: 100%; height: auto; margin: 0;">
  <img src="/images/cc2.jpeg" alt="TACC field trip photo 2" style="display: block; width: 100%; height: auto; margin: 0;">
  <img src="/images/cc3.jpeg" alt="TACC field trip photo 3" style="display: block; width: 100%; height: auto; margin: 0;">
  <img src="/images/cc4.jpeg" alt="TACC field trip photo 4" style="grid-column: 1 / -1; display: block; width: 100%; height: auto; margin: 0;">
</div>
