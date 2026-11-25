import type { OnModuleDestroy } from '@nestjs/common'

export abstract class ConnectionRegistry<T> implements OnModuleDestroy {
    private readonly connections = new Set<T>()
    private closing?: Promise<void>

    add(connection: T) {
        this.connections.add(connection)
    }

    protected abstract close(connection: T): Promise<unknown>

    onModuleDestroy(): Promise<void> {
        this.closing ??= this.closeConnections().finally(() => {
            this.closing = undefined
        })
        return this.closing
    }

    private async closeConnections() {
        const results = await Promise.allSettled(
            Array.from(this.connections, async (connection) => {
                await this.close(connection)
                this.connections.delete(connection)
            })
        )
        const failures = results.filter((result) => result.status === 'rejected')
        if (failures.length) {
            throw new AggregateError(
                failures.map((failure) => failure.reason),
                'Connection shutdown failed'
            )
        }
    }
}
