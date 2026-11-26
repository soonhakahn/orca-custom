import {
  isWindowsAbsolutePathLike,
  resolveRuntimePath
} from '../../../src/shared/file-access/cross-platform-path'

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
