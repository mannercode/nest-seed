process.env.NODE_ENV = 'development'

import('./bootstrap')
    .then(({ bootstrap }) => bootstrap())
    .catch((err: unknown) => {
        console.error(err)
        process.exit(1)
    })
