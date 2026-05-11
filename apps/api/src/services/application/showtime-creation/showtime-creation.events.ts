import { InjectNatsPubSub, JsonUtil, NatsPubSubService } from '@mannercode/common'
import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common'
import { getProjectId } from 'config'
import { Observable, Subject } from 'rxjs'
import type { ShowtimeCreationEvent } from './internal/types'

/**
 * Temporal 워커와 SSE 클라이언트를 서로 다른 복제본에서도 이어 주는 다리다.
 *
 * 워크플로우를 돌리는 워커가 SSE 응답을 다루는 컨트롤러와 다른 복제본에 있을
 * 수 있다. 상태 변화는 NATS subject 로 publish 되고, 모든 복제본이 같은
 * subject 를 구독한다. 들어온 메시지는 복제본 안의 RxJS Subject 로 다시
 * 흘려보낸다. `observeStatusChanged` 가 그 Subject 를 노출해서, 컨트롤러는
 * 그것을 받아 SSE 본문으로 변환한다.
 *
 * subject 이름 앞에 `PROJECT_ID` 를 붙여 namespace 를 나눈다. 그래서 병렬
 * 테스트 워커끼리 서로의 이벤트를 보지 않는다.
 */
@Injectable()
export class ShowtimeCreationEvents implements OnModuleInit, OnModuleDestroy {
    private readonly natsSubject = `${getProjectId()}.showtime-creation.statusChanged`

    private readonly subject = new Subject<ShowtimeCreationEvent>()
    private readonly handler = (message: string) => {
        const event = JsonUtil.parse(message) as ShowtimeCreationEvent
        this.subject.next(event)
    }

    constructor(@InjectNatsPubSub() private readonly natsPubSub: NatsPubSubService) {}

    async onModuleInit() {
        await this.natsPubSub.subscribe(this.natsSubject, this.handler)
    }

    async onModuleDestroy() {
        await this.natsPubSub.unsubscribe(this.natsSubject, this.handler)
        this.subject.complete()
    }

    async emitStatusChanged(payload: ShowtimeCreationEvent) {
        await this.natsPubSub.publish(this.natsSubject, JSON.stringify(payload))
    }

    observeStatusChanged(): Observable<ShowtimeCreationEvent> {
        return this.subject.asObservable()
    }
}
