---
title: "최적화의 역설과 False Dependency"
date: 2025-12-22T00:00:00+09:00
draft: false
slug: "optimization-paradox-false-dependency"
translationKey: "optimization-paradox-false-dependency"
tags: ["C++", "Optimization", "SIMD", "CPU", "x86-64"]
---

## 발단

요즘 2025년 업무가 마무리 되어서 매우 한가한 새벽을 보내고 있는 와중, 페이스북에서 유영천님의 글을 보게 되었습니다.

```
오늘의 삽질.
float InvDet = 1.0f / Det라는 식이 있을 때
1.divss (수식 그대로)
2.rcpss (역수를 취하는 명령어를 사용)
3. rcpss+보정(rcpss의 정밀도가 낮으므로 뺄셈과 곱셉을 사용한 보정을 추가)
이 3가지 방법 중에 ai는 2번이 가장 빠르고,  성능과 정확도를 위해 3을 추천한다 했다.
결과는 1이 제일 빠르다. 심지어 rcpss도 divss와 거의 같거나 더 느렸다.  3은 많이 느렸다.
SIMD코드를 작성해달라고 AI한테 요청해보면 꽤 그럴싸한 코드를 만들어주고 설명도 그럴싸하다. 하지만 직접 돌려보고 성능을 측정해보면 놈이 보여준 코드는 결코 최적화된 코드가 아니다. 대개는 놈이 주장한 성능의 근거는 틀렸으며 결과적으로 빠르지도 않다.
AI의 주장이 맞았던 시절이 있었을 수도 있지만 CPU의 SIMD 기능은 아키텍처가 바뀔 때마다 성능이 계속 바뀌고 최적화 가이드라인도 바뀐다.
따라서 실제로 최적화된 코드를 넣고 싶으면 사람이 측정하고 튜닝해야한다.
```
[페이스북 링크](https://www.facebook.com/share/p/16K6rGbTvS/)

---

사실 직관적으로는 `DIVSS`가 당연히 `RCPSS`보다 느려야 한다고 생각이 들었습니다. 왜냐하면 `RCPSS`는 **Reciprocal(역수)** 을 구할때 비싼 나눗셈 연산을 사용하지 않도록 구현된 하드웨어 수준의 명령어니까요.

하지만, 유영천님의 말씀으로는 거의 비슷하거나 더 느렸다고 말씀을 하셨습니다. 또, 부족한 `RCPSS`의 정밀도를 채우기 위한 보정 연산을 추가하면 많이 느려졌다고 언급을 하셨습니다. (참고로 `RCPSS`는 역수에 근사한 값을 생성하며, 정확도가 12bit Mantissa입니다.)

* ***DIVSS:** Divide Scalar Single Precision Floating-Point Values, 스칼라 나눗셈
* ***RCPSS:** Compute Reciprocal of Scalar Single Precision Floating-Point Values, 스칼라 역수 계산

## 프로파일링

어차피 무료한 새벽시간, 유영천님 말씀이 맞는지(아마 맞겠지만) 왜 그런지를 살펴 보고자 실제 검증을 하고 원인을 분석하게 되었습니다.

### 기본 구현체

먼저 간단한 컴파일러 내장함수를 이용하여 C++ 벤치마크 코드를 작성했고, 두 명령어의 처리 시간을 측정해 보았습니다. 인텔 i9-13900KF 환경에서 테스트한 결과입니다.

```text
DIVSS : 1.652 cycles (total=6927580)
RCPSS : 2.215 cycles (total=9291130)
RCPSS_NR1 : 0.868 cycles (total=3641804)
RCPSS_NR2 : 1.492 cycles (total=6256057)
```

충격적이게도 유영천님의 말씀이 맞았습니다. 정밀도가 낮은 근사치를 구하는 하드웨어 명령어(`RCPSS`)가, 복잡한 나눗셈(`DIVSS`)보다 30% 이상 느린 결과가 나왔습니다.

또, `RCPSS_NR1`과 `RCPSS_NR2`의 벤치마크 결과와 `RCPSS`의 벤치마크 결과를 함께 보더라도 이상함을 감지할 수 있는데요, 정밀도를 올리기 위해서 추가적인 연산을 했음에도 아무것도 하지않은 `RCPSS`보다 빨라지는 기현상이 일어나고 있습니다.

Latency가 훨씬 짧은 명령어를 썼는데 Throughput이 떨어지는 상황. 도대체 왜 이런 **역설**이 발생한 걸까요?

* ***RCPSS_NR1:** `RCPSS`이후 Newton Raphson 방법론을 통한 보정(곱셈 + 뺄셈) 1회
* ***RCPSS_NR2:** 보정(곱셈 + 뺄셈)을 2회 진행하여 더욱 정밀하게 연산

원인을 파악하기 위해 생성된 어셈블리 코드를 뜯어보았습니다. MSVC 컴파일러가 생성한 `RCPSS` 루프는 다음과 같았습니다.

```asm
; ... Loop

; RCPSS 연산
rcpss xmm1, dword ptr [rcx+rdx]       ; XMM1에 결과를 저장
lea   rdx, [rdx+4]                    ; 포인터 이동

; 결과 Store
movss dword ptr [rdx-4], xmm1         ; XMM1을 결과 배열에 저장

; ... Loop
```

여기서 주목할 점은 `XMM1` 레지스터의 사용 방식입니다. `RCPSS` 명령어는 `XMM1` 레지스터의 **하위 32비트(float32 1개)** 만을 업데이트합니다. 얼핏 보면 효율적으로 보이지만, CPU 아키텍처 관점에서는 치명적인 딜레마가 발생합니다.

> **하위 32비트는 바꿀 건데, 나머지 상위 96비트는 이전 값을 그대로 유지해야 해.**

이 때문에 CPU는 **거짓 의존성(False Dependency)** 의 늪에 빠지게 됩니다. 이번 루프의 연산을 시작하려면, 상위 비트를 보존하기 위해 이전 루프의 XMM1 결과가 확정될 때까지 기다려야 하는 것입니다.

### 개선된(?) 구현체

그래서 이 문제를 해결하기 위해 CPU에게 **"이전 값은 필요 없어! 덮어써도 돼!"** 라고 알려줘야 합니다. 그래서 코드를 더 **길게** 수정했습니다. `MOVAPS` 등을 이용해 레지스터 전체를 초기화하는 과정을 추가한 것이죠.

마찬가지로, 어셈블리 작성을 피해서 컴파일러 내장함수 `_mm_setzero_ps()`와 `_mm_move_ss()`을 이용해 작업했습니다.

```asm
; XMM3 = 0 (루프 밖에서 미리 초기화)
; ... Loop

movss  xmm0, dword ptr [rcx+rdx]         ; 필요한 값 로드

; RCPSS 연산
movaps xmm2, xmm3                        ; XMM2을 0으로 덮어씀 (!! 의존성 제거 !!, zero-idiom)
lea    rdx, [rdx+4]                      ; 포인터 이동
movss  xmm2, xmm0                        ; XMM2에 필요한 값 로드
rcpss  xmm2, xmm2                        ; XMM2에 결과를 저장

; 결과 Store
movss dword ptr [rdx-4], xmm2            ; XMM2을 결과 배열에 저장

; ... Loop
```

명령어 라인 수는 분명 늘어났습니다. 하지만 결과는 놀라웠습니다.

```text
RCPSS (최적화 전): 2.215 cycles
RCPSS (최적화 후): 0.673 cycles (약 3.3배 향상)
```

명령어 수가 늘어났는데 속도는 3배가 빨라졌습니다.

레지스터 전체를 덮어쓰는 순간, 현대 CPU는 **Register Renaming(레지스터 리네이밍)** 을 활용해 루프 간의 의존성을 끊어버립니다. 덕분에 강력한 **Out-of-Order Execution(비순차 실행)** 이 적극 개입하여 병렬 처리를 시작한 것 입니다.

## 검증

제 생각이 맞는지 확인하기 위해 Intel VTune Profiler로 파이프라인을 분석해 보았습니다.

```text
1. 최적화 전
Microarchitecture Usage       : 6.2% of Pipeline Slots
    Front-End Bound           : 11.3%
    Core Bound                : 69.3%
    Memory Bound              : 1.9%
    Back-End Bound Auxiliary  : 71.2%
    ...
    Serializing Operations    : 23.1%
    ...

2. 최적화 후
Microarchitecture Usage       : 25.6% of Pipeline Slots
    Front-End Bound           : 0.0%
    Core Bound                : 26.4%
    Memory Bound              : 5.1%
    Back-End Bound Auxiliary  : 31.5%
    ...
    Serializing Operations    : 6.0%
    ...
```

먼저, 최적화 전 지표를 살펴보면 **Serializing Operations** 항목이 **23.1%** 를 점유하고 있습니다. 파이프라인의 1/4이 의존성 때문에 Stall 되어있다는 의미입니다. 반면 최적화 후 지표의 같은 항목을 살펴보면, 역시 예상과 동일하게 **6.0%** 라는 낮은 수치를 점유하고 있습니다.

따라서, 병목이 해소되면서 **Microarchitecture Usage(파이프라인 효율)** 이 **6.2%에서 25.6%으로 4배** 이상 개선된 것입니다.

## 오늘의 결론

1. 역시 AI는 "이론상" 최적화만 주저리 주저리..
2. 하드웨어 마다 정답도 바뀌니, AI 맹신하지 말고 사람이 직접 찍먹 해보고 깎아야함
3. 컴파일러는 생각보다 덜 똑똑했다..
4. 참고로 NR1, NR2 쪽이 더 빠른 이유는 NR 연산을 위해서 사용한 FMA 등으로 인해서 우연히 의존성이 끊겼다는..
5. AVX류는 3-Operand라 이런 문제가 없습니다.

밴치 마크 코드는 이곳에서..

[DIVSS/PS vs RCPSS/PS with Remove False Dependency](https://gist.github.com/devjeonghwan/b016c2138995d349ccab5843f00ee4e2)