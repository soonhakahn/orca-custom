import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Bot } from '../../../src/shared/bot-types'
import type { BotGroup } from '../../../src/shared/bots/bot-group'
import { formatNativeChatFileReference } from '../../../src/shared/native-chat/input/composer/agent-image-paste'
import { folderWorkspaceKey } from '../../../src/shared/workspace/identity/workspace-scope'
import { useMobileNativeChatFileSearch } from '../session/native-chat/composer/attachments/use-mobile-native-chat-file-search'
import type { RpcClient } from '../transport/rpc/rpc-client-contract'
import { sessionWorktreeRecordRead } from '../worktree/catalog/session-worktree-record-operations'
import {
  botGroupWorkspaceBotId,
  botGroupWorkspaceFilePath
} from '../../../src/shared/bots/bot-group-workspace-paths'

const NO_PATHS: string[] = []

/** The group composer's `@` files: the home of the bot that answers by default (else the first
 *  member), searched as its own chat searches it. Each member runs in its own home, so a pick is
 *  written as the file's path on the host, so files list only once that home's path is known; a
 *  failed read is tried again when `@` next asks for files or the host reconnects. */
export function useMobileBotGroupWorkspaceFiles(
  client: RpcClient | null,
  group: BotGroup | undefined,
  bots: readonly Pick<Bot, 'id' | 'folderWorkspaceId'>[],
  recipientId?: string | null
) {
  const botId = group?.members.some((member) => member.botId === recipientId)
    ? recipientId
    : botGroupWorkspaceBotId(group)
  const folderWorkspaceId = bots.find((bot) => bot.id === botId)?.folderWorkspaceId
  const worktreeId = folderWorkspaceId ? folderWorkspaceKey(folderWorkspaceId) : ''
  const search = useMobileNativeChatFileSearch({ client: worktreeId ? client : null, worktreeId })
  const [home, setHome] = useState<{ worktreeId: string; path: string } | null>(null)
  const [attempt, setAttempt] = useState(0)
  const reading = useRef(false)
  useEffect(() => {
    if (!client || !worktreeId) {
      return
    }
    let stale = false
    reading.current = true
    void sessionWorktreeRecordRead
      .request(client, { worktree: `id:${worktreeId}` })
      .then((response) => {
        const read = sessionWorktreeRecordRead.interpret(response)
        const path = read.accepted ? read.value?.path : undefined
        if (!stale && path) {
          setHome({ worktreeId, path })
        }
      })
      .catch(() => {})
      .finally(() => {
        reading.current = false
      })
    return () => {
      stale = true
    }
  }, [client, worktreeId, attempt])
  const homePath = home?.worktreeId === worktreeId ? home.path : null
  const { nativeChatFilePaths, loadNativeChatFiles } = search
  const onNeedFiles = useCallback(
    (query: string) => {
      if (!homePath && !reading.current) {
        setAttempt((count) => count + 1)
      }
      loadNativeChatFiles(query)
    },
    [homePath, loadNativeChatFiles]
  )
  return useMemo(
    () =>
      client && worktreeId
        ? {
            filePaths: homePath ? nativeChatFilePaths : NO_PATHS,
            onNeedFiles,
            fileReference: homePath
              ? (path: string) =>
                  formatNativeChatFileReference(botGroupWorkspaceFilePath(homePath, path))
              : undefined
          }
        : null,
    [client, worktreeId, homePath, nativeChatFilePaths, onNeedFiles]
  )
}
