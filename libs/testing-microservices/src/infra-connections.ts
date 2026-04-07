function envString(key: string): string {
    const value = process.env[key]
    if (!value) throw new Error(`Environment variable ${key} is not defined`)
    return value
}

export function getNatsTestConnection() {
    return JSON.parse(envString('TESTLIB_NATS_OPTIONS'))
}

export function getTemporalTestConnection() {
    return envString('TESTLIB_TEMPORAL_ADDRESS')
}
