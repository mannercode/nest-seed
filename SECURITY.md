# Security Policy / 보안 정책

## 지원 범위

이 저장소는 별도 장기 지원 릴리스 없이 `main`의 최신 상태를 기준으로 유지한다. 포크한 저장소와 그 배포 환경의 보안 설정, 비밀 값, 패치 적용은 해당 운영자가 책임진다.

커밋된 `.env.api`와 `.env.infra`의 값은 로컬 실행을 위한 공개 개발 기본값이다. 이 값을 실제 배포에서 그대로 사용한 것은 원본 저장소의 비밀 유출로 보지 않는다. 외부에 서비스를 노출하기 전에 포크마다 인증 secret, root 비밀번호, 스토리지 자격증명을 새로 만들고 저장소 밖의 secret 관리 경로로 주입한다.

## 취약점 제보

공개 issue, discussion, pull request 또는 커밋에 취약점 세부 내용을 남기지 않는다. GitHub의 [비공개 취약점 제보](https://github.com/mannercode/nest-seed/security/advisories/new)를 사용한다.

제보에는 가능한 범위에서 다음을 포함한다.

- 영향을 받는 커밋과 구성 요소
- 재현 조건과 최소 재현 절차
- 예상 영향과 공격자가 필요한 권한
- 알고 있다면 임시 완화책

실제 사용자 데이터나 제3자 시스템을 대상으로 검증하지 않는다. 실제 secret이 노출됐다면 먼저 해당 제공자에서 폐기·회전한다. Git 기록이나 파일에서 문자열만 지우는 것으로는 secret이 무효화되지 않는다.

포크 관리자는 위 제보 링크를 자기 저장소의 private vulnerability reporting 경로로 바꾸고, GitHub Security 설정을 별도로 활성화해야 한다. 자세한 설정은 [GitHub 운영 설정](docs/github-setup.md)을 따른다.

## English summary

Only the current `main` branch is supported. Do not disclose vulnerability details in a public issue, discussion, pull request, or commit. Use [GitHub private vulnerability reporting](https://github.com/mannercode/nest-seed/security/advisories/new) and include the affected commit, reproduction steps, impact, and any known mitigation.

The committed `.env` values are public development defaults, not production secrets. Fork owners must rotate them before exposure or deployment and keep production secrets outside the repository. If a real credential is exposed, revoke or rotate it before attempting history cleanup.
