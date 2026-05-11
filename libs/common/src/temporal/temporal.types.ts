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
     * 빌드 단계에서 `bundleWorkflowCode` 가 만든 번들 파일의 경로. webpack
     * 이 앱을 한 파일로 묶는 운영 환경에서는 워크플로우 소스 경로를 런타임에
     * 다시 풀 수 없다. 그래서 이 미리 만들어 둔 번들을 쓰는 쪽이 안전하다.
     * 파일이 없으면 `workflowsPath` 를 보고 런타임에 번들을 만드는 쪽으로
     * 넘어간다.
     */
    workflowBundlePath?: string
    /**
     * 워크플로우 소스 파일의 경로. 소스 트리가 그대로 있는 dev 와 테스트
     * 환경에서 쓴다. `workflowBundlePath` 가 미리 만든 번들을 가리키고 있다면
     * 비워 두어도 된다.
     */
    workflowsPath?: string
}
