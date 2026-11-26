import { botGroupRemoteKey } from '../../../src/shared/bots/bot-group'
import { botGroupAudience } from '../../../src/shared/bots/bot-group-mentions'

// Each `@` reference as formatNativeChatFileReference writes it: `@"…"` (with `\"`), `@'…'`, or `@path`.
const FILE_REFERENCE = /@(?:"((?:[^"\\]|\\.)*)"|'([^']*)'|(\S+))/gu

/** Whether sending `text` hands a workspace file picked under `homeRoot` to a bot on a paired
 *  computer: the host masks only its attachment-store paths for them, so the path would show this
 *  computer's folders and name a file that bot cannot read. Uploads (store paths) never count. */
export function sendsWorkspaceFileToRemote(
  text: string,
  group: Parameters<typeof botGroupAudience>[1],
  bots: readonly { id: string; name: string }[],
  homeRoot: string | null
): boolean {
  if (!homeRoot || !group.remoteMembers?.length) {
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
  return [...text.matchAll(FILE_REFERENCE)].some((found) => {
    const path = found[1]?.replace(/\\"/g, '"') ?? found[2] ?? found[3] ?? ''
    return path === homeRoot || path.startsWith(`${homeRoot}/`)
  })
}
