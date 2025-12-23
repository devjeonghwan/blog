---
title: "DPPS가 생각보다 느리다"
date: 2025-12-24T00:00:00+09:00
draft: false
slug: "dpps-slower-than-i-thought"
translationKey: "dpps-slower-than-i-thought"
tags: ["C++", "Optimization", "SIMD", "CPU"]
---

크리스마스이브인 오늘, 제가 겪었던 일들을 가볍게 기록하고자 이 글을 작성합니다.

## 발단

이번에도 유영천 님이 새로운 흥미로운 주제를 던져 주셨습니다. 컴파일러가 최적화한 코드를 손으로 작성한 코드로 성능 면에서 이겨보는 내용이었습니다.

주제에 관한 내용은 이 글에서 하고자 하는 내용과는 조금 다른 이야기라서 궁금한 사람은 아래 전문을 보시기를 바랍니다.

<details>
<summary>글 전문 보기 (장문 주의)  </summary>

> 유영천님 글  

**12월 23일 저녁 방송에서 언급한 어셈 vs Compiler Intrinsic 코드**

TestSIMD_ASM_2025_1223_megayuchi.zip

궁금하신 분들은 받아서 돌려보세요.

병목 포인트 잡아서 컴파일러 이기면 후기 꼭 남겨주시기 바랍니다.

--- 
> 내 글

**컴파일러 인트린식을 활용한 최적화 시도**

```cpp
__m128 CrossProduct_SIMD_New(const __m128* pU, const __m128* pV)
{
    __m128 u = *pU;
    __m128 v = *pV;

    __m128 u_yzx = _mm_permute_ps(u, _MM_SHUFFLE(3, 0, 2, 1));
    __m128 v_zxy = _mm_permute_ps(v, _MM_SHUFFLE(3, 1, 0, 2));

    __m128 u_zxy = _mm_permute_ps(u, _MM_SHUFFLE(3, 1, 0, 2));
    __m128 v_yzx = _mm_permute_ps(v, _MM_SHUFFLE(3, 0, 2, 1));

    __m128 result = _mm_fmsub_ps(u_yzx, v_zxy, _mm_mul_ps(u_zxy, v_yzx));

    return result;
}

inline float DotProduct_SIMD_New(const __m128 a, const __m128 b)
{
    __m128 product = _mm_mul_ps(a, b);
    __m128 shuffle1 = _mm_shuffle_ps(product, product, _MM_SHUFFLE(2, 3, 0, 1));
    __m128 sum = _mm_add_ps(product, shuffle1);
    __m128 shuffle2 = _mm_shuffle_ps(sum, sum, _MM_SHUFFLE(1, 0, 3, 2));
    __m128 result = _mm_add_ps(sum, shuffle2);

    return _mm_cvtss_f32(result);
}

inline __m128 LoadVector3(const VECTOR3* p)
{
    __m128 xy = _mm_castpd_ps(_mm_load_sd((const double*)p));
    __m128 z = _mm_load_ss(&p->z);
    __m128 result = _mm_movelh_ps(xy, z);
    return result;
}

BOOL IntersectTriangle_SIMD_New(VECTOR3* pv3OutIntersectPoint, const VECTOR3* pv3Orig, const VECTOR3* pv3Dir, const VECTOR3* pV0, const VECTOR3* pV1, const VECTOR3* pV2, float* pfOutT, float* pfOutU, float* pfOutV, BOOL bCullBackface)
{
    BOOL		bResult = FALSE;

    __m128 orig = LoadVector3(pv3Orig);
    __m128 dir = LoadVector3(pv3Dir);
    __m128 v0 = LoadVector3(pV0);
    __m128 v1 = LoadVector3(pV1);
    __m128 v2 = LoadVector3(pV2);

    __m128 edge1 = _mm_sub_ps(v1, v0);
    __m128 edge2 = _mm_sub_ps(v2, v0);

    __m128 pvec = CrossProduct_SIMD_New(&dir, &edge2);

    float det = DotProduct_SIMD_New(edge1, pvec);

    __m128 tvec;
    if (det > 0)
    {
        tvec = _mm_sub_ps(orig, v0);
    }
    else
    {
        if (bCullBackface)
            goto lb_return;

        tvec = _mm_sub_ps(v0, orig);
        det = -det;
    }

    if (det < 0.0001f)
        goto lb_return;

    float u = DotProduct_SIMD_New(tvec, pvec);

    if (u < 0.0f || u > det)
        goto lb_return;

    __m128 qvec = CrossProduct_SIMD_New(&tvec, &edge1);

    float v = DotProduct_SIMD_New(dir, qvec);

    if (v < 0.0f || (u + v) > det)
        goto lb_return;

    float t = DotProduct_SIMD_New(edge2, qvec);

    float InvDet = 1.0f / det;

    *pfOutT = t * InvDet;
    *pfOutU = u * InvDet;
    *pfOutV = v * InvDet;

    if (pv3OutIntersectPoint)
    {
        __m128 vec_u = _mm_set1_ps(*pfOutU);
        __m128 vec_v = _mm_set1_ps(*pfOutV);

        __m128 temp = _mm_fmadd_ps(edge1, vec_u, v0);
        __m128 result = _mm_fmadd_ps(edge2, vec_v, temp);

        _mm_store_sd((double*)pv3OutIntersectPoint, _mm_castps_pd(result));
        __m128 vec_z = _mm_movehl_ps(result, result);
        _mm_store_ss(&pv3OutIntersectPoint->z, vec_z);
    }

    bResult = TRUE;
lb_return:
    return bResult;
}
```

