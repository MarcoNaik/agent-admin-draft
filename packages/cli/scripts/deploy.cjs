#!/usr/bin/env node
const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')

const version = process.argv[2]
const message = process.argv[3] || `chore(cli): release v${version}`

if (!version) {
  console.error('Usage: node scripts/deploy.cjs <version> [commit-message]')
  console.error('Example: node scripts/deploy.cjs 0.2.11 "feat(cli): add new feature"')
  process.exit(1)
}

if (!/^\d+\.\d+\.\d+(-[\w.]+)?$/.test(version)) {
  console.error('Invalid version format. Use semver (e.g., 0.2.11)')
  process.exit(1)
}

const run = (cmd, opts = {}) => {
  console.log(`\n$ ${cmd}`)
  execSync(cmd, { stdio: 'inherit', ...opts })
}

try {
  run(`node scripts/bump-version.cjs ${version}`)
  run('bun run build')
  run('git add -A')
  run(`git commit -m "${message}"`)
  run(`git tag cli-v${version}`)
  run('git push')
  run('git push --tags')
  run('npm publish')
  console.log(`\n✓ Successfully deployed @struere/cli@${version}`)
} catch (err) {
  console.error('\nDeploy failed:', err.message)
  process.exit(1)
}
