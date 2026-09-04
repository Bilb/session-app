#!/usr/bin/env node
import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, rmSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'

/**
 * The wire format's C++ classes.
 *
 * Here rather than in packages/proto because that package is platform-neutral by rule — no node
 * builtins, checked by `pnpm boundaries` — and this shells out to a compiler. It is tooling that
 * happens to be about proto, not part of it.
 *
 * CMake generates its own copy when it builds the shim, which covers the Node addon and the
 * Android library. iOS has no CMake in the loop — CocoaPods compiles the sources directly — so
 * the classes have to exist on disk before `pod install`, and this is what puts them there.
 *
 * Not committed, for the reason in ARCHITECTURE's decision log: committing them would put a
 * pinned protoc on the per-PR job, which compiles no C++ at all.
 */

const repoRoot = fileURLToPath(new URL('..', import.meta.url))
const protoDir = join(repoRoot, 'packages/proto/proto')
const outDir = join(repoRoot, 'packages/proto/gen-cpp')

/**
 * The runtime the generated code will be compiled against, read from the submodule so it cannot
 * drift from the pin. Protobuf's generated code asserts its runtime version, so a mismatch is a
 * compile error deep inside a generated header rather than anything that names a version.
 */
function expectedVersion() {
  const json = readFileSync(
    join(repoRoot, 'libsession-util/external/protobuf/version.json'),
    'utf8',
  )
  const match = /"cpp"\s*:\s*"(\d+\.\d+)/.exec(json)
  if (!match?.[1]) throw new Error('could not read the vendored protobuf version')
  return match[1]
}

function protocPath() {
  const explicit = process.env['SESSION_BRIDGE_PROTOC']
  if (explicit) return explicit

  const want = expectedVersion()
  const candidates = ['protoc']

  // Keg-only on macOS, so it is never on PATH even when installed.
  try {
    const prefix = execFileSync('brew', ['--prefix', 'protobuf@21'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim()
    candidates.push(join(prefix, 'bin/protoc'))
  } catch {
    // No brew, or the formula is not installed. Either is fine.
  }

  for (const candidate of candidates) {
    try {
      const reported = execFileSync(candidate, ['--version'], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
      })
      const found = /(\d+\.\d+)/.exec(reported)?.[1]
      if (found === want) return candidate
    } catch {
      // Not there, or not runnable.
    }
  }

  throw new Error(
    `No protoc ${want}.x found, which is what libsession's bundled protobuf needs.\n` +
      `  Set SESSION_BRIDGE_PROTOC, or:\n` +
      `    macOS: brew install protobuf@21\n` +
      `    Debian/Ubuntu: protobuf-compiler is ${want} on trixie and later`,
  )
}

const protoc = protocPath()
rmSync(outDir, { recursive: true, force: true })
mkdirSync(outDir, { recursive: true })

for (const name of ['types', 'commands', 'frames']) {
  execFileSync(protoc, [
    `--proto_path=${protoDir}`,
    `--cpp_out=${outDir}`,
    `sessionbridge/v1/${name}.proto`,
  ])
}

console.log(`generated C++ into packages/proto/gen-cpp with ${protoc}`)
