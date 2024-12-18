const path = require('path')

module.exports = (options) => {
    const dirname = path.dirname(options.entry)
    const basename = path.basename(dirname)

    const output = {
        ...options,
        entry: path.resolve(dirname, 'production.ts'),
        output: { filename: `../_output/dist/${basename}/index.js` }
    }

    console.log('Webpack options:', output)

    return output
}
