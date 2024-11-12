import { Injectable, MessageEvent, OnModuleDestroy } from '@nestjs/common'
import { Observable, ReplaySubject } from 'rxjs'

// TODO 현재 모든 접속자에게 이벤트를 전송하고 있다.
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
