import { isWindowsAbsolutePathLike } from '../file-access/cross-platform-path'
import { botGroupRemoteKey } from './bot-group'
import { botGroupAudience } from './bot-group-mentions'

// Each `@` reference as formatNativeChatFileReference writes it: `@"…"` (with `\"`), `@'…'`, or `@path`.
const FILE_REFERENCE = /@(?:"((?:[^"\\]|\\.)*)"|'([^']*)'|(\S+))/gu

const isLocalPath = (path: string) =>
  path.startsWith('/') || path.startsWith('~') || isWindowsAbsolutePathLike(path)

/** Whether sending `text` hands a bot on a paired computer something only this computer holds: a
 *  file named by its path here (a workspace pick or a dropped file, whose path would show this
 *  computer's folders), an upload (the host masks it to `[image]` for them, so it would seem sent yet
 *  never arrive), or a picked skill (a file here too). Photos are not counted: the host tells such a
 *  bot it was not sent them. */
export function sendsLocalFileToRemote(
  text: string,
  group: Parameters<typeof botGroupAudience>[1],
  bots: readonly { id: string; name: string }[],
  held: { uploads: number; skills: number }
): boolean {
  if (!group.remoteMembers?.length) {
    return false
  }
  let audience: string[]
  try {
    audience = botGroupAudience(text, group, bots)
  } catch {
    // The host refuses an unaddressable post before anyone is asked.
    return false
  }
  const remote = new Set(group.remoteMembers.map(botGroupRemoteKey))
  if (!audience.some((id) => remote.has(id))) {
    return false
  }
  return (
    held.uploads > 0 ||
    held.skills > 0 ||
    [...text.matchAll(FILE_REFERENCE)].some((found) =>
      isLocalPath(found[1]?.replace(/\\"/g, '"') ?? found[2] ?? found[3] ?? '')
    )
  )
}
