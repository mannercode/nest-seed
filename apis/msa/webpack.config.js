const path = require('path')
const nodeExternals = require('webpack-node-externals')

// msa hosts multiple Nest apps under src/apps/<name>. Each entry is bundled
// to its own output directory keyed by the leaf folder name (e.g. cores).
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

    const outputDir = path.basename(dirname)

    return {
        ...options,
        entry: path.resolve(dirname, 'production.ts'),
        output: { path: path.resolve(appDir, '_output/dist', outputDir), filename: 'index.js' },
        externals: [nodeExternals({ modulesFromFile: true })]
    }
}
