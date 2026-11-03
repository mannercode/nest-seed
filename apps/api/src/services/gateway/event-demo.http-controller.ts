import { JsonUtil } from '@mannercode/common'
import { Body, Controller, HttpCode, HttpStatus, Post, Req, Sse, UseGuards } from '@nestjs/common'
import { map } from 'rxjs'
import { EventDemoService, PublishMessageSchema, type PublishMessageDto } from '#infrastructure'
import { UserAuthGuard } from './guards/index.js'
import type { UserAuthRequest } from './types.js'

@Controller('event-demo')
@UseGuards(UserAuthGuard)
export class EventDemoHttpController {
    constructor(private readonly events: EventDemoService) {}
    @Post('messages')
    @HttpCode(HttpStatus.ACCEPTED)
    async publish(
        @Req() req: UserAuthRequest,
        @Body({ schema: PublishMessageSchema }) input: PublishMessageDto
    ) {
        return this.events.publish(req.user.sub, input)
    }
    @Sse('event-stream')
    observe(@Req() req: UserAuthRequest) {
        return this.events
            .observe(req.user.sub)
            .pipe(map(({ id, message }) => ({ id, data: JsonUtil.stringify({ id, message }) })))
    }
}
