process.env.NODE_ENV = 'development'

const { bootstrap } = await import('./bootstrap.js')
await bootstrap()
