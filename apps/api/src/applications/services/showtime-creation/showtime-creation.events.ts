import { InjectNatsPubSub, JsonUtil, NatsPubSubService } from '@mannercode/common'
import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common'
import { getProjectId } from 'config'
import { Observable, Subject } from 'rxjs'
import type { ShowtimeCreationEvent } from './services/types'

/**
 * Bridges Temporal worker → SSE client across replicas.
 *
 * The worker that runs a workflow may live on a different replica than the
 * HTTP controller serving an SSE stream. Status changes are published onto
 * a NATS subject and every replica subscribes, forwarding incoming
 * messages to a local RxJS Subject. `observeStatusChanged` exposes that
 * Subject so the controller can map events into SSE payloads.
 *
 * Subject name is namespaced by PROJECT_ID so parallel test workers (each
 * with a unique PROJECT_ID) don't see one another's events.
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
