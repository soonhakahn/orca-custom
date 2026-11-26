import { botGroupRemoteKey } from '../../../src/shared/bots/bot-group'
import { botGroupAudience } from '../../../src/shared/bots/bot-group-mentions'

// Each `@` reference as formatNativeChatFileReference writes it: `@"…"` (with `\"`), `@'…'`, or `@path`.
const FILE_REFERENCE = /@(?:"((?:[^"\\]|\\.)*)"|'([^']*)'|(\S+))/gu

/** Whether sending `text` hands a bot on a paired computer a file only this computer holds: a
 *  workspace file picked under `homeRoot`, whose path would show this computer's folders, or any
 *  uploaded file, which the host masks to `[image]` for them, so it would seem sent yet never arrive.
 *  Photos are not files here: the host tells such a bot it was not sent them. */
export function sendsLocalFileToRemote(
  text: string,
  group: Parameters<typeof botGroupAudience>[1],
  bots: readonly { id: string; name: string }[],
  files: { homeRoot: string | null; uploads: number }
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
  const { homeRoot } = files
  return (
    files.uploads > 0 ||
    (homeRoot !== null &&
      [...text.matchAll(FILE_REFERENCE)].some((found) => {
        const path = found[1]?.replace(/\\"/g, '"') ?? found[2] ?? found[3] ?? ''
        return path === homeRoot || path.startsWith(`${homeRoot}/`)
      }))
  )
}