기존 영천님 코드 스타일을 최대한 유지해서 작성했습니다.

1. VECTOR3 로드 방식을 `_mm_loadl_pi`에서 `_mm_load_sd` + `_mm_castpd_ps` 방식으로 변경
2. 알 수 없는 이유로 성능이 안나오는 `_mm_dp_ps`대신 `shuffle` + `mul` + `add` 기반의 Dot Product 구현으로 변경
3. Dot Product가 애초에 스칼라를 반환하도록 하여 레지스터 압박 감소 및 컴파일러 최적화 유도
4. Shuffle 대신 Permute 을 활용하고, FMA를 사용하도록 Cross Product 구현 변경
5. 전반적인 FMA 도입

```
CrossProductvecNormal : R(5138540.5000, -5269049344.0000, -14367190.0000), 52.4448 clks elapsed.
CrossProduct_SIMD_New : R(5138540.5000, -5269049344.0000, -14367189.0000), 4.0860 clks elapsed.
CrossProduct_SIMD : R(5138540.5000, -5269049344.0000, -14367190.0000), 4.5244 clks elapsed.
CrossProductvecSSE_ASM : R(5138540.5000, -5269049344.0000, -14367190.0000), 4.7296 clks elapsed.
CrossProductvecAVX_ASM : R(5138540.5000, -5269049344.0000, -14367190.0000), 4.7322 clks elapsed.
-----------------------------------------------------------------------------------------------------
IntersectTriangle_Normal : P(2596.2,-2400.0,-361.6)[10000], 17.1430 clks elapsed.
IntersectTriangle_SIMD_New : P(2596.2,-2400.0,-361.6)[10000], 13.9778 clks elapsed.
IntersectTriangle_SIMD : P(2596.2,-2400.0,-361.6)[10000], 20.7588 clks elapsed.
IntersectResult_AVX_ASM : P(2596.2,-2400.0,-361.6)[10000], 39.6864 clks elapsed.
-----------------------------------------------------------------------------------------------------
```

기존 SIMD 코드 기준으로는 `4.52` 에서 `4.08` 으로, `32.7` 에서 `22.79` 로

Scalar C 코드 기준으로는 `17.14` 에서 `13.97` 로 개선되었습니다.

더 나은 구현이 있으면 서로 공유, 비교해보면 좋을 듯 합니다.

</details>  

---

하여튼, 주어진 **삼각형 교차 검사** SIMD 코드를 열심히 손으로 깎고 있는 와중에 제가 알고 있던 내용과는 약간 의외의 상황을 마주하게 되었습니다.

바로 삼각형 교차 검사 내에서 사용되는 **Dot Product(내적)** 에  `_mm_dp_ps(DPPS)`, `__mm256_dp_ps(VDPPS)`를 적용해도 생각보다 전체 성능이 증가하지 않는 것이었습니다.

