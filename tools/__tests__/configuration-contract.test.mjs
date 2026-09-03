import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { glob, readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath, pathToFileURL } from 'node:url'
import test from 'node:test'

const root = join(dirname(fileURLToPath(import.meta.url)), '../..')
const require = createRequire(import.meta.url)
const read = (path) => readFile(join(root, path), 'utf8')

test('workspace keeps explicit package and install safety policy', async () => {
    const packageJson = JSON.parse(await read('package.json'))
    const workspace = await read('pnpm-workspace.yaml')

    assert.match(packageJson.packageManager, /^pnpm@\d+\.\d+\.\d+$/)
    assert.equal(packageJson.workspaces, undefined)
    for (const [script, mode] of [
        ['test', 'test'],
        ['atoz', 'atoz'],
        ['e2e', 'e2e'],
        ['race', 'race'],
        ['benchmark:api', 'benchmark']
    ]) {
        assert.equal(packageJson.scripts[script], `node tests/run-and-report.mjs ${mode}`)
    }
    assert.match(workspace, /^saveExact: true$/m)
    assert.match(workspace, /^strictDepBuilds: true$/m)
})

test('workspaces share the Nest Oxlint baseline', async () => {
    const rootPackage = JSON.parse(await read('package.json'))
    const oxlint = JSON.parse(
        execFileSync('pnpm', ['exec', 'oxlint', '--print-config', '-c', 'oxlint.json'], {
            cwd: root,
            encoding: 'utf8'
        })
    )
    const workspacePackages = await Promise.all(
        [
            'apps/api/package.json',
            'apps/console/package.json',
            'apps/user-app/package.json',
            'libs/common/package.json',
            'libs/testing/package.json',
            'tests/api-race/package.json',
            'tests/web/package.json'
        ].map(async (path) => JSON.parse(await read(path)))
    )

    assert.equal(rootPackage.devDependencies.oxlint, '1.80.0')
    assert.equal(rootPackage.devDependencies.eslint, undefined)
    assert.equal(oxlint.env.node, true)
    assert.equal(oxlint.options.denyWarnings, true)
    assert.equal(oxlint.rules['typescript/no-explicit-any'], 'allow')
    assert.equal(oxlint.rules['typescript/no-floating-promises'], 'warn')
    for (const packageJson of workspacePackages) {
        assert.match(packageJson.scripts.lint, /oxlint -c \.\.\/\.\.\/oxlint\.json/)
    }
})

