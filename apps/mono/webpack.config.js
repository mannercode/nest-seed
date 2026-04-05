const path = require('path')
const nodeExternals = require('webpack-node-externals')

module.exports = (options) => {
    const dirname = path.dirname(options.entry)

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
        entry: path.resolve(dirname, 'production.ts'),
        output: { path: path.resolve(__dirname, './_output/dist'), filename: 'index.js' },
        externals: [nodeExternals({ modulesFromFile: true, allowlist: [/^@mannercode/] })]
    }
}
