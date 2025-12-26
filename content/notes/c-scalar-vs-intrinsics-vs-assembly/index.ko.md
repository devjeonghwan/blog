---
title: "C 스칼라 코드 vs 컴파일러 내장함수 코드 vs 어셈블리 코드"
date: 2025-12-26T00:00:00+09:00
draft: false
slug: "c-scalar-vs-intrinsics-vs-assembly"
translationKey: "c-scalar-vs-intrinsics-vs-assembly"
tags: ["경험담", "잡담", "C", "Intrinsics", "Assembly", "x86-64"]
---

> **이 글은 [유영천(Yeong-Cheon You)](https://megayuchi.com/about/) 님의 [방송](https://www.youtube.com/live/1sqV3F0hI0g?si=iS-6-t7V6V2ZGw0M&t=1193) 그리고 [페이스북](https://www.facebook.com/share/p/1KyKJAbmVY/), [네이버 카페](https://cafe.naver.com/megayuchi/937)를 통해서 전개되었습니다.  
> 더 많은 흥미로운 주제와 내용을 원하신다면 토요일 방송에 참여해주세요. 저도 있답니다 :D**

[지난번 글](/development/performance-pitfalls-dpps)에서 잠깐 언급했는데, 요즘 유영천 님이 올려주신 **삼각형 교차 검사(Triangle Intersection Test)** 코드를 최적화해 보고 있습니다.

나이브(Naive)한 코드로 시작해서, 얼추 해볼 수 있는 건 다 마무리가 되어서 결과 기록차 게시물을 올립니다.

```text
IntersectTriangle_Normal    : 17.8658 clks elapsed.
IntersectTriangle_SIMD      : 21.6889 clks elapsed.
IntersectResult_AVX_ASM     : 37.1889 clks elapsed.
IntersectTriangle_SIMD_OPT  : 14.4462 clks elapsed.
IntersectResult_AVX_ASM_OPT : 15.4750 clks elapsed. 
```

각 구현체는 위에서부터 순서대로 다음과 같습니다.
- C 언어로 구현된 스칼라(Scalar) 버전
- 컴파일러 내장함수(Intrinsics)로 구현된 SIMD 버전
- x86-64 어셈블리(Assembly) 버전
- **개선된** 컴파일러 내장함수로 구현된 SIMD 버전 (★)
- **개선된** x86-64 어셈블리 버전 (★)

## **개선된** 컴파일러 내장함수로 구현된 SIMD 버전

**개선된 SIMD 버전**의 경우 아래와 같은 최적화를 적용했습니다.

- `VECTOR3` 레지스터 로드 방식을 `_mm_loadl_pi` 에서 `_mm_load_sd` + `_mm_castpd_ps` 방식으로 변경
- 내적(Dot Product) 함수 구현을 [알 수 없는 이유](/development/performance-pitfalls-dpps)로 성능이 안 나오는 `_mm_dp_ps` 대신 `_mm_shuffle_ps` + `_mm_add_ps`를 사용하도록 변경
- 내적 함수가 스칼라를 반환하도록 하여 레지스터 압박(Register Pressure)을 줄이고 및 컴파일러 최적화 유도  
  _(했지만, 컴파일러가 그냥 인라인 처리 + `XMM` 레지스터를 유지하더라는..)_
- 외적(Cross Product) 구현을 `_mm_shuffle_ps` 대신 `_mm_permute_ps`을 활용하고, `_mm_fmsub_ps(FMA)`를 사용하도록 변경
- `P = v0 + u * edge1 + v * edge2` 계산에 `FMA`를 사용하도록 변경

이러한 최적화를 통해 나이브한 **기존 SIMD 구현 대비 1.5배**, **C 스칼라 대비 1.23배**의 성능을 기록하면서 여러 구현체 중 **가장 우수한 성능**을 기록했습니다.  

## **개선된** x86-64 어셈블리 버전

**개선된 어셈블리 버전**의 경우 아래와 같은 최적화를 적용했습니다.

- 기존 **개선된 SIMD 버전**에 적용한 기법들 모두 적용
- 기존에 사용하던 피호출자 보존 레지스터(Callee-saved Register) 중 `XMM10`, `XMM11`, `R12`, `R13`, `R14`를 사용하지 않도록 제거
- 간단한 지연 감추기(Latency Hiding) 적용

이 버전 역시 나이브한 **기존 어셈블리 구현 대비 2.4배**, **C 스칼라 대비 1.15배** 빨라졌지만, **개선된 SIMD** 버전을 이길 수 없었습니다.

## 오늘의 결론

컴파일러는 사람이 직접 하기 복잡한 **지연 감추기**나 **I-Cache 최적화**를 잘하는데, 직접 어셈블리를 사용하면 이러한 혜택을 받을 수 없다 보니 발생하는 문제로 보입니다.  
_(정말 시간을 갈아 넣을 수 있다면, 할 수 있겠지만..)_

그래서 현실적인 제 결론은.. **컴파일러 내장함수로 잘 짜면 된다.**

<details>
<summary>소스 코드 보기</summary>

> **!! 주의 !!**  
> 아래 코드들은 유영천 님 원본 소스코드에 제가 일부 최적화를 적용한 소스코드입니다. 따라서 무단 사용 시 법적인 문제가 발생할 수 있습니다.

<details>
<summary>SIMD 버전</summary>

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
<summary>어셈블리 버전</summary>

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
