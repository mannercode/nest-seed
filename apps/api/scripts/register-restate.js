const adminUrl = requiredEnvironment('RESTATE_ADMIN_URL')
const servicePort = requiredEnvironment('RESTATE_SERVICE_PORT')
const containerName = requiredEnvironment('COMPOSE_PROJECT_NAME')
const deploymentUri = `http://${containerName}:${servicePort}`

register().catch((error) => {
    console.error(error)
    process.exitCode = 1
})

async function register() {
    for (let attempt = 1; attempt <= 60; attempt += 1) {
        try {
            const response = await fetch(`${adminUrl}/deployments`, {
                body: JSON.stringify({ force: true, uri: deploymentUri, use_http_11: false }),
                headers: { 'content-type': 'application/json' },
                method: 'POST'
            })

            if (response.ok) {
                console.log(`Restate endpoint registered: ${deploymentUri}`)
                return
            }

            const detail = await response.text()
            if (attempt === 60) throw new Error(`Restate registration failed: ${detail}`)
        } catch (error) {
            if (attempt === 60) throw error
        }

        await new Promise((resolve) => setTimeout(resolve, 1_000))
    }
}

function requiredEnvironment(name) {
    const value = process.env[name]
    if (!value) throw new Error(`${name} must be defined.`)
    return value
}