* ***DPPS:** Dot Product of Packed Single Precision Floating-Point Values

이 녀석들은 명령어 이름 자체에 Dot Product가 있듯이 하나의 벡터에 대한 Dot Product 연산을 구현하는 데에 표준적으로 많이 사용되고 있기 때문에, 구글 검색을 해봐도 이 명령어를 이용하는 코드를 어렵지 않게 볼 수 있습니다.

저도 자주 사용하지는 않지만, 익히 알고 있는 명령어이기에 사용을 한 것이었는데, 이상하다고 생각되어 별도의 벤치마크를 작성해서 테스트를 해보기로 했습니다.

## 벤치마크

### Scalar Dot Product 구현

```cpp
static void DOT_C_SCALAR(const float* a, const float* b, float* c, size_t n)
{
    for (size_t i = 0; i < n; ++i)
    {
        size_t offset = i * 4;
        c[i] = a[offset + 0] * b[offset + 0] + 
               a[offset + 1] * b[offset + 1] + 
               a[offset + 2] * b[offset + 2] + 
               a[offset + 3] * b[offset + 3];
    }
}
```

### DPPS를 이용한 Dot Product 구현

```cpp
static void DOT_SSE_DPPS(const float* a, const float* b, float* c, size_t n)
{
    for (size_t i = 0; i < n; ++i)
    {
        size_t offset = i * 4;
        __m128 vecA = _mm_load_ps(a + offset);
        __m128 vecB = _mm_load_ps(b + offset);

        __m128 result = _mm_dp_ps(vecA, vecB, 0xF1);

        _mm_store_ss(c + i, result);
    }
}
```

물론 Scalar 형태로만 작성해도 요즘의 컴파일러는 잘 최적화하겠지만, 그래도 Dot Product에 해당하는 명령어를 사용한 측이 더 빠를 것 이라는 기대를 하고 테스트를 해보았습니다.

### 벤치마크 결과

```
DOT_C_SCALAR         : 1.789 cycles/vec (total=60043980)
DOT_SSE_DPPS         : 2.918 cycles/vec (total=97899934)
```

그런데.. 이런! 이상하게 `DPPS` 쪽 코드가 심각하게 느린 것을 확인하게 되었습니다. 그것도 무려 **1.63배** 입니다. _(사실 워낙 코드 길이가 짧아서 컴파일러 최적화가 개입할 여지가 크지 않다고 판단했었기에 더욱 어처구니가 없었습니다)_

## `DPPS`를 사용하지 않는 구현

혹시 `DPPS`가 모종의 이유로 최신 아키텍처에서는 느려진 건가 싶어, 다른 명령어들을 이용해 구현해 보았습니다.

### A안: `MULPS` + `HADDPS`를 이용한 구현

```cpp
static void DOT_SSE_HADD(const float* a, const float* b, float* c, size_t n)
{
    for (size_t i = 0; i < n; ++i)
    {
        size_t offset = i * 4;
        __m128 vecA = _mm_load_ps(a + offset);
        __m128 vecB = _mm_load_ps(b + offset);

        __m128 product = _mm_mul_ps(vecA, vecB);
        __m128 hadd1 = _mm_hadd_ps(product, product);
        __m128 hadd2 = _mm_hadd_ps(hadd1, hadd1);

        _mm_store_ss(c + i, hadd2);
    }
}
```

먼저, 이 구현은 두 벡터의 모든 성분을 `_mm_mul_ps(MULPS)`를 통해 서로 곱한 뒤 그 결과를 `_mm_hadd_ps(HADDPS)`를 통해 수평적으로 더하여 합치는 코드입니다.

### B안: `MULPS` + `ADDPS` + `SHUFPS`를 이용한 구현

