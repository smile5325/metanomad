# MetaNomad — 작업 상태
- 최종 업데이트: 2026-03-26
- 담당 파일: D:\projects\metanomad\

## ✅ 완료 항목
- [x] TTS 씬 카드 예상/실제 길이 표시 (StageMultimedia) (2026-03-26)
- [x] 빈 나레이션 씬 경고 배너 — Scene_13 등 Rate Limit 대응 (2026-03-26)
- [x] 이미지-나레이션 매칭 불일치 수정 — KOR/ENG 길이 통일 (2026-03-26)
- [x] 에러 체크리스트 🔴 높음 #1~#5 수정 (2026-03-26)
- [x] 에러 체크리스트 🟡 중간 #6~#14 수정 — claudeService.ts (2026-03-26)
- [x] TTS 배치 테스트 — 청크 분할 정상 확인 (2026-03-26)
- [x] TTS 실측 속도 캘리브레이션: **6.6자/초** (예상 5자/초 대비 +32%) (2026-03-26)
- [x] 나레이션 목표 상향: 독백 430→560자, 대화 350→530자 (2026-03-26)
- [x] Keep_Going 이중 파일 구조 도입 — LATEST.md + 세션 스냅샷 (2026-03-26)

## 🔴 미완료 (다음 세션 시작점)
- [ ] 새 스토리보드 생성 → 나레이션 560~620자 정상 생성 확인
- [ ] TTS 배치 실행 → 씬당 85~94초 범위 달성 확인
- [ ] error_check/checklist.md #15~#17 — CharacterManager.tsx (canvas null, img onload, 타입 단언)
- [ ] error_check/checklist.md #18~#20 — StageInspiration, StageMultimedia 보완
- [ ] error_check/checklist.md #22~#27 — StageFinalization, StageStoryboard, geminiService, tsconfig

## 앱 실행 방법
```powershell
cd D:\projects\metanomad
npm run dev
# 브라우저 → localhost:3000
```

## 다음 세션 시작 프롬프트
```
Keep_Going\LATEST.md 읽고 미완료 항목부터 이어서 작업해줘.
작업 폴더: D:\projects\metanomad, C: 드라이브 금지.
```
