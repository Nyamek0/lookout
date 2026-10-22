/* eslint-disable @typescript-eslint/no-require-imports */
const { execFileSync } = require('node:child_process')
const path = require('node:path')

// Apple Silicon refuses to run an app with a broken signature, and repackaging Electron breaks the one it shipped
// with. Without a paid Developer ID we sign "ad hoc" (valid, but not tied to an identity): Gatekeeper still asks the
// user to confirm once, which the README explains. Runs before the dmg is built.
exports.default = async function afterPack(context) {
  if (context.electronPlatformName !== 'darwin') return
  const app = path.join(context.appOutDir, `${context.packager.appInfo.productFilename}.app`)
  execFileSync('codesign', ['--force', '--deep', '--sign', '-', app], { stdio: 'inherit' })
}
