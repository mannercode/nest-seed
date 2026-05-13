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
        // `@mannercode/temporal-sandbox`는 Temporal SDK에 절대 경로(`payloadConverterPath`)를
        // 넘기는데, webpack이 인라인하면 그 안의 `__dirname`이 번들 출력 위치로 바뀌어 실제
        // 파일을 잃는다. external로 두면 node_modules의 원래 위치가 보존된다.
        externals: [
            ({ request }, callback) => {
                if (request && request.startsWith('@mannercode/temporal-sandbox')) {
                    return callback(null, `commonjs ${request}`)
                }
                callback()
            },
            nodeExternals({ modulesFromFile: true, allowlist: [/^@mannercode\//] })
        ]
    }
}
