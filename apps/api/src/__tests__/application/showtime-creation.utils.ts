import {
    ShowtimeCreationEventSchema,
    type ShowtimeCreationEvent,
    type ShowtimeCreationTerminalEvent
} from '../../services/application/showtime-creation/internal/index.js'
import { HttpTestClient } from '@mannercode/testing'
import type { AppTestContext } from '../helpers/index.js'

export async function submitAndWaitForCompletion<
    T,
    S extends ShowtimeCreationTerminalEvent['status']
>(ctx: AppTestContext, accessToken: string, status: S, submit: () => Promise<T>) {
    // 공유 httpClient는 다른 요청이 끼어들면 abort 대상이 SSE 스트림이 아니게 된다.
    // 스트림 전용 클라이언트를 만들어 abort가 항상 이 구독을 가리키게 한다.
    const sseClient = new HttpTestClient(ctx.httpClient.serverUrl)

    const ready = Promise.withResolvers<void>()
    const events: ShowtimeCreationEvent[] = []
    const completion = Promise.withResolvers<ShowtimeCreationTerminalEvent>()
    const reject = (reason: unknown) => {
        ready.reject(reason)
        completion.reject(reason)
    }

    try {
        sseClient
            .get('/showtime-creation/event-stream')
            .headers({ Authorization: `Bearer ${accessToken}` })
            .sse(
                (data) => {
                    try {
                        const event = ShowtimeCreationEventSchema.parse(JSON.parse(data))
                        events.push(event)
                        if (event.status !== 'waiting' && event.status !== 'processing') {
                            completion.resolve(event)
                        }
                    } catch (error) {
                        reject(error)
                    }
                },
                reject,
                ready.resolve
            )

        const [event, response] = await Promise.all([
            completion.promise,
            ready.promise.then(submit)
        ])
        if (event.status !== status) {
            throw new Error(`unexpected status: ${event.status}`, { cause: event })
        }
        return {
            events,
            response,
            completion: event as Extract<ShowtimeCreationTerminalEvent, { status: S }>
        }
    } finally {
        sseClient.abort()
    }
}
