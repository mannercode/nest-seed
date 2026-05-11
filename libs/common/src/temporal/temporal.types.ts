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
     * 빌드 단계에서 `bundleWorkflowCode`가 만든 번들 파일의 경로. webpack
     * 이 앱을 한 파일로 묶는 운영 환경에서는 워크플로우 소스 경로를 런타임에
     * 다시 해석할 수 없습니다. 그래서 미리 만들어 둔 번들을 사용하는 편이 안전합니다.
     * 파일이 없으면 `workflowsPath`를 보고 런타임에 번들을 생성하는 경로로
     * 넘어갑니다.
     */
    workflowBundlePath?: string
    /**
     * 워크플로우 소스 파일의 경로. 소스 트리가 그대로 있는 dev와 테스트
     * 환경에서 사용합니다. `workflowBundlePath`가 미리 만든 번들을 가리키고 있다면
     * 비워 두어도 됩니다.
     */
    workflowsPath?: string
}
