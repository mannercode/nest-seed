const path = require('path')

module.exports = (options) => {
    const dirname = path.dirname(options.entry)
    const basename = path.basename(dirname)

    const output = {
        ...options,
        entry: path.resolve(dirname, 'production.ts'),
        output: {
            path: path.resolve(__dirname, `./_output/dist/${basename}`),
            filename: 'index.js'
        }
    }

    return output
}
