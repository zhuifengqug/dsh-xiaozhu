import { homedir } from 'node:os'
import { join } from 'node:path'

/** DSH 数据根：桌面版是 D:\\DSHData\\home，CLI 缺省 ~/.dsh。 */
export function dshHome() {
  return process.env.DSH_HOME || join(homedir(), '.dsh')
}

/** 小蛛的落盘根：只写这一处，别的地方一概不碰。 */
export function spiderRoot() {
  return process.env.DSH_SPIDER_ROOT || join(dshHome(), 'spider')
}

export const FILES = {
  contract: 'contract.json',
  candidates: 'candidates.json',
  checkups: 'checkups.json',
  moults: 'moults',
  reference: 'reference.txt'
}
