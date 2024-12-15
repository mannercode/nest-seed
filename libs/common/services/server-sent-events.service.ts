import { Injectable, MessageEvent, OnModuleDestroy } from '@nestjs/common'
import { Observable, ReplaySubject } from 'rxjs'

// TODO 현재 모든 접속자에게 이벤트를 전송하고 있다.
@Injectable()
export class ServerSentEventsService implements OnModuleDestroy {
    // 마지막 이벤트 1개는 보관하고 있다가 리스너가 접속하면 전송한다.
    // 유닛 테스트에서 동기화 문제 해결하기 위해 이렇게 했다.
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
