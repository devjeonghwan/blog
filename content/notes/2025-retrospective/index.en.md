---
title: "2025 Retrospective"
date: 2025-12-24T00:00:00+09:00
draft: false
slug: "2025-retrospective"
translationKey: "2025-retrospective"
tags: ["Retrospective"]
---

The year 2025 felt like it passed faster than any other.
I'll simply list up the my projects and work.

## Open Source Projects

- **OpenJDK JExtract:** Fix incorrect base offset handling in generated array field accessors
  - [PR](https://github.com/openjdk/jextract/pull/294)
- **FFmpeg AVFormat:** Fix allow other chunks between `fcTL` and `fdAT`/`IDAT`
  - [PR #1](https://code.ffmpeg.org/FFmpeg/FFmpeg/pulls/20140)
  - [PR #2](https://code.ffmpeg.org/FFmpeg/FFmpeg/pulls/20208)
- **x64dbg:** Update heap enumeration in Windows 11 24H2
  - [Report](https://cafe.naver.com/megayuchi/683)
  - [PR](https://github.com/x64dbg/x64dbg/pull/3478)
- **javacpp:** Introduce `NativeAllocationTracer` for tracking native memory allocation sites
  - [PR #1](https://github.com/bytedeco/javacpp/pull/815)
  - [PR #2](https://github.com/bytedeco/javacpp/pull/816)
- **javacpp:** Add support for `windows-arm64`
  - [PR #1](https://github.com/bytedeco/javacpp/pull/813)
  - [CI PR #2](https://github.com/bytedeco/javacpp-presets/pull/1653)
  - [CI PR #3](https://github.com/bytedeco/javacpp-presets/pull/1660)
- **javacpp-presets:** Add `windows-arm64` builds to presets for LLVM 
  - [PR #1](https://github.com/bytedeco/javacpp-presets/pull/1656)
- **javacpp-presets:** Add `windows-arm64` builds to presets for systems
  - [PR #1](https://github.com/bytedeco/javacpp-presets/pull/1659)
- **javacpp-presets:** Add `linux-arm64` platform support to ONNX build and CI
  - [PR #1](https://github.com/bytedeco/javacpp-presets/pull/1697)

## Work Projects

- Enhancement of a matrix computation framework
  - Introduced incremental builds with CMake
  - Added support for NVIDIA unified memory models (including Jetson)
  - Expanded SIMD support
  - Migrated to a reference-count–based memory management model
  - Strengthened CD/CI pipelines
  - Performance optimization work
- Development of a software anti-piracy solution
  - Firmware development
  - C API and Java API development
  - Development of provisioning tools
- Maintenance, enhancement, and support for solutions related to SK Hynix
- Development of an internal weekly report generator  
(GitHub data collection and summarization using OpenAI)
- Development of an internal meeting minutes generator  
(Speech recognition using Clova Speech and summarization using OpenAI)
- Participation in management and initial design of an SNN compiler project
- Company website renewal

## Personal Projects

- Development of a remote monitoring and maintenance report generation system for an elevator manufacturer
- **Started a blog!**