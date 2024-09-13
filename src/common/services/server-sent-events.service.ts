import { Injectable, MessageEvent, OnModuleDestroy } from '@nestjs/common'
import { Observable, Subject } from 'rxjs'

@Injectable()
export class ServerSentEventsService implements OnModuleDestroy {
    private eventSubject = new Subject<MessageEvent>()

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
