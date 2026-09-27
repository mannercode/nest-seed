import { InjectNatsPubSub, JsonUtil, NatsPubSubService } from '@mannercode/common'
import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common'
import { Observable, Subject } from 'rxjs'
import { AppConfigService } from '#config'
import { ShowtimeCreationEventSchema, type ShowtimeCreationEvent } from './internal/types.js'

// NATS로 받은 상영 상태 이벤트를 이 API 복제본의 RxJS 스트림에 전달한다. PROJECT_ID로 테스트별 메시지를 구분한다.
@Injectable()
export class ShowtimeCreationEventService implements OnModuleInit, OnModuleDestroy {
    private readonly natsSubject: string

    private readonly subject = new Subject<ShowtimeCreationEvent>()
    private readonly handler = (message: string) => {
        const event = ShowtimeCreationEventSchema.parse(JSON.parse(message))
        this.subject.next(event)
    }

    constructor(
        @InjectNatsPubSub() private readonly natsPubSub: NatsPubSubService,
        config: AppConfigService
    ) {
        this.natsSubject = `${config.projectId}.showtime-creation.statusChanged`
    }

    async onModuleInit() {
        await this.natsPubSub.subscribe(this.natsSubject, this.handler)
    }

    async onModuleDestroy() {
        await this.natsPubSub.unsubscribe(this.natsSubject, this.handler)
        this.subject.complete()
    }

    async emitStatusChanged(payload: ShowtimeCreationEvent) {
        await this.natsPubSub.publish(this.natsSubject, JsonUtil.stringify(payload))
    }

    observeStatusChanged(): Observable<ShowtimeCreationEvent> {
        return this.subject.asObservable()
    }
}
