# Claude session memory snapshot

서버 reformat 전에 보존한 Claude 세션 메모리 파일들.
원래 위치: `/home/node/.claude/projects/-workspaces-nest-seed/memory/`

새 환경에서 다음 세션을 시작할 때 이 디렉터리를 참조하거나, 새 세션의 메모리 디렉터리로 다시 복사하면 누적된 피드백 컨텍스트를 이어받을 수 있다.

## 포함 파일

- `MEMORY.md` — 인덱스
- `feedback_persist_searching.md` — 검토 시 "못 찾으면 종료" 금지
- `feedback_review_scope.md` — 코드 외에 문서·설정·테스트도 포함
- `feedback_tdd_first.md` — 실패 테스트 먼저, 그 다음 수정
- `feedback_zoom_out_review.md` — line-level 외에 architectural coherence
- `feedback_question_layout.md` — 파일 배치/의존 방향도 의심

## 복구 방법

새 세션에서:
```bash
cp /workspaces/nest-seed/.claude-session/*.md /home/node/.claude/projects/-workspaces-nest-seed/memory/
```
