export type TemporalClientConfig = { address: string; namespace: string }

export type TemporalClientModuleAsyncOptions = {
    inject?: any[]
    useFactory: (...args: any[]) => TemporalClientConfig | Promise<TemporalClientConfig>
}

export type TemporalWorkerOptions = {
    activities: Record<string, (...args: any[]) => any>
    address: string
    namespace: string
    taskQueue: string
    /**
     * Path to a pre-built workflow bundle (output of `bundleWorkflowCode`
     * written to disk at build time). Preferred in production where
     * `require.resolve` against source paths fails after webpack rolls the
     * app into a single file. If the file is missing, falls back to
     * runtime bundling via `workflowsPath`.
     */
    workflowBundlePath?: string
    /**
     * Source path to the workflow file. Used at dev/test runtime where
     * the source tree is reachable. Optional when `workflowBundlePath`
     * points to an existing pre-built bundle.
     */
    workflowsPath?: string
}