test('devcontainer avoids redundant version probes while keeping project installs locked', async () => {
    const config = await read('.devcontainer/devcontainer.json')
    const dockerfile = await read('.devcontainer/Dockerfile')
    const plantumlCompose = await read('.devcontainer/compose.plantuml.yml')
    const dependabot = await read('.github/dependabot.yml')
    const dockerignore = await read('.dockerignore')
    const lock = JSON.parse(await read('.devcontainer/devcontainer-lock.json'))

    assert.match(config, /"build"\s*:\s*\{[^}]*"context"\s*:\s*"\.\."/)
    assert.doesNotMatch(dockerignore, /^!\/tests\/web(?:\/|$)/m)
    assert.match(
        config,
        /"postStartCommand"\s*:\s*\{\s*"workspace-dependencies"\s*:\s*"pnpm install --frozen-lockfile"/
    )
    assert.doesNotMatch(
        config,
        /updateContentCommand|postCreateCommand|playwright install chromium/
    )
    assert.match(config, /source=\$\{localEnv:HOME\}\/\.codex,target=\/home\/node\/\.codex/)
    assert.match(
        config,
        /source=\$\{localEnv:HOME\}\/\.config\/gh,target=\/home\/node\/\.config\/gh/
    )
    assert.match(config, /source=\$\{localEnv:HOME\}\/\.claude,target=\/home\/node\/\.claude/)
    assert.doesNotMatch(config, /initialize-user-state\.sh|initialize-docker\.sh|devcontainerId/)
    assert.match(config, /"dockerDashComposeVersion"\s*:\s*"none"/)
    assert.match(
        config,
        /"--network=\$\{localEnv:USER:unknown\}-\$\{localWorkspaceFolderBasename\}"/
    )
    assert.match(
        config,
        /"project-network"\s*:\s*"n=\$\{localEnv:USER:unknown\}-\$\{localWorkspaceFolderBasename\}; docker network inspect \\"\$n\\" >\/dev\/null 2>&1 \|\| docker network create \\"\$n\\" >\/dev\/null"/
    )
    assert.doesNotMatch(config, /"--network=plantuml"/)
    assert.match(config, /"forwardPorts"\s*:\s*\[5010\]/)
    assert.match(config, /"plantuml\.server"\s*:\s*"http:\/\/plantuml:8080\/"/)
    assert.doesNotMatch(config, /java -jar|picoweb/)
    assert.doesNotMatch(config, /portsAttributes|plantuml-relay|start-plantuml-relay/)
    assert.ok(
        config.includes('"plantuml": "docker compose -f .devcontainer/compose.plantuml.yml up -d"')
    )
    assert.doesNotMatch(
        config,
        /docker (?:container inspect plantuml|network inspect plantuml|network (?:connect|disconnect))|docker run[^"\n]*plantuml/
    )
    assert.match(
        plantumlCompose,
        /^\s+image: plantuml\/plantuml-server:jetty-v\d+\.\d+\.\d+@sha256:[a-f0-9]{64}$/m
    )
    assert.match(plantumlCompose, /^\s+container_name: \$\{COMPOSE_PROJECT_NAME\}-plantuml$/m)
    assert.match(plantumlCompose, /^\s+restart: unless-stopped$/m)
    assert.match(plantumlCompose, /^\s+name: \$\{COMPOSE_PROJECT_NAME\}$/m)
    assert.match(plantumlCompose, /^\s+external: true$/m)
    assert.doesNotMatch(plantumlCompose, /^\s+ports:/m)
    assert.match(
        dependabot,
        /package-ecosystem: docker-compose[\s\S]*?directories:\s*\n\s+- '\/\.devcontainer'/
    )
    assert.match(dockerfile, /^# syntax=docker\/dockerfile:1$/m)
    assert.match(dockerfile, /^FROM node:\d+\.\d+\.\d+-bookworm-slim@sha256:[a-f0-9]{64}$/m)
    assert.doesNotMatch(dockerfile, /^ARG [A-Z_]+_VERSION=/m)
    assert.match(
        dockerfile,
        /deb \[signed-by=\/usr\/share\/keyrings\/cloudflare-main\.gpg\] https:\/\/pkg\.cloudflare\.com\/cloudflared any main/
    )
    assert.doesNotMatch(dockerfile, /\bk6\b/)
    assert.doesNotMatch(dockerfile, /plantuml|default-jre|graphviz|\bsocat\b/)
    assert.doesNotMatch(dockerfile, /github\.com\/cloudflare\/cloudflared\/releases/)
    assert.doesNotMatch(dockerfile, /playwright|chromium|ms-playwright|tests\/web/i)
    assert.doesNotMatch(dockerfile, /^COPY (?:tests\/web\/)?package\.json /m)
    assert.doesNotMatch(dockerfile, /workspace-package|package_manager=.*\.packageManager/)
    assert.match(dockerfile, /^RUN npm install -g pnpm$/m)
    assert.doesNotMatch(dockerfile, /npm-cache/)
    assert.doesNotMatch(dockerfile, /\bxz-utils\b/)
    for (const versionProbe of [
        'node --version',
        'npm --version',
        'curl --version',
        'git --version',
        'ip -Version',
        'jq --version',
        'shellcheck --version',
        'shfmt -version',
        'ssh -V',
        'tmux -V',
        'tree --version',
        'unzip -v',
        'xz --version',
        'playwright --version',
        'java -jar /opt/plantuml.jar -version',
        'lychee --version',
        'k6 version',
        'cloudflared --version',
        'pnpm --version'
    ]) {
        assert.equal(dockerfile.includes(versionProbe), false, `redundant probe: ${versionProbe}`)
    }
    const configuredFeatures = Array.from(
        config.matchAll(/^\s*"(ghcr\.io\/[^"]+)"\s*:\s*\{/gm),
        ([, feature]) => feature
    )
    assert.deepEqual(Object.keys(lock.features).sort(), configuredFeatures.sort())
    for (const feature of Object.values(lock.features)) {
        assert.match(feature.resolved, /@sha256:[a-f0-9]{64}$/)
        assert.match(feature.integrity, /^sha256:[a-f0-9]{64}$/)
    }
})

test('API benchmark runs the pinned official k6 container', async () => {
    const compose = await read('deploy/compose.yml')
    const launcher = await read('tests/api-benchmark/run-k6.sh')
    const runners = await Promise.all(
        ['tests/api-benchmark/runner.sh', 'tests/api-benchmark/mixed-runner.sh'].map(read)
    )

    assert.match(compose, /image: grafana\/k6:\d+\.\d+\.\d+@sha256:[a-f0-9]{64}/)
    assert.match(compose, /profiles: \[benchmark\]/)
    assert.match(launcher, /docker compose[^\n]+--project-directory/)
    assert.match(launcher, /--user "\$\(id -u\):\$\(id -g\)"/)
    for (const runner of runners) {
        assert.match(runner, /run-k6\.sh/)
        assert.doesNotMatch(runner, /\bk6 run\b/)
    }
})

test('web E2E runs production app images from a pinned official Playwright runner', async () => {
    const packageJson = JSON.parse(await read('tests/web/package.json'))
    const packageLock = JSON.parse(await read('tests/web/package-lock.json'))
    const runnerDockerfile = await read('tests/web/Dockerfile')
    const compose = await read('tests/web/compose.yml')
    const launcher = await read('tests/web/run-e2e.sh')
    const config = await read('tests/web/playwright.config.ts')
    const dependabot = await read('.github/dependabot.yml')
    const nextConfigs = await Promise.all(
        ['apps/console/next.config.mjs', 'apps/user-app/next.config.mjs'].map(read)
    )
    const appDockerfiles = await Promise.all(
        ['apps/console/Dockerfile', 'apps/user-app/Dockerfile'].map(read)
    )

    const image = runnerDockerfile.match(
        /^FROM mcr\.microsoft\.com\/playwright:v(\d+\.\d+\.\d+)-noble@sha256:[a-f0-9]{64}$/m
    )
    assert.ok(image, 'Playwright image must pin an exact version and digest')
    assert.equal(image[1], packageJson.devDependencies['@playwright/test'])
    assert.equal(packageLock.lockfileVersion, 3)
    assert.deepEqual(packageLock.packages[''].devDependencies, packageJson.devDependencies)
    assert.equal(
        packageLock.packages['node_modules/@playwright/test'].version,
        packageJson.devDependencies['@playwright/test']
    )
    assert.match(runnerDockerfile, /RUN npm ci --ignore-scripts --no-audit --no-fund/)
    assert.match(
        runnerDockerfile,
        /ENTRYPOINT \["node", "node_modules\/@playwright\/test\/cli\.js", "test"\]/
    )
    assert.doesNotMatch(runnerDockerfile, /playwright install|pnpm/)

    for (const service of ['api', 'console', 'user-app']) {
        assert.match(compose, new RegExp(`dockerfile: apps/${service}/Dockerfile`))
    }
    assert.match(compose, /^\s+init: true$/m)
    assert.match(compose, /^\s+ipc: host$/m)
    assert.match(compose, /^\s+user: \$\{E2E_UID:\?}:\$\{E2E_GID:\?}$/m)
    assert.match(compose, /CONSOLE_BASE_URL: http:\/\/console:\$\{CONSOLE_PORT:\?}/)
    assert.match(compose, /USER_APP_BASE_URL: http:\/\/user-app:\$\{USER_APP_PORT:\?}/)
    assert.match(compose, /^\s+name: \$\{DEVCONTAINER_NETWORK:\?}$/m)
    assert.match(compose, /^\s+external: true$/m)
    assert.match(compose, /127\.0\.0\.1:9323:9323/)
    assert.doesNotMatch(compose, /docker\.sock/)

    assert.match(launcher, /--project-name "\$\{COMPOSE_PROJECT_NAME\}-web"/)
    assert.match(launcher, /build api console user-app playwright/)
    assert.match(launcher, /up --detach --no-build --wait api console user-app/)
    assert.match(launcher, /run "\$\{run_options\[@\]\}" playwright/)
    assert.match(launcher, /down -t 0/)
    assert.match(packageJson.scripts['e2e:ui'], /--ui-port=9323/)
    assert.doesNotMatch(config, /webServer|reuseExistingServer|localhost|WORKSPACE_ROOT/)
    for (const environment of ['API_BASE_URL', 'CONSOLE_BASE_URL', 'USER_APP_BASE_URL']) {
        assert.match(config, new RegExp(`requiredEnvironment\\('${environment}'\\)`))
    }

    for (const nextConfig of nextConfigs) assert.match(nextConfig, /output: 'standalone'/)
    for (const dockerfile of appDockerfiles) {
        assert.match(dockerfile, /\.next\/standalone/)
        assert.match(dockerfile, /^USER node$/m)
        assert.match(dockerfile, /^RUN npm install -g pnpm$/m)
        assert.doesNotMatch(dockerfile, /workspace-package|packageManager|pnpm@\d|pnpm --version/)
    }
    for (const directory of ['/apps/console', '/apps/user-app', '/tests/web']) {
        assert.match(dependabot, new RegExp(`- '${directory}'`))
    }
})

test('API image uses BuildKit cache and deploys only its production workspace', async () => {
    const dockerfile = await read('apps/api/Dockerfile')
    const compose = await read('deploy/compose.yml')

    assert.match(dockerfile, /^# syntax=docker\/dockerfile:1$/m)
    assert.doesNotMatch(dockerfile, /pnpm@\d/)
    assert.match(dockerfile, /--mount=type=cache[^\n]+target=\/pnpm\/store/)
    assert.match(
        dockerfile,
        /pnpm install[^\n]+--filter '\.\/apps\/api\.\.\.'[^\n]+--filter '\.\/libs\/common'/
    )
    assert.match(dockerfile, /--fail-if-no-match deploy --prod --legacy/)
    assert.doesNotMatch(dockerfile + compose, /nest-seed-deps|DEPS_TAG/)
})

test('backend workspaces use Node ESM and Vitest keeps the TypeScript metadata transform', async () => {
    const typescript = require('typescript')
    const rootTsconfig = typescript.parseConfigFileTextToJson(
        'tsconfig.json',
        await read('tsconfig.json')
    ).config
    const apiPackage = JSON.parse(await read('apps/api/package.json'))
    const commonPackage = JSON.parse(await read('libs/common/package.json'))
    const testingPackage = JSON.parse(await read('libs/testing/package.json'))
    const parseTypeScriptConfig = (path) =>
        typescript.getParsedCommandLineOfConfigFile(
            join(root, path),
            {},
            {
                ...typescript.sys,
                onUnRecoverableConfigFileDiagnostic(diagnostic) {
                    assert.fail(
                        typescript.flattenDiagnosticMessageText(diagnostic.messageText, '\n')
                    )
                }
            }
        )

    assert.equal(rootTsconfig.compilerOptions.module, 'nodenext')
    assert.equal(rootTsconfig.compilerOptions.moduleResolution, 'nodenext')
    assert.equal(rootTsconfig.compilerOptions.rewriteRelativeImportExtensions, true)
    for (const packageJson of [apiPackage, commonPackage, testingPackage]) {
        assert.equal(packageJson.type, 'module')
    }
    assert.deepEqual(commonPackage.files, ['_output/dist'])
    assert.deepEqual(Object.keys(apiPackage.imports).sort(), [
        '#application',
        '#config',
        '#core',
        '#gateway',
        '#infrastructure',
        '#view'
    ])

    for (const path of [
        'apps/api/tsconfig.test.json',
        'libs/common/tsconfig.test.json',
        'libs/testing/tsconfig.test.json'
    ]) {
        const testTsconfig = parseTypeScriptConfig(path)
        assert.ok(testTsconfig)
        assert.equal(testTsconfig.options.module, typescript.ModuleKind.NodeNext)
        assert.equal(
            testTsconfig.options.moduleResolution,
            typescript.ModuleResolutionKind.NodeNext
        )
        assert.equal(testTsconfig.options.isolatedModules, true)
        assert.deepEqual([...testTsconfig.options.types].sort(), ['node', 'vitest/globals'])
    }

    // VS Code는 이름이 tsconfig.json인 가장 가까운 project를 자동 선택한다.
    // 편집용 project에는 테스트가 보여야 하고 실제 빌드에서는 빠져야 한다.
    for (const workspace of ['apps/api', 'libs/common', 'libs/testing']) {
        const editorTsconfig = parseTypeScriptConfig(`${workspace}/tsconfig.json`)
        const buildTsconfig = parseTypeScriptConfig(`${workspace}/tsconfig.build.json`)
        assert.ok(editorTsconfig)
        assert.ok(buildTsconfig)
        assert.ok(editorTsconfig.fileNames.some((path) => path.includes('/__tests__/')))
        assert.ok(buildTsconfig.fileNames.every((path) => !path.includes('/__tests__/')))
    }

    for (const packageJson of [apiPackage, commonPackage, testingPackage]) {
        assert.match(packageJson.scripts.test, /^vitest run/)
    }

    const { createVitestBase } = await import(
        pathToFileURL(join(root, 'vitest.config.base.mjs')).href
    )
    const vitestBase = createVitestBase({ tsconfigPath: join(root, 'apps/api/tsconfig.json') })
    assert.equal(vitestBase.oxc, false)

    const transformed = vitestBase.plugins[0].transform(
        "import { Injectable } from '@nestjs/common'\nclass Dependency {}\n@Injectable()\nexport class Fixture { constructor(readonly dependency: Dependency) {} }\n",
        join(root, 'apps/api/src/__tests__/metadata.fixture.ts')
    )
    assert.match(transformed.code, /from ['"]@nestjs\/common['"]/)
    assert.match(transformed.code, /__metadata\(['"]design:paramtypes['"]/)
    assert.doesNotMatch(transformed.code, /\brequire\s*\(/)
})

test('backend TypeScript relative specifiers include runtime extensions', async () => {
    const typescript = require('typescript')
    const files = await Array.fromAsync(
        glob('{apps/api/src,libs/common/src,libs/testing/src}/**/*.ts', { cwd: root })
    )

    for (const file of files) {
        const source = typescript.createSourceFile(
            file,
            await read(file),
            typescript.ScriptTarget.Latest,
            true
        )
        const visit = (node) => {
            let specifier
            if (
                (typescript.isImportDeclaration(node) || typescript.isExportDeclaration(node)) &&
                node.moduleSpecifier &&
                typescript.isStringLiteral(node.moduleSpecifier)
            ) {
                specifier = node.moduleSpecifier.text
            } else if (
                typescript.isCallExpression(node) &&
                node.expression.kind === typescript.SyntaxKind.ImportKeyword &&
                node.arguments.length === 1 &&
                typescript.isStringLiteral(node.arguments[0])
            ) {
                specifier = node.arguments[0].text
            }

            if (specifier?.startsWith('.')) {
                assert.match(specifier, /\.(?:[cm]?js|json)$/, `${file}: ${specifier}`)
            }
            typescript.forEachChild(node, visit)
        }
        visit(source)
    }
})

test('API request bodies and queries declare a Standard Schema', async () => {
    const typescript = require('typescript')
    const files = await Array.fromAsync(
        glob('apps/api/src/services/gateway/**/*.http-controller.ts', { cwd: root })
    )
    let requestDecoratorCount = 0

    for (const file of files) {
        const source = typescript.createSourceFile(
            file,
            await read(file),
            typescript.ScriptTarget.Latest,
            true
        )
        const visit = (node) => {
            if (typescript.isDecorator(node) && typescript.isCallExpression(node.expression)) {
                const call = node.expression
                const name = typescript.isIdentifier(call.expression)
                    ? call.expression.text
                    : undefined
                if (name === 'Body' || name === 'Query') {
                    requestDecoratorCount += 1
                    const hasSchema = call.arguments.some(
                        (argument) =>
                            typescript.isObjectLiteralExpression(argument) &&
                            argument.properties.some(
                                (property) =>
                                    typescript.isPropertyAssignment(property) &&
                                    typescript.isIdentifier(property.name) &&
                                    property.name.text === 'schema'
                            )
                    )
                    assert.equal(hasSchema, true, `${file}: @${name} must declare { schema }`)
                }
            }
            typescript.forEachChild(node, visit)
        }
        visit(source)
    }

    assert.ok(requestDecoratorCount > 0, 'no API request decorators were inspected')
})

test('API build preserves Nest Rspack ESM defaults and replaces only the SWC loader', async () => {
    const createConfig = require(join(root, 'apps/api/rspack.config.cjs'))
    class TypeCheckPlugin {}
    const defaults = {
        entry: join(root, 'apps/api/src/development.ts'),
        experiments: { outputModule: true },
        module: { rules: [{ type: 'javascript/esm', use: [{ loader: 'builtin:swc-loader' }] }] },
        output: { chunkFormat: 'module', module: true },
        externals: [() => undefined],
        resolve: {},
        plugins: [new TypeCheckPlugin()]
    }
    const config = createConfig(defaults)
    const loaders = config.module.rules.flatMap((rule) =>
        (Array.isArray(rule.use) ? rule.use : [rule.use]).filter(Boolean)
    )

    assert.equal(config.entry, join(root, 'apps/api/src/main.ts'))
    assert.equal(config.output.module, true)
    assert.equal(config.output.chunkFormat, 'module')
    assert.equal(config.experiments.outputModule, true)
    assert.deepEqual(
        loaders.map((loader) => (typeof loader === 'string' ? loader : loader.loader)),
        [require.resolve(join(root, 'apps/api/node_modules/ts-loader'))]
    )
    assert.equal(loaders[0].options.configFile, join(root, 'apps/api/tsconfig.build.json'))
    assert.deepEqual(loaders[0].options.compilerOptions, {
        module: 'ESNext',
        moduleResolution: 'Bundler'
    })
    assert.equal(loaders[0].options.transpileOnly, true)
    assert.doesNotMatch(JSON.stringify(config), /(?:builtin:)?swc-loader|@swc\//i)
})

test('network-facing deployment port binds only to loopback', async () => {
    assert.match(await read('deploy/compose.yml'), /127\.0\.0\.1:3000:80/)
})

test('local S3 service is internal-only and exposes a dedicated health endpoint', async () => {
    const s3Compose = await read('infra/compose.s3.yml')
    assert.doesNotMatch(s3Compose, /^\s*ports:/m)
    assert.match(s3Compose, /image:\s*\$\{S3_IMAGE\}/)
    assert.match(s3Compose, /VGW_HEALTH:\s*\/_\/health/)
    assert.match(s3Compose, /VGW_BACKEND:\s*posix/)
    assert.match(s3Compose, /-\s+s3_data:\/data/)
    assert.match(s3Compose, /wget -q -O \/dev\/null/)
    assert.doesNotMatch(s3Compose, /^\s*test:.*--spider/m)
    assert.doesNotMatch(s3Compose, /VGW_(?:ADMIN|WEBUI)_PORT/)
})

test('deployment base and infrastructure image references are digest-pinned', async () => {
    const infraEnv = await read('.env.infra')
    for (const line of infraEnv
        .split('\n')
        .filter((entry) => /^[A-Z_]+_IMAGE=/.test(entry) && !entry.startsWith('MONGO_IMAGE='))) {
        assert.match(line, /@sha256:[a-f0-9]{64}$/, `${line.split('=')[0]} must be digest-pinned`)
    }

    const mongoImage = infraEnv.match(/^MONGO_IMAGE=(.+)$/m)?.[1]
    const mongoDigest = infraEnv.match(/^MONGO_IMAGE_DIGEST=(.+)$/m)?.[1]
    assert.match(mongoImage ?? '', /^mongo:\d+\.\d+\.\d+$/)
    assert.match(mongoDigest ?? '', /^sha256:[a-f0-9]{64}$/)
    assert.match(`${mongoImage}@${mongoDigest}`, /^mongo:\d+\.\d+\.\d+@sha256:[a-f0-9]{64}$/)

    const mongoCompose = await read('infra/compose.mongo.yml')
    assert.equal(
        mongoCompose.match(/image: \$\{MONGO_IMAGE\}@\$\{MONGO_IMAGE_DIGEST\}/g)?.length,
        2,
        'Mongo services must compose the Testcontainers-compatible tag with its immutable digest'
    )

    const nodeBaseImages = []
    for (const dockerfile of [
        '.devcontainer/Dockerfile',
        'apps/api/Dockerfile',
        'apps/console/Dockerfile',
        'apps/user-app/Dockerfile'
    ]) {
        const contents = await read(dockerfile)
        const stages = new Set()
        for (const [, image, alias] of contents.matchAll(/^FROM\s+(\S+)(?:\s+AS\s+(\S+))?/gim)) {
            if (stages.has(image)) continue
            assert.match(image, /@sha256:[a-f0-9]{64}$/, `${dockerfile} base image must be pinned`)
            if (image.startsWith('node:')) nodeBaseImages.push(image)
            if (alias) stages.add(alias)
        }
    }
    assert.equal(nodeBaseImages.length, 6)
    assert.equal(
        new Set(nodeBaseImages).size,
        1,
        'devcontainer and app builds must use one Node tag and digest'
    )

    for (const compose of ['deploy/compose.yml', 'infra/compose.s3.yml', 'infra/compose.yml']) {
        const contents = await read(compose)
        for (const [, image] of contents.matchAll(/^\s*image:\s+([^$\s][^\s]*)/gm)) {
            if (image === 'nest-seed-api') continue
            assert.match(image, /@sha256:[a-f0-9]{64}$/, `${compose} image must be pinned`)
        }
    }
})

test('deployment logs stay on structured stdout with bounded Docker files', async () => {
    const deployCompose = await read('deploy/compose.yml')
    const nginx = await read('deploy/nginx.conf')

    assert.equal(
        deployCompose.match(
            /logging: \{ driver: json-file, options: \{ max-size: '10m', max-file: '3' \} \}/g
        )?.length,
        2
    )
    assert.doesNotMatch(deployCompose, /co\.elastic\.logs/)
    assert.match(nginx, /access_log \/dev\/stdout ecs_json/)
    assert.match(nginx, /error_log\s+\/dev\/stderr warn/)
    assert.match(nginx, /\/health 0/)
})

test('Restate keeps durable execution data on its named volume', async () => {
    const infraEnv = await read('.env.infra')
    assert.match(infraEnv, /^RESTATE_IMAGE=.+@sha256:[a-f0-9]{64}$/m)

    const restateCompose = await read('infra/compose.restate.yml')
    assert.match(restateCompose, /RESTATE_NODE_NAME: restate-1/)
    assert.match(restateCompose, /restate_data:\/restate-data/)
    assert.match(restateCompose, /http:\/\/localhost:9070\/health/)
    assert.match(restateCompose, /http:\/\/localhost:8080\/restate\/health/)
})

test('GitHub workflows pin actions, protect scheduled forks, and retain diagnostics', async () => {
    for (const workflow of [
        '.github/workflows/test-atoz.yaml',
        '.github/workflows/test-stability.yaml'
    ]) {
        const contents = await read(workflow)
        assert.doesNotMatch(contents, /uses:\s+[^\s]+@v\d/)
        assert.match(contents, /uses:\s+[^\s]+@[a-f0-9]{40}(?:\s+#\s+v[^\s]+)?/)
        assert.match(
            contents,
            /github\.event_name != 'schedule' \|\| github\.repository_id == '849585972' \|\| vars\.ENABLE_SCHEDULED_CI == 'true'/
        )
        assert.doesNotMatch(contents, /github\.repository ==/)
        assert.match(contents, /git diff --exit-code -- pnpm-lock\.yaml pnpm-workspace\.yaml/)
    }
    const atoz = await read('.github/workflows/test-atoz.yaml')
    assert.match(atoz, /_output\/test-reports\//)
    assert.match(atoz, /_output\/deploy-diagnostics/)
    assert.match(atoz, /_output\/ci-diagnostics/)
})

test('Stability preserves its scheduled repetition volume without building the bootup leg', async () => {
    const workflow = await read('.github/workflows/test-stability.yaml')
    const leg = (name) => {
        const marker = `- leg: ${name}`
        const start = workflow.indexOf(marker)
        assert.notEqual(start, -1, `${name} stability leg is missing`)
        const next = workflow.indexOf('\n                    - leg:', start + marker.length)
        return workflow.slice(start, next === -1 ? undefined : next)
    }

    assert.match(workflow, /cron: '27 \*\/6 \* \* \*'/)
    assert.match(leg('unit-libs'), /repeat\.sh 75 /)
    for (const name of ['unit-api-1', 'unit-api-2', 'unit-api-3']) {
        assert.match(leg(name), /timeout: 240/)
        assert.match(leg(name), /RESET_EVERY=5 bash \.github\/scripts\/repeat\.sh 20 /)
        assert.match(leg(name), /--filter '\.\/apps\/api'/)
    }

    const bootup = leg('bootup')
    assert.match(bootup, /repeat\.sh 50 bash infra\/reset\.sh/)
    assert.doesNotMatch(bootup, /pnpm run build/)

    for (const name of [
        'sse-fanout-race',
        'user-signup-race',
        'ticket-holding-race',
        'showtime-overlap-race',
        'purchase-double-spend',
        'purchase-overlap-race',
        'replica-chaos',
        'jwt-refresh-race'
    ]) {
        assert.match(leg(name), /repeat\.sh 50 /)
    }
})

test('Stability failure diagnostics stay inside the current Compose project', async () => {
    const repeat = await read('.github/scripts/repeat.sh')
    assert.equal(
        repeat.match(/--filter "label=com\.docker\.compose\.project=\$\{compose_project\}"/g)
            ?.length,
        2
    )
    assert.doesNotMatch(repeat, /docker stats -a/)
})
