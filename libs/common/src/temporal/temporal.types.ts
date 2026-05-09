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
     * pre-built workflow bundle (build time 에 disk 에 써진
     * `bundleWorkflowCode` 의 출력) 의 경로. webpack 이 app 을 한 file 로
     * 말아버린 production 에서는 source path 에 대한 `require.resolve` 가
     * 실패하므로 이 쪽이 선호된다. file 이 없으면 `workflowsPath` 를 통한
     * runtime bundling 으로 fallback 한다.
     */
    workflowBundlePath?: string
    /**
     * workflow file 의 source path. source tree 가 닿는 dev/test runtime
     * 에서 쓴다. `workflowBundlePath` 가 이미 pre-built bundle 을 가리키는
     * 경우엔 optional 이다.
     */
    workflowsPath?: string
}
