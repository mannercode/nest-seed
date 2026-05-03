export const DEFAULT_TEMPORAL_CLIENT_NAME = 'default'

export function getTemporalClientToken(name?: string) {
    const clientName = name ?? DEFAULT_TEMPORAL_CLIENT_NAME
    return `TemporalClient:${clientName}`
}

export function getTemporalConnectionToken(name?: string) {
    const clientName = name ?? DEFAULT_TEMPORAL_CLIENT_NAME
    return `TemporalConnection:${clientName}`
}
