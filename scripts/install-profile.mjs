// 把本插件挂进桌面 profile：改 deps → 建 junction → 进 bundles 列表。默认先备份。
//   node scripts/install-profile.mjs            安装
//   node scripts/install-profile.mjs --revert   拆掉（只还原这三处，不碰别的插件）
import fs from 'node:fs'
import path from 'node:path'

const PKG = '@zhuifengqug/dsh-spider'
const SELF = path.resolve(import.meta.dirname, '..')
const profileDir = process.env.DSH_PROFILE_DIR || path.join(process.env.DSH_HOME || 'D:\\DSHData\\home', 'profiles', 'desktop')
const pkgFile = path.join(profileDir, 'package.json')
const linkFile = path.join(profileDir, 'node_modules', '@zhuifengqug', 'dsh-spider')
const revert = process.argv.includes('--revert')

function read() {
  return JSON.parse(fs.readFileSync(pkgFile, 'utf8'))
}

function write(pkg) {
  const tmp = pkgFile + '.tmp-spider'
  fs.writeFileSync(tmp, JSON.stringify(pkg, null, 2) + '\n', 'utf8')
  fs.renameSync(tmp, pkgFile)
}

const pkg = read()
const bundles = (pkg.dsh && pkg.dsh.profile && pkg.dsh.profile.bundles) || []
pkg.dependencies = pkg.dependencies || {}
const hasDep = Object.prototype.hasOwnProperty.call(pkg.dependencies, PKG)
const inBundles = bundles.includes(PKG)

if (revert) {
  if (hasDep) delete pkg.dependencies[PKG]
  if (pkg.dsh && pkg.dsh.profile && inBundles) {
    pkg.dsh.profile.bundles = bundles.filter((b) => b !== PKG)
  }
  write(pkg)
  try { if (fs.lstatSync(linkFile).isSymbolicLink() || fs.statSync(linkFile)) fs.rmSync(linkFile, { recursive: true, force: true }) } catch {}
  console.log('已拆掉 ' + PKG + '：deps / bundles / junction 三处回到挂载前。')
  process.exit(0)
}

fs.mkdirSync(path.dirname(linkFile), { recursive: true })
try {
  const st = fs.lstatSync(linkFile)
  if (!st.isSymbolicLink()) throw new Error(linkFile + ' 已存在且不是链接，先手动处理')
} catch (error) {
  if (error && error.code !== 'ENOENT') throw error
  fs.symlinkSync(SELF, linkFile, 'junction')
  console.log('junction: ' + linkFile + ' -> ' + SELF)
}

pkg.dependencies[PKG] = 'link:' + SELF.replace(/\\/g, '/')
if (pkg.dsh && pkg.dsh.profile && !inBundles) pkg.dsh.profile.bundles = bundles.concat([PKG])
write(pkg)
console.log('已写入 ' + pkgFile + '：dependencies.' + PKG + ' + bundles[]。')
console.log('宿主只在启动时读 bundles —— 重启桌面版后，设置页应出现「小蛛」一节。')
