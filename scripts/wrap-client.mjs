import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const lib = join(root, 'lib')
const packageName = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).name
if (typeof packageName !== 'string' || packageName === '') {
  throw new Error('package.json name must be the client module id')
}
const filename = ['client.js', 'client.cjs']
  .map(name => join(lib, name))
  .find(path => {
    try {
      readFileSync(path)
      return true
    } catch {
      return false
    }
  })
if (filename === undefined) throw new Error('tsdown did not emit lib/client.js or lib/client.cjs')
const source = readFileSync(filename, 'utf8')
const out = join(lib, 'client.js')
const idLiteral = JSON.stringify(packageName)
if (source.includes('window.__ModuleLoader__')) {
  const wrapped = source.replace(
    /window\.__ModuleLoader__\.load\(\{\s*id:\s*"(?:[^"\\]|\\.)*"\s*,/,
    `window.__ModuleLoader__.load({\n\tid: ${idLiteral},`,
  )
  if (wrapped === source && !source.includes(`id: ${idLiteral}`)) {
    throw new Error('wrapped client.js has no module id to update')
  }
  if (filename !== out || wrapped !== source) writeFileSync(out, wrapped)
  process.exit(0)
}

writeFileSync(out, `window.__ModuleLoader__.load({
	id: ${idLiteral},
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
${source}
		return module.exports;
	}
});
`)
