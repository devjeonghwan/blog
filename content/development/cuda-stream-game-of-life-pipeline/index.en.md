---
title: "A Simple CUDA Stream Pipeline Example with Conway's Game of Life"
date: 2026-04-12T00:00:00+09:00
draft: false
slug: "cuda-stream-game-of-life-pipeline"
translationKey: "cuda-stream-game-of-life-pipeline"
tags: ["CUDA", "GPU", "Nsight Systems", "Win32", "Optimization"]
---

{{< youtube NFx8BwnqQWM >}}
　    
`Conway's Game of Life` works with simple rules, but it is still a good example for explaining a synchronous and asynchronous pipeline with `CUDA Stream`.

This example is closer to an educational demo than an implementation designed for absolute peak performance. Its purpose is to show how `CUDA Stream` can hide the latency of **kernel execution**, **memory copies**, **CPU-side post-processing**, and **screen updates**.

For that reason, simulation steps and frame rendering are intentionally kept in a 1:1 relationship, prioritizing a structure that makes the difference between Sync and Stream more apparent over one that keeps the GPU busy for as long as possible.

## Sync Mode

`Sync` mode is the simplest serial structure.

1. `Kernel`
2. `Device to Host Copy`
3. `ConvertGridToPixels`
4. `Draw`

In other words, it finishes one frame first, then moves to the next frame.

## Stream Mode

`Stream` mode uses `CUDA Stream` and splits the work into a `compute stream` and a `copy stream`, so the whole flow becomes a pipeline.

The flow is like this.

1. (Initializing) Run `Compute #1`
2. (Bootstrapping) Run `Copy #1 + Compute #2`
3. (Steady State) After that  
   a. Check if `Copy #N` is done  
   b. Queue `Copy #(N + 1)` and `Compute #(N + 2)`  
   c. Convert the finished frame on the CPU

The key idea is simple. **Queue the next copy and the next compute work first, then let the CPU process the previous frame.**

## Buffer Layout

I kept the structure as simple as possible for explanation.

- Device (GPU): `Current Grid`, `Next Grid`
- Host (CPU): `Current Grid`, `Next Grid`

The device side uses a normal ping-pong buffer. The host side also uses two buffers, so while the CPU is processing one frame, it can still receive the next `Device to Host Copy`.

## A Small Trick

Instead of drawing only black and white cell states, I made old positions slowly get darker on the screen.

At first, I wanted to make the kernel more compute-bound, so the difference would look bigger, but.. ~~there was no big difference..~~

- `255`: Alive cell
- `0`: Fully off (dead) cell
- `1 ~ 254`: Trail brightness from an old position

I did not add a separate trail buffer. I used one grid value to store both the state and the trail, so the copy size does not grow.

## NVTX and Nsight Systems

I did not want this example to show only CUDA kernels, so I also added `NVTX` ranges to the CPU work.

Because of that, in `Nsight Systems`, you can see the kernel, copy, CPU post-processing, and screen update together, including their order and timing.

## Summary

`cudaStream` is not only a tool for asynchronous copy. It is closer to an API for defining a pipeline: how to overlap **GPU kernels**, **GPU copies**, and **CPU work**.

This example is a small one made to explain that structure, and you can find the code here..

[game_of_life_cuda.cu](https://gist.github.com/devjeonghwan/81fe3b526f958f32168f2d924e502672)