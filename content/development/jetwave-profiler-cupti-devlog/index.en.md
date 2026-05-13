---
title: "JETWAVE Profiler and CUPTI Integration Notes"
date: 2026-05-14T00:00:00+09:00
draft: false
slug: "jetwave-profiler-cupti-devlog"
translationKey: "jetwave-profiler-cupti-devlog"
tags: [ "JETWAVE", "Profiler", "CUPTI", "CUDA", "CPU", "Development" ]
---

{{< figure
    src="capture.png"
    alt="JETWAVE Profile Viewer"
    align="center"
>}}

I added a profiler to the heterogeneous matrix computation framework we are developing at work.

The goal was to see CPU and GPU work in a single view, similar to `NVIDIA Nsight Systems`.
However, the framework is not a library that only deals directly with CUDA. It handles several kinds of devices, including CPU and CUDA, under the same matrix computation model.

So I implemented a common profiling model, collected profiling data in a backend-appropriate way, and made it possible to analyze the result through a viewer application.

## Using CUPTI for CUDA Backend Support

There are several ways to record CUDA-side activity.

The first thing that comes to mind is the CUDA Event API. This records events on a specific stream and calculates the elapsed time between those events.
It is good enough for measuring a kernel or a specific section.

What I wanted this time, however, was not simply "I enqueued something at this point." I wanted to see which kernels and memcpy operations the CUDA Runtime actually executed on a stream, and when.
Also, later on, I wanted to be able to collect CUDA Runtime API calls, Driver API calls, memcpy, kernels, and other activities in the same way.

For these reasons, I used the CUPTI Activity API.

The CUPTI Activity API collects activities that occur inside CUDA and returns them as records. It can provide records such as Kernel Activity and Memcpy Activity,
and each activity contains information such as start time, end time, stream, device, context, and correlation data. Nsight tools can be thought of as using information from this layer as well.

That said, CUPTI is closer to an interface for receiving low-level activity records left by CUDA than to a ready-to-use profiler library. After integrating it directly, there turned out to be more things to think about than I initially expected.
