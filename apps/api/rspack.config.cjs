// Nest CLI의 기본 Rspack 규칙은 builtin:swc-loader를 사용한다.
// 이 프로젝트는 TypeScript compiler가 decorator metadata를 생성하도록 TS 규칙을 통째로 교체한다.
const path = require('node:path')
const nodeExternals = require('webpack-node-externals')

module.exports = (options) => {
    const dirname = path.dirname(options.entry)
    const appDir = __dirname
    const tsconfig = path.resolve(appDir, 'tsconfig.build.json')
    const typescriptRule = options.module.rules.find((rule) =>
        rule.use?.some((loader) => loader.loader === 'builtin:swc-loader')
    )
    if (!typescriptRule) throw new Error('Nest Rspack TypeScript rule was not found')

    return {
        ...options,
        context: appDir,
        entry: path.resolve(dirname, 'main.ts'),
        module: {
            ...options.module,
            rules: options.module.rules.map((rule) =>
                rule === typescriptRule
                    ? {
                          ...rule,
                          use: [
                              {
                                  loader: require.resolve('ts-loader'),
                                  options: { configFile: tsconfig, transpileOnly: true }
                              }
                          ]
                      }
                    : rule
            )
        },
        // Rspack native tsconfig resolver 하나만 사용한다. Nest 기본값이 함께 넣는
        // Webpack resolver plugin은 같은 paths를 중복 해석하므로 이 경로에서는 필요 없다.
        resolve: { ...options.resolve, tsConfig: tsconfig, plugins: [] },
        output: {
            ...options.output,
            path: path.resolve(appDir, '_output/dist'),
            filename: 'index.js'
        },
        externals: [
            nodeExternals({
                modulesFromFile: true,
                allowlist: [/^@mannercode\//],
                ...(options.output?.module && { importType: 'module' })
            }),
            ...options.externals.slice(1)
        ],
        // 번들이 단일 파일이라 소스맵이 없으면 운영 에러 스택이 index.js의 수만 번째 줄로 찍힌다.
        // node --enable-source-maps(Dockerfile CMD)가 이 맵을 읽어 TS 소스 위치로 되돌린다.
        devtool: 'source-map'
    }
}
