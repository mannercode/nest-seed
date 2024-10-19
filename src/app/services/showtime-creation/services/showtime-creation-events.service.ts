import { Injectable, MessageEvent } from '@nestjs/common'
import { ServerSentEventsService } from 'common'
import { Observable } from 'rxjs'
import { ShowtimeDto } from 'services/showtimes'

@Injectable()
export class ShowtimeCreationEventsService {
    constructor(private sseService: ServerSentEventsService) {}

    monitorEvents(): Observable<MessageEvent> {
        return this.sseService.getEventObservable()
    }

    emitWaiting(batchId: string) {
        this.sseService.sendEvent({ batchId, status: 'waiting' })
    }

    emitProcessing(batchId: string) {
        this.sseService.sendEvent({ batchId, status: 'processing' })
    }

    emitComplete(batchId: string, showtimeCreatedCount: number, ticketCreatedCount: number) {
        this.sseService.sendEvent({
            batchId,
            status: 'complete',
            showtimeCreatedCount,
            ticketCreatedCount
        })
    }

    emitFail(batchId: string, conflictShowtimes: ShowtimeDto[]) {
        this.sseService.sendEvent({ batchId, status: 'fail', conflictShowtimes })
    }

    emitError(batchId: string, message: string) {
        this.sseService.sendEvent({ batchId, status: 'error', message })
    }
}
