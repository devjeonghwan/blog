---
title: "C Scalar vs SIMD Intrinsics vs Assembly"
date: 2025-12-26T00:00:00+09:00
draft: false
slug: "c-scalar-vs-intrinsics-vs-assembly"
translationKey: "c-scalar-vs-intrinsics-vs-assembly"
tags: ["Experience", "Chat", "C", "Intrinsics", "Assembly", "x86-64"]
---

> **This post is based on [Yeong-Cheon You](https://megayuchi.com/about/)'s [Stream](https://www.youtube.com/live/1sqV3F0hI0g?si=iS-6-t7V6V2ZGw0M&t=1193), [Facebook](https://www.facebook.com/share/p/1KyKJAbmVY/), and [Naver Cafe](https://cafe.naver.com/megayuchi/937).
> If you want more interesting topics, please join the Saturday stream. I am there too :D**

I mentioned this in [my last post](/development/performance-pitfalls-dpps). Recently, I am trying to optimize the **triangle intersection test** code from Yeong-Cheon You.

I started with Naive code. Now I finished almost everything I can do. So I post the result to record it.

```text
IntersectTriangle_Normal    : 17.8658 clks elapsed.
IntersectTriangle_SIMD      : 21.6889 clks elapsed.
IntersectResult_AVX_ASM     : 37.1889 clks elapsed.
IntersectTriangle_SIMD_OPT  : 14.4462 clks elapsed.
IntersectResult_AVX_ASM_OPT : 15.4750 clks elapsed. 
```

The list below shows the order of implementations.
- Scalar version in C language
- SIMD version with compiler intrinsics
- x86-64 assembly version
- **Improved** SIMD version with compiler intrinsics (★)
- **Improved** x86-64 assembly version (★)

## **Improved** SIMD Version with Compiler Intrinsics

For the **Improved SIMD version**, I applied these optimizations

- Changed `VECTOR3` register loading. I used `_mm_load_sd` + `_mm_castpd_ps` instead of `_mm_loadl_pi`.
- Changed dot product. `_mm_dp_ps` was slow for [unknown reasons](https://www.google.com/search?q=/development/performance-pitfalls-dpps). So I used `_mm_shuffle_ps` + `_mm_add_ps` instead.
- Made dot product return a scalar value. This reduces register pressure and helps compiler optimization.
_(However, the compiler just did inlining and kept `XMM` registers...)_
- Changed cross product. I used `_mm_permute_ps` instead of `_mm_shuffle_ps`. Also, I used `_mm_fmsub_ps(FMA)`.
- Used `FMA` for `P = v0 + u * edge1 + v * edge2` calculation.

With these optimizations, it is **1.5x faster than the old SIMD** version and **1.23x faster than C Scalar**. It has the **best performance** among all versions.

## **Improved** x86-64 Assembly Version

For the **Improved Assembly version**, I applied these optimizations

- Applied all techniques from the **Improved SIMD version**.
- Removed callee-saved registers (`XMM10`, `XMM11`, `R12`, `R13`, `R14`). I don't use them anymore.
- Applied simple latency hiding.

This version is **2.4x faster than the old Assembly** version and **1.15x faster than C Scalar**. But it could not beat the **Improved SIMD** version.

## Today's Conclusion

The compiler is good at **latency hiding** and **I-cache optimization**. It is hard for humans to do these things. But if I use Assembly manually, I cannot get these benefits. This seems to be the problem.
_(If I spend a really long time, maybe I can do it...)_

So my realistic conclusion is... **Just write good code with compiler intrinsics.**

<details>
<summary>View Source Code</summary>

> **!! Warning !!**  
> The codes below are based on Yeong-Cheon You's original source code. I applied some optimizations. Legal issues may happen if you use this without permission.

<details>
<summary>SIMD Version</summary>

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
</details>  

---

<details>
<summary>Assembly Version</summary>

```asm
; BOOL IntersectTriangle_AVX_ASM_x64(
;     VECTOR3* pv3OutIntersectPoint,
;     const VECTOR3* pv3Orig,
;     const VECTOR3* pv3Dir,
;     const VECTOR3* pV0,
;     const VECTOR3* pV1,
;     const VECTOR3* pV2,
;     float* pfOutT,
;     float* pfOutU,
;     float* pfOutV,
;     BOOL bCullBackface
; )
IntersectTriangle_AVX_ASM_x64 PROC \
    pv3OutIntersectPoint:QWORD, \
    pv3Orig:QWORD, \
    pv3Dir:QWORD, \
    pV0:QWORD, \
    pV1:QWORD, \
    pV2:QWORD, \
    pfOutT:QWORD, \
    pfOutU:QWORD, \
    pfOutV:QWORD, \
    bCullBackface:DWORD

    ; XMM Register Backup
    LOCAL xmm6_backup  : XMMWORD
    LOCAL xmm7_backup  : XMMWORD
    LOCAL xmm8_backup  : XMMWORD
    LOCAL xmm9_backup  : XMMWORD
    LOCAL xmm12_backup : XMMWORD

    vmovaps xmm6_backup,  xmm6
    vmovaps xmm7_backup,  xmm7
    vmovaps xmm8_backup,  xmm8
    vmovaps xmm9_backup,  xmm9
    vmovaps xmm12_backup, xmm12

    ; Register Setup
    mov     r10, pV1
    mov     r11, pV2

    vxorps  xmm12, xmm12, xmm12        ; xmm12 = 0.0
    xor     rax, rax                   ; bResult = FALSE

    ; V0 -> xmm3
    vmovsd   xmm3, qword ptr [r9]
    vmovss   xmm0, dword ptr [r9 + 8]
    vmovlhps xmm3, xmm3, xmm0

    ; V1 -> xmm4
    vmovsd   xmm4, qword ptr [r10]
    vmovss   xmm0, dword ptr [r10 + 8]
    vmovlhps xmm4, xmm4, xmm0

    ; Edge1 = V1 - V0
    vsubps  xmm4, xmm4, xmm3

    ; V2 -> xmm5
    vmovsd   xmm5, qword ptr [r11]
    vmovss   xmm0, dword ptr [r11 + 8]
    vmovlhps xmm5, xmm5, xmm0

    ; Edge2 = V2 - V0
    vsubps  xmm5, xmm5, xmm3

    ; Dir -> xmm2
    vmovsd   xmm2, qword ptr [r8]
    vmovss   xmm0, dword ptr [r8 + 8]
    vmovlhps xmm2, xmm2, xmm0

    ; Orig -> xmm1
    vmovsd   xmm1, qword ptr [rdx]
    vmovss   xmm0, dword ptr [rdx + 8]
    vmovlhps xmm1, xmm1, xmm0

    ; pvec = cross(dir, edge2)
    vpermilps xmm8, xmm2, 0C9h
    vpermilps xmm9, xmm5, 0D2h
    vmulps    xmm0, xmm8, xmm9

    vpermilps    xmm8, xmm2, 0D2h
    vpermilps    xmm9, xmm5, 0C9h
    vfnmadd231ps xmm0, xmm8, xmm9

    ; det = dot(edge1, pvec)
    vmulps    xmm6, xmm4, xmm0
    vpermilps xmm8, xmm6, 0B1h
    vaddps    xmm6, xmm6, xmm8
    vpermilps xmm8, xmm6, 04Eh
    vaddps    xmm6, xmm6, xmm8

    ; if (det <= 0)
    vcomiss xmm6, xmm12
    jbe     lb_back_face

    ; tvec = orig - v0
    vsubps  xmm1, xmm1, xmm3
    jmp     test_det_equal_zero

lb_back_face:
    cmp     bCullBackface, 0
    jz      lb_return

    ; tvec = v0 - orig
    ; det = -det
    vsubps  xmm1, xmm3, xmm1
    vxorps  xmm6, xmm6, xmmword ptr [sign_xor_mask]

test_det_equal_zero:
    ; if (det < epsilon)
    vcomiss xmm6, dword ptr [near_zero]
    jb      lb_return

    ; u = dot(tvec, pvec)
    vmulps    xmm7, xmm1, xmm0
    vpermilps xmm8, xmm7, 0B1h
    vaddps    xmm7, xmm7, xmm8
    vpermilps xmm8, xmm7, 04Eh
    vaddps    xmm7, xmm7, xmm8

    ; if (u < 0 || u > det)
    vcomiss xmm7, xmm12
    jb      lb_return
    vcomiss xmm7, xmm6
    ja      lb_return

    ; qvec = cross(tvec, edge1)
    vpermilps xmm8, xmm1, 0C9h
    vpermilps xmm9, xmm4, 0D2h
    vmulps    xmm0, xmm8, xmm9

    vpermilps    xmm8, xmm1, 0D2h
    vpermilps    xmm9, xmm4, 0C9h
    vfnmadd231ps xmm0, xmm8, xmm9

    ; v = dot(dir, qvec)
    vmulps    xmm1, xmm2, xmm0
    vpermilps xmm8, xmm1, 0B1h
    vaddps    xmm1, xmm1, xmm8
    vpermilps xmm8, xmm1, 04Eh
    vaddps    xmm1, xmm1, xmm8

    ; if (v < 0 || u + v > det)
    vcomiss xmm1, xmm12
    jb      lb_return

    vaddps  xmm8, xmm7, xmm1
    vcomiss xmm8, xmm6
    ja      lb_return

    ; t = dot(edge2, qvec)
    vmulps    xmm2, xmm5, xmm0
    vpermilps xmm8, xmm2, 0B1h
    vaddps    xmm2, xmm2, xmm8
    vpermilps xmm8, xmm2, 04Eh
    vaddps    xmm2, xmm2, xmm8

    ; invDet = 1 / det
    vmovss  xmm8, dword ptr [one]
    vdivss  xmm6, xmm8, xmm6

    vmulss  xmm2, xmm2, xmm6        ; t
    vmulss  xmm7, xmm7, xmm6        ; u
    vmulss  xmm1, xmm1, xmm6        ; v

    ; Write Intersection Point
    test    rcx, rcx
    jz      lb_write_result

    vpermilps xmm7, xmm7, 0
    vpermilps xmm1, xmm1, 0

    ; P = v0 + u * edge1 + v * edge2
    vfmadd213ps xmm4, xmm7, xmm3
    vfmadd213ps xmm5, xmm1, xmm4

    vmovlps  qword ptr [rcx], xmm5
    vmovhlps xmm0, xmm0, xmm5
    vmovss   dword ptr [rcx + 8], xmm0

lb_write_result:
    mov     rax, pfOutT
    vmovss  dword ptr [rax], xmm2

    mov     rax, pfOutU
    vmovss  dword ptr [rax], xmm7

    mov     rax, pfOutV
    vmovss  dword ptr [rax], xmm1

    mov     rax, 1                  ; bResult = TRUE

lb_return:
    vmovaps xmm6,  xmm6_backup
    vmovaps xmm7,  xmm7_backup
    vmovaps xmm8,  xmm8_backup
    vmovaps xmm9,  xmm9_backup
    vmovaps xmm12, xmm12_backup

    ret
IntersectTriangle_AVX_ASM_x64 ENDP
```
</details>  
</details>  
