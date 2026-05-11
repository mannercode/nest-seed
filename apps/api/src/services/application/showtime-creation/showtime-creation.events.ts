import { InjectNatsPubSub, JsonUtil, NatsPubSubService } from '@mannercode/common'
import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common'
import { getProjectId } from 'config'
import { Observable, Subject } from 'rxjs'
import type { ShowtimeCreationEvent } from './internal/types'

/**
 * Temporal 워커와 SSE 클라이언트를 복제본 경계 너머로 연결합니다.
 *
 * 워크플로우를 실행하는 워커와 SSE 응답을 가진 컨트롤러가 서로 다른 복제본에
 * 있을 수 있습니다. 상태 변화는 NATS subject로 publish 하고, 각 복제본은 받은
 * 메시지를 로컬 RxJS Subject에 전달합니다. 컨트롤러는 `observeStatusChanged`로
 * 그 Subject를 구독해 SSE 본문을 만듭니다.
 *
 * subject 이름 앞에 `PROJECT_ID`를 붙여 병렬 테스트 워커의 이벤트 공간을 분리합니다.
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
