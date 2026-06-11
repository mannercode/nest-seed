// @mannercode/* 워크스페이스 패키지는 node_modules에 심볼릭 링크로만 존재한다.
// tsc 출력을 그대로 배포하면 런타임 이미지에 각 libs의 manifest와 빌드 산출물, 링크 구조까지 복사해야 한다.
// 그래서 @mannercode/*는 번들에 흡수하고 서드파티만 external로 남긴다. 예외인 temporal-sandbox는 Dockerfile 주석을 본다.
const path = require('path')
const nodeExternals = require('webpack-node-externals')

module.exports = (options) => {
    const dirname = path.dirname(options.entry)
    const appDir = process.cwd()

    if (options.module?.rules) {
        for (const rule of options.module.rules) {
            if (Array.isArray(rule.use)) {
                for (const loader of rule.use) {
                    if (loader.loader === 'ts-loader') {
                        loader.options = {
                            ...loader.options,
                            transpileOnly: true,
                            ignoreDiagnostics: [5011]
                        }
                    }
                }
            }
        }
    }

    return {
        ...options,
        entry: path.resolve(dirname, 'main.ts'),
        output: { path: path.resolve(appDir, '_output/dist'), filename: 'index.js' },
        externals: [nodeExternals({ modulesFromFile: true, allowlist: [/^@mannercode\//] })],
        // 번들이 단일 파일이라 소스맵이 없으면 운영 에러 스택이 index.js의 수만 번째 줄로 찍힌다.
        // node --enable-source-maps(Dockerfile CMD)가 이 맵을 읽어 TS 소스 위치로 되돌린다.
        devtool: 'source-map'
    }
}
