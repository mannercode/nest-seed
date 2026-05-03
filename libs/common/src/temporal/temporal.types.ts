export type TemporalClientConfig = { address: string; namespace: string }

export type TemporalClientModuleAsyncOptions = {
    inject?: any[]
    useFactory: (...args: any[]) => TemporalClientConfig | Promise<TemporalClientConfig>
}

export type TemporalWorkerOptions = {
    address: string
    namespace: string
    taskQueue: string
    workflowsPath: string
    activities: Record<string, (...args: any[]) => any>
}
