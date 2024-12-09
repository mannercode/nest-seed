const path = require('path')

module.exports = (options) => ({
    ...options,
    entry: path.resolve(__dirname, './src/app/production.ts'),
    output: {
        path: path.resolve(__dirname, './_output/dist'),
        filename: 'index.js'
    }
})
