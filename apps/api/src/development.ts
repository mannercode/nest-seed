process.loadEnvFile('.env')
process.env.NODE_ENV = 'development'

void import('./bootstrap-app').then(({ bootstrapApp }) => bootstrapApp())
