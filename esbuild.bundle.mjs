// import { dtsPlugin } from "esbuild-plugin-d.ts";
import { build } from "esbuild";
import path from 'node:path'
import fs, { readFileSync } from 'node:fs'
import { umdWrapper } from "esbuild-plugin-umd-wrapper";

const umdWrapperOptions = {
  libraryName: "EpxMod", // default is unset
  external: "inherit", // <= default
  amdLoaderName: "define" // <= default
}

//for the CJS build: we take the import url and translate it into it's corresponding functions and annd that back to the file.
const dataUrl = {
    name: 'data-url-to-functions',
    setup(build) {
        build.onLoad({ filter: /\.js$/ }, (args) => {
            const source = readFileSync(args.path, 'utf-8');
            const transformedSource = source.replace(/import\s+(?:{[^}]*}\s+from\s+)?['"]data:application\/javascript;base64,([^'"]+)['"];\s*/g, (_, b64) => {
                const code = Buffer.from(b64, 'base64').toString('utf-8');
                return code;
            })
            return {
                contents: transformedSource,
                loader: 'js'
            }
        });
    }
}

let wasmPlugin = {
  name: 'wasm',
  setup(build) {
    // Resolve ".wasm" files to a path with a namespace
    build.onResolve({ filter: /\.wasm$/ }, args => {
      // If this is the import inside the stub module, import the
      // binary itself. Put the path in the "wasm-binary" namespace
      // to tell our binary load callback to load the binary file.
      if (args.namespace === 'wasm-stub') {
        return {
          path: args.path,
          namespace: 'wasm-binary',
        }
      }

      // Otherwise, generate the JavaScript stub module for this
      // ".wasm" file. Put it in the "wasm-stub" namespace to tell
      // our stub load callback to fill it with JavaScript.
      //
      // Resolve relative paths to absolute paths here since this
      // resolve callback is given "resolveDir", the directory to
      // resolve imports against.
      if (args.resolveDir === '') {
        return // Ignore unresolvable paths
      }
      return {
        path: path.isAbsolute(args.path) ? args.path : path.join(args.resolveDir, args.path),
        namespace: 'wasm-stub',
      }
    })

    // Virtual modules in the "wasm-stub" namespace are filled with
    // the JavaScript code for compiling the WebAssembly binary. The
    // binary itself is imported from a second virtual module.
    build.onLoad({ filter: /.*/, namespace: 'wasm-stub' }, async (args) => ({
      contents: `import wasm from ${JSON.stringify(args.path)}
        export default (imports) =>
          WebAssembly.instantiate(wasm, imports).then(
            result => result.instance.exports)`,
    }))

    // Virtual modules in the "wasm-binary" namespace contain the
    // actual bytes of the WebAssembly file. This uses esbuild's
    // built-in "binary" loader instead of manually embedding the
    // binary data inside JavaScript code ourselves.
    build.onLoad({ filter: /.*/, namespace: 'wasm-binary' }, async (args) => ({
      contents: await fs.promises.readFile(args.path),
      loader: 'binary',
    }))
  },
}
let makeAllPackagesExternalPlugin = {
  name: 'make-all-packages-external',
  setup(build) {

    // build.onResolve({ filter: /protocol/ }, args => ({ external: false }))
    let filter = /^[^.\/]|^\.[^.\/]|^\.\.[^\/]/ // Must not start with "/" or "./" or "../"
    build.onResolve({ filter }, args => ({ path: args.path, external: true }))
  },
}

build({
  bundle: true,
  format: "esm",
  entryPoints: [`./src/main.ts`],
  outfile: `./dist/index.mjs`,
  plugins: [wasmPlugin],
  external: ["fs", "ws", "path"],
})

build({
  bundle: true,
  format: "cjs",
  entryPoints: [`./src/main.ts`],
  outfile: `./dist/index.js`,
  external: ["fs", "ws", "path"],
  plugins: [wasmPlugin, dataUrl, umdWrapper(umdWrapperOptions)]
  // plugins: [dtsPlugin({
  //   outDir: `./dist/`,
  //   tsconfig: "tsconfig.json"
  // })]
})
