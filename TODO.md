1. movies 등 테스트 설명 다시 봐야한다. codex가 크게 고쳤다.
2. sola를 아예 폴더 중첩구조로 만들까?
    - app/
    - core/
    -      infra/

이렇게?

3. http controller를 각 모듈에 포함시킬까?
4. src/**tests** 를 각 모듈로 옮길까?
5. `CatalogManagementService`의 영화·극장 삭제 유스케이스를 분리한다.
    - `CatalogManagement`는 실제 역할보다 넓은 이름이며 두 삭제는 독립적인 작업이다.
    - Application에 `MovieDeletionService`와 `TheaterDeletionService`를 두고 각 삭제에 필요한 Core 서비스를 조합한다.
    - 기존 HTTP 계약과 상영이 있는 자원의 삭제 제한을 유지한다. 모듈 연결·컨트롤러 호출·관련 문서와 기존 테스트를 갱신하고 검증한다.
