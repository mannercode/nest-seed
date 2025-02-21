import { Injectable } from '@nestjs/common'
import { ClientProxyService, InjectClientProxy } from 'common'
import { ShowtimeDto } from 'cores'
import { ClientProxyConfig, Subjects } from 'shared/config'

@Injectable()
export class ShowtimeCreationEventsService {
    constructor(
        @InjectClientProxy(ClientProxyConfig.connName) private service: ClientProxyService
    ) {}

    private emit(payload: any) {
        this.service.emit(Subjects.ShowtimeCreation.event, payload)
    }

    emitWaiting(batchId: string) {
        this.emit({ batchId, status: 'waiting' })
    }

    emitProcessing(batchId: string) {
        this.emit({ batchId, status: 'processing' })
    }

    emitComplete(batchId: string, showtimeCreatedCount: number, ticketCreatedCount: number) {
        this.emit({ batchId, status: 'complete', showtimeCreatedCount, ticketCreatedCount })
    }

    emitFail(batchId: string, conflictingShowtimes: ShowtimeDto[]) {
        this.emit({ batchId, status: 'fail', conflictingShowtimes })
    }

    emitError(batchId: string, message: string) {
        this.emit({ batchId, status: 'error', message })
    }
}
