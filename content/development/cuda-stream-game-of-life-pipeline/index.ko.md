---
title: "Conway's Game of Life로 보는 교육용 CUDA Stream 파이프라인 예제"
date: 2026-04-12T00:00:00+09:00
draft: false
slug: "cuda-stream-game-of-life-pipeline"
translationKey: "cuda-stream-game-of-life-pipeline"
tags: ["CUDA", "GPU", "Nsight Systems", "Win32", "Optimization"]
---

{{< youtube NFx8BwnqQWM >}}
　  
`Conway's Game of Life`는 규칙 자체는 단순하지만, `CUDA Stream`을 이용한 동기/비동기 파이프라인 구조를 설명하기에는 꽤 좋은 예제입니다.

이번 코드는 절대적인 최고 성능을 목표로 한 구현이라기보다, `CUDA Stream`을 사용할 때 **커널 실행**, **메모리 복사**, **CPU 측 후처리**, **화면 갱신**이 어떤 식으로 겹칠 수 있는지를 보여주기 위한 교육용 데모에 가깝습니다.

따라서, 시뮬레이션과 렌더링을 완전히 분리해 GPU를 최대한 오래 바쁘게 유지하는 구조보다는, 각 시뮬레이션 세대를 화면 프레임으로도 소비하도록 구성해 `Sync`와 `Stream`의 차이가 비교적 직관적으로 드러나도록 했습니다.

## Sync 모드

{{< figure
    src="sync.png"
    alt="Sync Nsight Systems"
    caption="`Compute`, `Copy`, `CPU 작업` 등이 직렬로 처리되는 모습"
    align="center"
>}}

`Sync` 모드는 가장 단순한 직렬 구조입니다.

1. `Compute #N`을 수행
2. 계산이 끝나면 `Copy #N (Device to Host)`를 수행
3. 복사가 끝나면 CPU에서 `ConvertGridToPixels()`를 수행  
...

즉, 한 세대 계산 결과를 복사하고 화면에 반영한 뒤에야 다음 세대로 넘어가는 방식입니다.

## Stream 모드

{{< figure
    src="stream.png"
    alt="Stream Nsight Systems"
    caption="`Copy`와 `Kernel`, `CPU 작업`이 겹쳐서 처리되는 모습"
    align="center"
>}}

`Stream` 모드는 `Compute Stream`과 `Copy Stream`을 분리해 파이프라인 형태로 구성했습니다. (`Copy #N`과 `Compute #(N + 1)`이 겹쳐 실행될 수 있음)

흐름은 대략 다음과 같습니다.

1. 먼저 `Compute #1`만 enqueue
2. `Compute #1`이 끝나면 `Copy #1`을 enqueue
3. 이어서 `Compute #2`를 enqueue
4. 이후에는 다음 순서를 반복
   - `Copy #N` 완료 확인
   - 방금 복사된 Host Buffer를 현재 화면용 Buffer로 교체
   - 이어서 `Copy #(N + 1)`을 enqueue
   - Device Buffer를 교체
   - 이어서 `Compute #(N + 2)`를 enqueue
   - 마지막으로, 방금 완료된 프레임 `#N`에 대해 CPU에서 `ConvertGridToPixels()`를 수행  
   ...

핵심은, 다음 복사와 다음 계산을 먼저 enqueue해 두고 CPU가 이전 프레임을 처리하도록 만드는 데 있습니다.

즉 `Stream` 모드에서는 복사, 계산, CPU 작업이 완전히 직렬로 이어지지 않고 일부 구간이 겹치게 됩니다.

## 버퍼 구성

설명용 예제인 만큼 구조는 최대한 단순하게 유지했습니다.

- Device(GPU): `Current Grid`, `Next Grid`
- Host(CPU): `Current Grid`, `Next Grid`

Device 쪽은 일반적인 Ping-Pong Buffer이고, Host 쪽도 Double Buffer를 두어 CPU가 한 프레임을 처리하는 동안 다음 `Device to Host Copy`를 받을 수 있도록 했습니다.

## 약간의 기믹(?)

화면은 단순한 흑백 셀 상태만 출력하는 대신, 과거 위치가 서서히 어두워지도록 표현했습니다.

현재 셀 값은 다음처럼 사용합니다.

- `255`: 살아있는 셀
- `0`: 완전히 꺼진 셀
- `1 ~ 254`: 과거 위치의 잔상 밝기

별도의 Trail 전용 버퍼를 두지 않고, 기존 Grid 값 하나로 상태와 잔상을 함께 표현하도록 구성했습니다. 복사 크기를 늘리지 않기 위한 선택이기도 합니다.

## NVTX와 Nsight Systems

`Nsight Systems`를 통해 CUDA 작업 뿐 아니라, CPU 작업도 확인할 수 있도록 `NVTX`을 활용하여 Range를 추가했습니다.

이렇게 해 두면 `Nsight Systems`에서 커널, 복사, CPU 후처리, 화면 갱신이 어떤 순서와 간격으로 실행되는지 함께 확인할 수 있습니다.

## 정리

`CUDA Stream`은 단순한 비동기 복사/실행 기능이라기보다, GPU 작업의 실행 순서와 의존성을 표현하는 작업 큐 모델에 가깝습니다.

서로 독립적인 작업을 다른 Stream에 배치하여 동시에 실행되게 할 수 있고, 이를 이용해 **Kernel 실행**, **메모리 복사**, **CPU 후처리**를 겹치도록 구성하면 파이프라인 형태의 최적화가 가능합니다.

이번 예제는 그 구조를 설명하기 위한 작은 데모이며, 코드는 아래에서 확인할 수 있습니다..

[game_of_life_cuda.cu](https://gist.github.com/devjeonghwan/81fe3b526f958f32168f2d924e502672)
