---
title: "2025년 회고록"
date: 2025-12-24T00:00:00+09:00
draft: false
slug: "2025-retrospective"
translationKey: "2025-retrospective"
tags: ["회고록"]
---

체감상 제일 빠르게 지나간 2025년, 한 해 동안 제가 했던 프로젝트들과 작업을 나열해 보고자 합니다.

## 오픈 소스 프로젝트

- **OpenJDK JExtract:** `struct` 멤버가 배열인 경우 잘못된 바인딩을 생성하는 문제를 수정함
  - [PR](https://github.com/openjdk/jextract/pull/294)
- **FFmpeg AVFormat:** `fcTL`와 `fdAT`/`IDAT` 사이에 다른 청크가 위치할 수 없는 표준 불일치 문제를 수정함
  - [PR #1](https://code.ffmpeg.org/FFmpeg/FFmpeg/pulls/20140)
  - [PR #2](https://code.ffmpeg.org/FFmpeg/FFmpeg/pulls/20208)
- **x64dbg:** Windows 11 24H2 환경에서 힙을 열거할 수 없는 문제를 수정함
  - [Report](https://cafe.naver.com/megayuchi/683)
  - [PR](https://github.com/x64dbg/x64dbg/pull/3478)
- **javacpp:** 네이티브 할당 위치를 추적하기 위한 유틸리티를 추가함
  - [PR #1](https://github.com/bytedeco/javacpp/pull/815)
  - [PR #2](https://github.com/bytedeco/javacpp/pull/816)
- **javacpp:** Windows ARM64 지원을 추가함
  - [PR #1](https://github.com/bytedeco/javacpp/pull/813)
  - [CI PR #2](https://github.com/bytedeco/javacpp-presets/pull/1653)
  - [CI PR #3](https://github.com/bytedeco/javacpp-presets/pull/1660)
- **javacpp-presets:** Windows ARM64 용 LLVM Presets을 추가함
  - [PR #1](https://github.com/bytedeco/javacpp-presets/pull/1656)
- **javacpp-presets:** Windows ARM64 용 Systems Presets을 추가함
  - [PR #1](https://github.com/bytedeco/javacpp-presets/pull/1659)
- **javacpp-presets:** Linux ARM64 용 ONNX 빌드 스크립트 및 CI를 구현함
  - [PR #1](https://github.com/bytedeco/javacpp-presets/pull/1697)

## 회사 업무

- 행렬 연산 프레임워크 고도화
  - CMake 증분 빌드 도입
  - Jetson 등 NVIDIA 통합 메모리 모델 지원
  - SIMD 지원 확장
  - 참조 카운트 기반으로 메모리 관리 모델 변경
  - CD/CI 강화
  - 성능 고도화 작업
- SW 불법 복제 방지 솔루션 개발
  - 펌웨어 개발
  - C API, JAVA API 개발
  - Provision 도구 개발
- SK 하이닉스 관련 솔루션 유지보수, 고도화 및 대응
- 사내 보고용 주간 보고서 생성기 개발 (GitHub 데이터 수집 및 OpenAI 요약)
- 사내 회의용 회의록 생성기 개발 (Clova Speech 음성인식 및 OpenAI 요약)
- SNN 컴파일러 프로젝트 관리 및 초안 설계 참여
- 회사 홈페이지 리뉴얼 작업

## 개인 업무

- 엘리베이터 제조사 향 원격 감시 및 정비 리포트 생성 프로그램 개발
- **블로그 개설!**