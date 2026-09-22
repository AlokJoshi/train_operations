import esbuild from 'esbuild'
import path from 'node:path'
import { promises as fs } from 'node:fs'

const args = new Set(process.argv.slice(2))
const isWatch = args.has('--watch')
const isServe = args.has('--serve')
const cleanOnly = args.has('--clean-only')

const projectRoot = process.cwd()
const distDir = path.join(projectRoot, 'dist')
const servePort = 5173

const excludedDirs = new Set(['.git', '.vscode', 'node_modules', 'dist'])
const excludedFileExt = new Set(['.js', '.mjs', '.cjs', '.map'])

async function cleanDist() {
  await fs.rm(distDir, { recursive: true, force: true })
  await fs.mkdir(distDir, { recursive: true })
}

function rewriteIndexHtml(html) {
  return html.replace(
    /<script\s+type="module"\s+src="script\.js"\s*><\/script>/i,
    '<script type="module" src="./bundle.js"></script>'
  )
}

async function copyStaticFiles() {
  await fs.mkdir(distDir, { recursive: true })
  const entries = await fs.readdir(projectRoot, { withFileTypes: true })

  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (excludedDirs.has(entry.name)) {
        continue
      }
      continue
    }

    const sourcePath = path.join(projectRoot, entry.name)
    const targetPath = path.join(distDir, entry.name)
    const ext = path.extname(entry.name).toLowerCase()

    if (excludedFileExt.has(ext)) {
      continue
    }

    if (entry.name.toLowerCase() === 'index.html') {
      const html = await fs.readFile(sourcePath, 'utf8')
      await fs.writeFile(targetPath, rewriteIndexHtml(html), 'utf8')
      continue
    }

    await fs.copyFile(sourcePath, targetPath)
  }
}

if (cleanOnly) {
  await cleanDist()
  console.log('Cleaned dist directory.')
  process.exit(0)
}

await cleanDist()

const copyPlugin = {
  name: 'copy-static-files',
  setup(build) {
    build.onEnd(async (result) => {
      if (result.errors.length > 0) {
        return
      }
      await copyStaticFiles()
      console.log('Copied static files to dist.')
    })
  }
}

const buildOptions = {
  entryPoints: ['script.js'],
  bundle: true,
  format: 'esm',
  platform: 'browser',
  target: ['es2022'],
  outfile: path.join(distDir, 'bundle.js'),
  sourcemap: isWatch,
  minify: !isWatch,
  logLevel: 'info',
  plugins: [copyPlugin]
}

if (isWatch || isServe) {
  const ctx = await esbuild.context(buildOptions)
  await ctx.watch()
  if (isServe) {
    const server = await ctx.serve({ servedir: distDir, port: servePort })
    console.log(`Serving dist at http://${server.host}:${server.port}`)
  } else {
    console.log('Watching for changes...')
  }
} else {
  await esbuild.build(buildOptions)
  console.log('Build completed. Output in dist directory.')
}
