#!/usr/bin/env node
const fs = require('fs')
const path = require('path')

const version = process.argv[2]
if (!version) {
  console.error('Usage: node scripts/bump-version.cjs <version>')
  console.error('Example: node scripts/bump-version.cjs 0.2.3')
  process.exit(1)
}

if (!/^\d+\.\d+\.\d+(-[\w.]+)?$/.test(version)) {
  console.error('Invalid version format. Use semver (e.g., 0.2.3 or 0.2.3-beta.1)')
  process.exit(1)
}

const pkgPath = path.join(__dirname, '..', 'package.json')
const srcPath = path.join(__dirname, '..', 'src', 'index.ts')

const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'))
const oldVersion = pkg.version
pkg.version = version
fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n')

let src = fs.readFileSync(srcPath, 'utf8')
src = src.replace(/const CURRENT_VERSION = '[^']+'/, `const CURRENT_VERSION = '${version}'`)
fs.writeFileSync(srcPath, src)

console.log(`Version bumped: ${oldVersion} → ${version}`)
console.log('Updated:')
console.log('  - package.json')
console.log('  - src/index.ts (CURRENT_VERSION)')
console.log('')
console.log('Next steps:')
console.log('  1. git add -A && git commit -m "chore(cli): bump version to ' + version + '"')
console.log('  2. git tag cli-v' + version)
console.log('  3. git push && git push --tags')
