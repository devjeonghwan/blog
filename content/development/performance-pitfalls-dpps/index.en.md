---
title: "The Performance Pitfalls of DPPS"
date: 2025-12-24T00:00:00+09:00
draft: false
slug: "performance-pitfalls-dpps"
translationKey: "performance-pitfalls-dpps"
tags: ["C++", "Optimization", "SIMD", "CPU", "x86-64"]
---

On this Christmas Eve, I am writing this post just to simply record some of the things I experienced

## Background

Once again, **Yeong-Cheon You** introduced an interesting challenge that "Try to hand optimize the code to outperform the compiler optimized version."

This post doesn't go into the details of the challenge, so feel free to check the full version below if you're interested.

<details>
<summary>See full version</summary>

> Yeong-Cheon You's Post  

**Assembly vs Compiler Intrinsic Code mentioned in the Dec 23 night broadcast**

TestSIMD_ASM_2025_1223_megayuchi.zip

Please download it and try running it if you're interested.

If you find any bottlenecks and beat the compiler, please share your results here.

--- 
> My Post

**Optimization attempt using compiler intrinsics**

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

I maintained Yeong-Cheon You's original code style.

1. Changed the `VECTOR3` load from `_mm_loadl_pi` to `_mm_load_sd` + `_mm_castpd_ps`
2. Reimplemented the dot product using a `shuffle` + `mul` + `add` sequence instead of `_mm_dp_ps` which showed unexpectedly poor performance
3. Modified the dot product to return a scalar directly, reducing register pressure and encouraging better compiler optimization
4. Reimplemented the cross product using `permute` instead of `shuffle`, and applied `FMA` instructions
5. Apply `FMA` globally

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

Compared to the original SIMD implementation, performance improved from `4.52` to `4.08`, and from `32.7` to `22.79`.

For the scalar C implementation, performance improved from `17.14` to `13.97`.

If there are better implementations, it would be great to share and compare together.

</details>  

---

Anyway, while hand-tuning the given **triangle intersection test** SIMD code, I ran into a situation that was unexpected compared to what I had previously know.

Specifically, even after applying `_mm_dp_ps(DPPS)` and `_mm256_dp_ps(VDPPS)` to the **dot product** used inside the triangle intersection test, the overall performance did not improve as much as I expected.

* ***DPPS:** Dot Product of Packed Single Precision Floating-Point Values

As the instruction name itself suggests, these instructions implement dot product operations for a single vector directly at the hardware level.

They have existed for a very long time and are commonly used in textbooks, so it is not difficult to find example code using these instructions through a simple Google search.

Although I do not use them very often, I was familiar with these instructions, so I decided to use them.

However, since the result felt strange, I decided to write a separate benchmark and test it more carefully.

## Benchmark

### Scalar Dot Product Implementation

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

### Dot Product Implementation using DPPS

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

Of course, even if the code is written only in scalar form, modern compilers can optimize it quite well.

Still, I expected that using a dot product instruction would be faster, so I ran the benchmark.

### Benchmark Results

```
DOT_C_SCALAR         : 1.789 cycles/vec (total=60043980)
DOT_SSE_DPPS         : 2.918 cycles/vec (total=97899934)
```

However.. surprisingly, the `DPPS` version was significantly slower. In fact, it was about 1.63x slower. _(The code is very short, so I did not expect much compiler optimization. That made this result more surprising)_

## Implementation without using `DPPS`

I wondered if `DPPS` became slower on modern architectures for some reason. So I tried other implementations using different instructions.

### Option A, Implementation using `MULPS` + `HADDPS`

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

This implementation first multiplies all elements of the two vectors using `_mm_mul_ps(MULPS)`. Then it reduces the result using horizontal add with `_mm_hadd_ps(HADDPS)`.

### Option B, Implementation using `MULPS` + `ADDPS` + `SHUFPS`

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

This implementation is the same until the multiplication step with **Option A**. However, instead of using `_mm_hadd_ps(HADDPS)`, it uses a combination of `_mm_shuffle_ps(SHUFPS)` and `_mm_add_ps(ADDPS)` to reduce the values.

### Benchmark Results

```
DOT_C_SCALAR         : 1.789 cycles/vec (total=60043980)
DOT_SSE_DPPS         : 2.918 cycles/vec (total=97899934)
DOT_SSE_HADD         : 2.253 cycles/vec (total=75604884)
DOT_SSE_SHUFFLE      : 1.240 cycles/vec (total=41596493)
```

As expected, both **Option A** and **Option B** are faster than `DPPS`.

> Wait.. Why is `Option B, ADDPS + SHUFPS` faster than `Option A, HADDPS`?

This is likely because `HADDPS` is a horizontal operation. Horizontal operations usually have lower throughput and stricter scheduling limits.

On the other hand, `SHUFPS`(reordering) and `ADDPS`(normal addition) have fewer **CPU Port** restrictions. Because of this, the CPU can schedule instructions more freely, and the loop can achieve higher overall throughput.

> For reference, `HADDPS` has a latency of 7 and a CPI of 2. `SHUFPS` and `ADDPS` have latencies of 1 and 4, and CPIs of 0.5 and 0.5.

Because of this effect, when the vector count in the benchmark is reduced to 1, the loop-level advantage disappears. The result becomes the following

```
DOT_SSE_HADD         : 3.318 cycles/vec (total=6796)
DOT_SSE_SHUFFLE      : 3.854 cycles/vec (total=7892)
```

## So, Why is `DPPS` slower?

The exact internal implementation of `DPPS` is not public. So it is hard to say for sure unless you are an Intel engineer.

However, I can guess a few possible reasons.

1. `DPPS` uses an `imm8` value to select which lanes are computed (upper 4 bits) and which lanes to be stored the result (lower 4 bits). This flexibility may introduce extra hardware cost.

2. `DPPS` internally performs horizontal operations and may have specific port dependencies. Because of this, it may be harder to get good instruction-level
parallelism (ILP). (This is similar to the `Option A, HADDPS` vs `Option B, ADDPS + SHUFPS` problem)

If anyone knows more details, please leave a comment.

## Today's Conclusion

This conclusion may feel a bit weak, but this is the limit of my current understanding.

In my work, I mainly develop an **N-dimensional matrix computation framework**. In AI workloads as well, dot products are usually used in batch operations where vectors are stored contiguously.

Because of this, a common pattern is to use `FMA` and then perform a `Scalar Reduction`.

I knew about the `DPPS` instruction, but I did not use it often in practice. Through this experiment, I was able to explore some behaviors and issues that I did not fully understand before.