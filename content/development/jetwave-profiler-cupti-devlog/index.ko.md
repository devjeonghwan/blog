---
title: "JETWAVE 프로파일러와 CUPTI 적용 후기"
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

회사에서 개발하고 있는 이기종 행렬 연산 프레임워크에 프로파일러를 하나 붙였습니다.

목표는 `NVIDIA Nsight Systems`처럼 CPU와 GPU에서 발생하는 작업을 한 화면에서 보고 싶었습니다.
다만 프레임워크가 CUDA만 직접 다루는 라이브러리가 아니라, CPU, CUDA 등 여러 종류의 디바이스를 같은 행렬 연산 모델 아래에서 다루는 프레임워크입니다.

따라서, 공통 프로파일링 모델을 구현하고 각 Backend에서 적합한 방법으로 프로파일 데이터를 수집한 뒤, Viewer 응용을 통해서 분석을 진행할 수 있도록 작업을 진행했습니다.

## CUDA Backend 지원을 위한 CUPTI 사용

CUDA 쪽 기록을 남기는 방법은 몇 가지가 있습니다.

가장 먼저 떠올릴 수 있는 것은 CUDA Event API입니다. 특정 Stream에 Event를 기록하고, Event 사이의 Elapsed Time을 계산하는 방식입니다.
커널 단위 측정이나 특정 구간 측정에는 충분히 쓸 수 있습니다.

하지만 이번에 원했던 것은 "내가 이 지점에서 Enqueue했다"가 아니라, CUDA Runtime이 실제로 어떤 Kernel과 Memcpy를 Stream 위에서 언제 실행했는지를 보고 싶었습니다.
또 나중에는 CUDA Runtime API 호출, Driver API 호출, Memcpy, Kernel 같은 여러 Activity를 같은 방식으로 수집할 수 있어야 했습니다.

하여간 이런 이유로 CUPTI Activity API를 사용했습니다.

CUPTI Activity API는 CUDA 내부에서 발생한 활동을 Record 형태로 모아서 넘겨줍니다. Kernel Activity, Memcpy Activity 같은 기록을 받을 수 있고,
각 Activity에는 시작 시간, 종료 시간, Stream, Device, Context, Correlation 관련 정보가 포함됩니다. Nsight 계열 도구도 이런 계층의 정보를 활용한다고 보면 됩니다.

다만 CUPTI는 프로파일러 라이브러리라기보다는 "CUDA가 남긴 저수준 Activity 기록을 받을 수 있는 인터페이스"에 가깝기 때문에 직접 붙여보니 생각보다 생각할 것이 많았습니다.