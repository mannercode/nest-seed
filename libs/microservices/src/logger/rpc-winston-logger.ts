/* istanbul ignore file */
import { styleText } from 'node:util'
import type { RpcErrorLog, RpcSuccessLog } from './types'

export function formatRpcLogMessage(
    message: string,
    level: string,
    timestamp: string,
    logDetails: RpcErrorLog | RpcSuccessLog
) {
    const { request } = logDetails
    const coloredSubject = styleText('green', String(request.subject))
    const coloredData = styleText('blueBright', JSON.stringify(request.data, null, 2))

    return `${timestamp} ${level} RPC ${message} ${coloredSubject} ${coloredData}`
}
