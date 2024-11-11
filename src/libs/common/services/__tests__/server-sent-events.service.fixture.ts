import { Body, Controller, MessageEvent, Module, Post, Sse } from '@nestjs/common'
import { Observable } from 'rxjs'
import { ServerSentEventsService } from '../server-sent-events.service'

@Controller('sse')
export class SseController {
    constructor(private eventService: ServerSentEventsService) {}

    @Sse('events')
    events(): Observable<MessageEvent> {
        console.log('SSE 1')
        return this.eventService.getEventObservable()
    }

    @Post('trigger-event')
    triggerEvent(@Body() body: { message: string }) {
        console.log('SSE 2')
        this.eventService.sendEvent(body.message)
        console.log('SSE 3')
        return { success: true }
    }
}
