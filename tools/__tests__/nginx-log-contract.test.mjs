import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

const root = join(dirname(fileURLToPath(import.meta.url)), '../..')

test('NGINX access logs exclude query strings', async () => {
    const nginx = await readFile(join(root, 'deploy/nginx.conf'), 'utf8')
    const format = nginx.match(/log_format ecs_json[\s\S]*?\n\s*'\}';/)?.[0]

    assert.ok(format, 'ecs_json log format must exist')
    assert.match(format, /"message":"\$request_method \$uri \$server_protocol"/)
    assert.match(format, /"url\.path":"\$uri"/)
    assert.doesNotMatch(format, /(?:^|[^A-Za-z0-9_])\$request(?![A-Za-z0-9_])/m)
    assert.doesNotMatch(format, /\$request_uri\b/)
    assert.doesNotMatch(format, /\$(?:arg_[A-Za-z0-9_]+|args|is_args|query_string)\b/)
    assert.doesNotMatch(format, /"url\.original":/)
})
