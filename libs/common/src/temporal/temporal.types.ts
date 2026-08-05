export type TemporalClientConfig = { address: string; namespace: string }

export type TemporalClientModuleAsyncOptions = {
    inject?: any[]
    useFactory: (...args: any[]) => TemporalClientConfig | Promise<TemporalClientConfig>
}

export type TemporalWorkerOptions = {
    activities: Record<string, (...args: any[]) => any>
    address: string
    maxConcurrentActivityTaskExecutions?: number
    maxConcurrentActivityTaskPolls?: number
    maxConcurrentWorkflowTaskExecutions?: number
    maxConcurrentWorkflowTaskPolls?: number
    namespace: string
    taskQueue: string
    workflowBundlePath: string
}
