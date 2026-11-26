import { isWindowsAbsolutePathLike, resolveRuntimePath } from '../file-access/cross-platform-path'
import type { BotGroup } from './bot-group'

/** The member whose home a group's `@` searches: the bot that answers by default, else the first.
 *  The room's own home holds no files, and each member works in its own home. */
export function botGroupWorkspaceBotId(
  group: Pick<BotGroup, 'members' | 'replyMode'> | undefined
): string | undefined {
  const replier = group?.replyMode.kind === 'bot' ? group.replyMode.botId : undefined
  return (
    group?.members.find((member) => member.botId === replier)?.botId ?? group?.members[0]?.botId
  )
}

/** The home as a group's workspace picks write it, without a trailing separator. */
export function botGroupWorkspaceRoot(home: string): string {
  return isWindowsAbsolutePathLike(home) ? resolveRuntimePath(home, '.') : home.replace(/\/+$/, '')
}

/** A workspace-relative (`/`-separated) pick under `home`, written as the host spells paths: a POSIX
 *  name keeps its backslashes, which are characters there, never separators. */
export function botGroupWorkspaceFilePath(home: string, path: string): string {
  return isWindowsAbsolutePathLike(home)
    ? resolveRuntimePath(home, path)
    : `${botGroupWorkspaceRoot(home)}/${path.replace(/^\/+/, '')}`
}
