import { InjectNatsPubSub, JsonUtil, NatsPubSubService } from '@mannercode/common'
import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common'
import { getProjectId } from 'config'
import { Observable, Subject } from 'rxjs'
import type { ShowtimeCreationEvent } from './internal/types'

// NATS로 복제본을 건넌 상태를 로컬 RxJS 스트림에 전달하며, PROJECT_ID로 테스트를 격리한다.
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
