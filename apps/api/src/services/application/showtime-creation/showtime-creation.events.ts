import { InjectNatsPubSub, JsonUtil, NatsPubSubService } from '@mannercode/common'
import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common'
import { getProjectId } from 'config'
import { Observable, Subject } from 'rxjs'
import type { ShowtimeCreationEvent } from './internal/types'

/**
 * Temporal worker → SSE client 를 replica 간에 연결하는 bridge.
 *
 * workflow 를 실행하는 worker 가 SSE stream 을 처리하는 HTTP controller 와
 * 다른 replica 에 있을 수 있다. 상태 변경은 NATS subject 로 publish 되고 모든
 * replica 가 구독해, 들어오는 메시지를 local RxJS Subject 로 전달한다.
 * `observeStatusChanged` 가 그 Subject 를 노출해 controller 가 event 를 SSE
 * payload 로 매핑할 수 있게 한다.
 *
 * Subject 이름은 PROJECT_ID 로 namespace 가 분리되어, 병렬 test worker (각자
 * 고유 PROJECT_ID) 가 서로의 이벤트를 보지 않는다.
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
