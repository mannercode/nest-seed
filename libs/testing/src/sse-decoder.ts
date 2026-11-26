type SseMessage = { data?: string; event?: string; id?: number }

export class SseDecoder {
    private buffer = ''
    private previousChunkEndedWithCR = false

    constructor(private readonly onMessage: (message: SseMessage) => void) {}

    write(chunk: string) {
        // CR은 즉시 줄바꿈으로 처리하고, 다음 청크의 LF가 이어지면 한 번만 센다.
        if (this.previousChunkEndedWithCR && chunk.startsWith('\n')) chunk = chunk.slice(1)
        this.previousChunkEndedWithCR = chunk.endsWith('\r')
        this.buffer += chunk.replace(/\r\n?/g, '\n')

        let separator = this.buffer.indexOf('\n\n')
        while (separator !== -1) {
            const frame = this.buffer.slice(0, separator)
            this.buffer = this.buffer.slice(separator + 2)
            if (frame) this.dispatch(frame)
            separator = this.buffer.indexOf('\n\n')
        }
    }

    end() {
        if (this.buffer) this.dispatch(this.buffer)
        this.buffer = ''
    }

    private dispatch(frame: string) {
        const message: SseMessage = {}
        for (const line of frame.split('\n')) {
            const colon = line.indexOf(':')
            const field = colon === -1 ? line : line.slice(0, colon)
            let value = colon === -1 ? '' : line.slice(colon + 1)
            if (value.startsWith(' ')) value = value.slice(1)

            switch (field) {
                case 'data':
                    message.data = message.data === undefined ? value : `${message.data}\n${value}`
                    break
                case 'event':
                    message.event = value
                    break
                case 'id':
                    message.id = parseInt(value, 10)
                    break
            }
        }
        this.onMessage(message)
    }
}
