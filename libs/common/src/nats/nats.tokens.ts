export const DEFAULT_NATS_CONNECTION_NAME = 'default'

export function getNatsConnectionToken(name?: string) {
    const connectionName = name ?? DEFAULT_NATS_CONNECTION_NAME
    return `NatsConnection:${connectionName}`
}
