const path = require('path')

module.exports = (options) => {
    const dirname = path.dirname(options.entry)

    return {
        ...options,
        entry: path.resolve(dirname, 'production.ts'),
        output: {
            path: path.resolve(__dirname, './_output/dist'),
            filename: 'index.js'
        }
    }
}