```cpp
static void DOT_SSE_SHUFFLE(const float* a, const float* b, float* c, size_t n)
{
    for (size_t i = 0; i < n; ++i)
    {
        size_t offset = i * 4;
        __m128 vecA = _mm_load_ps(a + offset);
        __m128 vecB = _mm_load_ps(b + offset);

        __m128 product = _mm_mul_ps(vecA, vecB);

        __m128 shuffle1 = _mm_shuffle_ps(product, product, _MM_SHUFFLE(2, 3, 0, 1));
        __m128 sum1 = _mm_add_ps(product, shuffle1);

        __m128 shuffle2 = _mm_shuffle_ps(sum1, sum1, _MM_SHUFFLE(1, 0, 3, 2));
        __m128 sum2 = _mm_add_ps(sum1, shuffle2);

        _mm_store_ss(c + i, sum2);
    }
}
```

이 구현은 두 벡터를 곱하는 것까지는 동일하지만, 결과를 더하는 과정에서 `_mm_hadd_ps(HADDPS)` 대신 `_mm_shuffle_ps(SHUFPS)`와 `_mm_add_ps(ADDPS)`를 조합해 구현하고 있습니다.

### 벤치마크 결과

```
DOT_C_SCALAR         : 2.046 cycles/vec (total=68649165)
DOT_SSE_DPPS         : 3.042 cycles/vec (total=102065815)
DOT_SSE_HADD         : 2.253 cycles/vec (total=75604884)
DOT_SSE_SHUFFLE      : 1.240 cycles/vec (total=41596493)
```

예상했던 것처럼 `DPPS` 보다 **A안**과 **B안** 구현이 더 빠른 것을 볼 수 있습니다.

> 잠깐, `A안, HADDPS` 구현보다 `B안, ADDPS + SHUFPS` 구현이 왜 더 빠른가요?

왜냐하면 수평 덧셈 연산인 `HADDPS` 대신, CPU 포트 제약이 상대적으로 적은 `SHUFPS`(재배치)와 `ADDPS`(일반 덧셈)로 조합해 구현하게 되면, 수평 연산 병목(낮은 Throughput, 스케줄링 자유도 부족)을 줄이고, 전체 루프 관점에서 더 높은 처리량을 얻을 가능성이 커집니다.

> 실제로 `HADDPS`의 Latency는 7, CPI는 2이며, `SHUFPS`와 `ADDPS`는 각각 Latency는 1, 4, CPI는 0.5, 0.5입니다.

그래서 벤치마크에 사용되는 벡터 크기를 1로 줄이게 되면, 전체 루프 관점에서의 이점이 사라져 아래와 같은 결과를 확인할 수 있습니다.

```
DOT_SSE_HADD         : 3.318 cycles/vec (total=6796)
DOT_SSE_SHUFFLE      : 3.854 cycles/vec (total=7892)
```

## 그래서 `DPPS` 가 왜 더 느린 걸까?

정확한 내부 구현은 공개되어 있지 않기 때문에, Intel 엔지니어가 아니고서야 딱 어떻다고 말하기는 어렵습니다. 하지만 예상해 보자면

1. `DPPS`는 `imm8`을 통해서 어떤 Lane을 연산하고(상위 4비트) 어떤 Lane에 기록할지(하위 4비트)를 결정할 수 있는데 이것이 하드웨어 비용을 발생시킨다.
2. `DPPS`가 내부적으로 수평 연산을 포함하고, 특정 포트 의존성이 있어 명령어 수준 병렬성(ILP)을 확보하기 어렵다. (`A안, HADDPS` vs `B안, ADDPS + SHUFPS` 문제와 본질적으로 유사)

정도가 아닐까 싶습니다. 만약 알고 계신 분이 있다면 댓글 남겨주시면 감사하겠습니다.

## 결론

뭔가 싱겁게 마무리되는 감이 없지 않아 있지만, 제 능력의 한계가 여기까지이므로 어쩔 수 없네요.

제가 회사에서 주로 개발하고 있는 **N차원 행렬 연산 프레임워크** 도 그렇고, AI 분야에서도 Dot Product는 벡터가 연속적으로 존재하는 배치 연산 상황을 가정하기 때문에, `FMA` 후 `Scalar Reduce`를 하는 패턴을 자주 이용합니다.

그래서, `DPPS` 명령어를 알고는 있었지만 주로 사용하지는 않아서 잘 몰랐던 사실과 문제들을 이것저것 탐구해 보게 되어 뜻깊은 시간이었던 것 같습니다.

_연말엔 역시 마이크로아키텍처 튜-닝_