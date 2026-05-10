#!/usr/bin/env node
/**
 * 두 .heapsnapshot 파일을 streaming 으로 파싱해 class 별 node 개수/크기
 * 증가량을 출력한다. 1GB+ snapshot 도 처리.
 *
 * 사용법:
 *   node tests/snapshot-diff/diff.js <snap1> <snap2> [--user-only]
 *
 *   --user-only: V8 internal class (system / *) 를 빼고 user-defined class
 *                 (NestJS / mongoose 등) 만 본다.
 *
 * 주의: v8.writeHeapSnapshot 자체가 호출당 ~1GB RSS 누적 부수효과를 만든다.
 *       snapshot 으로 측정하면 측정 도구가 누수에 끼어든다 — 가설을 검증할
 *       때만 쓰고, 평소 누수 추적은 process.memoryUsage() 만으로 충분하다.
 */
const fs = require('fs')
const path = require('path')
const { parser } = require('stream-json')
const { streamArray } = require('stream-json/streamers/stream-array')
const { streamObject } = require('stream-json/streamers/stream-object')
const { pick } = require('stream-json/filters/pick')
const { chain } = require('stream-chain')

async function readMeta(file) {
    return new Promise((resolve, reject) => {
        const p = chain([
            fs.createReadStream(file),
            parser(),
            pick({ filter: 'snapshot.meta' }),
            streamObject()
        ])
        const m = {}
        p.on('data', ({ key, value }) => (m[key] = value))
        p.on('error', reject)
        p.on('end', () => resolve(m))
    })
}

async function readStrings(file) {
    return new Promise((resolve, reject) => {
        const p = chain([
            fs.createReadStream(file),
            parser(),
            pick({ filter: 'strings' }),
            streamArray()
        ])
        const out = []
        p.on('data', ({ value }) => out.push(value))
        p.on('error', reject)
        p.on('end', () => resolve(out))
    })
}

async function aggregate(file, meta, strings, userOnly) {
    const TI = meta.node_fields.indexOf('type')
    const NI = meta.node_fields.indexOf('name')
    const SI = meta.node_fields.indexOf('self_size')
    const NL = meta.node_fields.length
    const types = meta.node_types[0]
    return new Promise((resolve, reject) => {
        const p = chain([
            fs.createReadStream(file),
            parser(),
            pick({ filter: 'nodes' }),
            streamArray()
        ])
        const stats = new Map()
        let buf = []
        p.on('data', ({ value }) => {
            buf.push(value)
            if (buf.length === NL) {
                const t = types[buf[TI]]
                const n = strings[buf[NI]] ?? ''
                const sz = buf[SI]
                const skip =
                    userOnly &&
                    (t !== 'object' || !n || n.startsWith('system / ') || n === 'Object' || n === 'Array')
                if (!skip) {
                    const key = `${t}::${n}`
                    const cur = stats.get(key)
                    if (cur) {
                        cur.count += 1
                        cur.size += sz
                    } else {
                        stats.set(key, { count: 1, size: sz })
                    }
                }
                buf = []
            }
        })
        p.on('error', reject)
        p.on('end', () => resolve(stats))
    })
}

async function load(file, userOnly) {
    console.log(`  meta...`)
    const meta = await readMeta(file)
    console.log(`  strings...`)
    const strings = await readStrings(file)
    console.log(`  nodes (${strings.length} strings)...`)
    return aggregate(file, meta, strings, userOnly)
}

;(async () => {
    const args = process.argv.slice(2)
    const userOnly = args.includes('--user-only')
    const files = args.filter((a) => a !== '--user-only')
    if (files.length !== 2) {
        console.error('usage: diff.js <snap1> <snap2> [--user-only]')
        process.exit(1)
    }
    const [f1, f2] = files
    console.log(`load ${path.basename(f1)}`)
    const a = await load(f1, userOnly)
    console.log(`load ${path.basename(f2)}`)
    const b = await load(f2, userOnly)
    const out = []
    const keys = new Set([...a.keys(), ...b.keys()])
    for (const k of keys) {
        const av = a.get(k) ?? { count: 0, size: 0 }
        const bv = b.get(k) ?? { count: 0, size: 0 }
        const dC = bv.count - av.count
        const dS = bv.size - av.size
        if (dS === 0 && dC === 0) continue
        out.push({ key: k, dC, dS, aC: av.count, bC: bv.count })
    }
    out.sort((x, y) => y.dS - x.dS)
    const mb = (n) => (n / 1024 / 1024).toFixed(2) + 'MB'
    const label = userOnly ? 'user-class' : 'all-class'
    console.log(`\n=== Top 50 ${label} increases by size ===`)
    console.log('  +size       +count   aCount   bCount   key')
    for (const { key, dC, dS, aC, bC } of out.slice(0, 50)) {
        console.log(
            `  ${mb(dS).padStart(9)}   ${String(dC).padStart(7)}   ${String(aC).padStart(6)}   ${String(bC).padStart(6)}   ${key}`
        )
    }
})().catch((e) => {
    console.error(e)
    process.exit(1)
})
