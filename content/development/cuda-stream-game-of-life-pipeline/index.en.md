---
title: "A CUDA Stream Pipeline Demo with Conway's Game of Life"
date: 2026-04-12T00:00:00+09:00
draft: false
slug: "cuda-stream-game-of-life-pipeline"
translationKey: "cuda-stream-game-of-life-pipeline"
tags: ["CUDA", "GPU", "Nsight Systems", "Win32", "Optimization"]
---

{{< youtube NFx8BwnqQWM >}}
　    
`Conway's Game of Life` has simple rules, but it is still a good example for showing sync and async pipelines with `CUDA Stream`.

This code is an educational demo, not a build for the best possible performance. The goal is to show how **kernel execution**, **memory copies**, **CPU-side post-processing**, and **screen updates** can overlap when using `CUDA Stream`.

So, instead of fully separating simulation and rendering to keep the GPU busy for as long as possible, this demo uses each simulation generation as a screen frame too. That makes the difference between `Sync` and `Stream` easier to see.

## Sync Mode

`Sync` mode is the simplest serial structure.

1. Run `Compute #N`
2. When it finishes, run `Copy #N (Device to Host)`
3. When the copy finishes, run `ConvertGridToPixels()` on the CPU  
...

In other words, it copies one generation result, shows it on the screen, and only then moves to the next generation.

## Stream Mode

`Stream` mode splits the work into a `Compute Stream` and a `Copy Stream`, so the whole flow becomes a pipeline. (`Copy #N` and `Compute #(N + 1)` can run at the same time)

The flow is roughly like this.

1. First, enqueue only `Compute #1`
2. When `Compute #1` finishes, enqueue `Copy #1`
3. Then enqueue `Compute #2`
4. After that, repeat this order
   - Check if `Copy #N` is done
   - Swap the host buffer that was just copied into the current screen buffer
   - Enqueue `Copy #(N + 1)`
   - Swap the device buffers
   - Enqueue `Compute #(N + 2)`
   - Finally, run `ConvertGridToPixels()` on the CPU for the finished frame `#N`  
   ...

The key point is to enqueue the next copy and the next compute first, and then let the CPU process the previous frame.

So in `Stream` mode, copy work, compute work, and CPU work are not fully serial. Some parts overlap.

## Buffer Layout

Since this post is for explanation, I kept the structure as simple as possible.

- Device (GPU): `Current Grid`, `Next Grid`
- Host (CPU): `Current Grid`, `Next Grid`

The device side uses a normal ping-pong buffer. The host side also uses a double buffer, so while the CPU is processing one frame, it can still receive the next `Device to Host Copy`.

## A Small Trick

Instead of showing only simple black and white cell states, I made old positions slowly get darker on the screen.

The current cell value is used like this.

- `255`: Alive cell
- `0`: Fully off (dead) cell
- `1 ~ 254`: Trail brightness from an old position

I did not add a separate trail buffer. I used one grid value to store both the state and the trail. This also helps keep the copy size the same.

## NVTX and Nsight Systems

I added `NVTX` ranges so `Nsight Systems` can show not only CUDA work, but CPU work too.

With that, `Nsight Systems` can show the kernel, copy, CPU post-processing, and screen update together, including their order and timing.

## Summary

`CUDA Stream` is not just a simple async copy or launch feature. It is closer to a work queue model that describes the order of GPU work and what depends on what.

You can place independent work on different streams so they can run at the same time. By using that, you can overlap **kernel execution**, **memory copies**, and **CPU post-processing** as a pipeline.

This example is a small demo made to explain that structure, and you can find the code below.

[game_of_life_cuda.cu](https://gist.github.com/devjeonghwan/81fe3b526f958f32168f2d924e502672)
