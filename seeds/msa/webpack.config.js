const path = require('path')

module.exports = (options) => {
    const dirname = path.dirname(options.entry)
    const basename = path.basename(dirname)

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
        output: {
            path: path.resolve(__dirname, `./_output/dist/${basename}`),
            filename: 'index.js'
        }
    }
}
