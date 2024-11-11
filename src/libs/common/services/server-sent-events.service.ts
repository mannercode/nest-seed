import { Injectable, MessageEvent, OnModuleDestroy } from '@nestjs/common'
import { Observable, ReplaySubject } from 'rxjs'

@Injectable()
export class ServerSentEventsService implements OnModuleDestroy {
    private eventSubject = new ReplaySubject<MessageEvent>(1)

    async onModuleDestroy() {
        this.eventSubject.complete()
    }

    sendEvent(data: any) {
        this.eventSubject.next({ data })
    }

    getEventObservable(): Observable<MessageEvent> {
        return this.eventSubject.asObservable()
    }
}
