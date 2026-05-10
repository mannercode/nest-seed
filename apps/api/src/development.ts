process.loadEnvFile('.env')
process.env.NODE_ENV = 'development'

void import('./bootstrap').then(({ bootstrap }) => bootstrap())
