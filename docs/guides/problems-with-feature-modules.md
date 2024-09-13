# Problems with Feature Modules

Nest에서 Controller, Service, 그리고 Repository가 모두 같은 모듈에 위치하는 구조를 "Feature Module" 구조라고 한다.
공식 문서의 설명이다.

> CatsController와 CatsService는 동일한 애플리케이션 도메인에 속합니다.
> 서로 밀접하게 연관되어 있으므로 기능 모듈로 이동하는 것이 좋습니다.
> 기능 모듈은 특정 기능과 관련된 코드를 간단히 정리하여 코드를 체계적으로 유지하고 명확한 경계를 설정합니다.
> 이는 특히 애플리케이션 및/또는 팀의 규모가 커짐에 따라 복잡성을 관리하고 SOLID 원칙에 따라 개발하는 데 도움이 됩니다.

그러나 Feature Modules은 상호참조 문제가 쉽게 발생할 수 있다.

## 모듈 간 상호참조

project -> scene -> room의 관계를 가지는 리소스가 있다고 가정한다.

DELETE /projects를 하려면 project에 속한 scene,room도 삭제해야 한다
그러나 room이 scene을 참조하고 scene가 project를 참조하는 구조다.
삭제를 위해서 project가 scene를 참조하면 순환참조가 된다.
이 문제를 해결하기 위해서 ClearAssetService를 만들고 여기서 project,scene,roome을 삭제하는 기능을 구현한다.

이 때, Controller가 각 모듈에 속하는 기존 구조는 문제가 된다.
ProjectsController에서 ClearAssetService를 호출하면 Scene와 Room을 참조하게 된다.
이것은 결국 순환 참조가 된다.

그래서 `DELETE /projects`는 할 수 없고 ClearController를 만들고 `POST /clear/projects/${projectId}`로 해야 한다.
이 REST API 디자인은 이해하기 어렵다.

`Feature Modules` 구조에서는 아래와 같은 REST API 디자인은 어렵다. 왜냐하면 MoviesController 다른 모듈들을 참조해야 하는데 다른 모듈들 또한 MoviesModule을 참조해야 하기 때문이다.

```sh
# 요청하는 리소스가 앞에 오고 필터가 뒤따라 오는 REST API 설계
/movies/screening
/movies/weekly-best
/movies/abc123/reviews
```

이 문제를 피하기 위해서 REST API의 디자인을 바꿔야 한다.

```sh
# 필터가 앞에 오고 요청하는 리소스가 뒤에 오는 설계
/screening/movies
/weekly-best/movies
/reviews/movies/abc123
```

그러나 이 디자인은 부자연스러워서 이해하기 어렵다.

## Path의 분산

컨트롤러를 레이어로 분리하지 않고 서비스와 같이 모듈에 안전하게 넣을 수 있는 또 다른 방법은 경로를 분산하는 것이다. `DELETE /projects`를 `ProjectsModule`에서 처리하지 않고 `ClearAssetsModules`에서 처리하는 것이다.

```ts
@Controller('')
export class ClearAssetsController {
    constructor(private readonly seedsService: SeedsService) {}

    @Delete('/projects/:projectId')
    async removeProject(@Param('projectId') projectId: string) {
        return this.projectsService.removeSeed(projectId)
    }
}
```

그러나 이것은 하나의 도메인이 여러 모듈에 걸쳐지기 때문에 모듈 간 의존성을 더 키우게 될 것이다.
