---
title: "Conway's Game of Life로 보는 교육 용 CUDA Stream 파이프라인 예제"
date: 2026-04-12T00:00:00+09:00
draft: false
slug: "cuda-stream-game-of-life-pipeline"
translationKey: "cuda-stream-game-of-life-pipeline"
tags: ["CUDA", "GPU", "Nsight Systems", "Win32", "Optimization"]
---

{{< youtube NFx8BwnqQWM >}}
　  
`Conway's Game of Life`는 단순한 규칙으로 동작하지만, `CUDA Stream`의 동기/비동기 파이프라인 구조를 설명하기에는 꽤 적합한 예제입니다.

이번 코드는 어디까지나 **교육용 예제** 수준으로 정리한 구현이므로, 복잡한 렌더링 구조나 대규모 엔진보다는, 아래와 같은 흐름을 명확하게 보여주는 데 초점을 두었습니다.

- GPU Compute
- Device to Host Copy
- CPU 후처리
- 화면 갱신

이번 예제에서는 `CUDA Runtime API`와 프로파일링 힌팅을 위해 `NVTX`, 그리고 UI 렌더링을 위한 `Win32 API`, `GDI`를 사용했습니다.

예제는 `M`키를 통해 `Sync` 모드와, `Stream` 모드를 스위칭 할 수 있습니다.

## Sync 모드

`Sync` 모드는 가장 단순한 직렬 구조입니다.

1. `Kernel`
2. `Device to Host Copy`
3. `ConvertGridToPixels`
4. `Draw`

즉, 한 프레임을 끝까지 처리한 뒤 다음 프레임으로 넘어갑니다.

## Stream 모드

`Stream` 모드는 `CUDA Stream`을 사용하여 `compute stream`과 `copy stream`을 분리해 파이프라인 형태로 구성되어 있습니다.

흐름은 다음과 같습니다.

1. `Compute #1` 실행
2. `Copy #1 + Compute #2` 실행
3. 이후 파이프라인 진행  
   a. `Copy #N` 완료 확인  
   b. `Copy #(N + 1)` 및 `Compute #(N + 2)` Enqueue  
   c. 완료된 프레임을 CPU에서 변환

즉 핵심은, **다음 복사와 다음 계산을 CUDA Stream에 먼저 걸어 둔 뒤 CPU가 이전 프레임을 처리하도록 만드는 것**입니다.

## 버퍼 구성

구조는 설명용으로 최대한 단순하게 유지했습니다.

- Device(GPU): `Current Grid`, `Next Grid`
- Host(CPU): `Current Grid`, `Next Grid`

Device 쪽은 일반적인 Ping-Pong Buffer이고, Host 쪽도 2-Buffer로 두어 CPU가 한 프레임을 처리하는 동안 다음 `Device to Host Copy`를 받을 수 있도록 구성했습니다.

## 약간(?)의 기믹

화면은 흑백 셀 상태만 출력하는 대신, 과거 위치가 서서히 어두워지도록 표현했습니다.

원래는 Kernel의 Compute Bound를 늘려서 극적인 비교를 하고 싶었으나.. ~~차이는 없었습니다..~~

- `255`: 살아있는 셀
- `0`: 완전히 꺼진(죽은) 셀
- `1 ~ 254`: 과거 위치의 잔상 밝기

별도의 Trail 전용 버퍼를 두지 않고, 기존 Grid 값 하나로 상태와 잔상을 함께 표현하도록 구성했습니다. (복사 크기를 늘리지 않기 위해)

## NVTX와 Nsight Systems

단순히 CUDA 커널만 보는 용도에 그치지 않도록, CPU 작업에도 `NVTX` Range를 추가했습니다.

이렇게 하면 `Nsight Systems`에서 커널, 복사, CPU 후처리, 화면 갱신이 어떤 순서와 간격으로 실행되는지 함께 확인할 수 있습니다.

## 정리

`cudaStream`은 단순히 비동기 복사 또는 처리를 위한 기능이라기보다, **GPU Kernel**과 **GPU Copy** 그리고 **CPU 작업**을 어떻게 겹쳐서 처리할 것인가, 파이프라인을 정의하는 API에 가깝습니다.

이번 예제는 그 구조를 설명하기 위한 작은 예제이며 코드는 이곳에서..

[game_of_life_cuda.cu](https://gist.github.com/devjeonghwan/81fe3b526f958f32168f2d924e502672)
