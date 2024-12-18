import { Body, Controller, MessageEvent, Post, Sse } from '@nestjs/common'
import { ServerSentEventsService } from 'common'
import { Observable } from 'rxjs'

@Controller('sse')
export class SseController {
    constructor(private eventService: ServerSentEventsService) {}

    @Sse('events')
    events(): Observable<MessageEvent> {
        return this.eventService.getEventObservable()
    }

    @Post('trigger-event')
    triggerEvent(@Body() body: { message: string }) {
        this.eventService.sendEvent(body.message)

        return { success: true }
    }
}
