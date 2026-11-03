# CI 미결 사항

## 보류

### minimatch의 상위 도구 호환 업데이트

[Dependabot 경고 #286](https://github.com/mannercode/nest-seed/security/dependabot/286)은 `minimatch` 11.0.1 이상을 요구하지만, 최신 Nest CLI·빌드 플러그인·Testcontainers·ESLint가 아직 구버전에 의존한다. 3.x 호출 방식은 11.x와 달라 단순 강제 교체가 불가능하다. 사용자 결정에 따라 제3자 패치를 유지하는 대신 상위 도구의 호환 릴리스를 기다린다.

호환 릴리스가 나오면 해당 도구와 lockfile만 갱신하고 `pnpm run atoz` 및 Dependabot 경고 해소를 확인한다.
