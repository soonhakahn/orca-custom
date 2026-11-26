import { useCallback, useMemo, useSyncExternalStore } from 'react'
import { Users } from 'lucide-react'
import { useTranslate } from '@/i18n/use-translate'
import { useLatestHandler } from '@/lib/use-latest-handler'
import { botRefKey } from '@/lib/bot-hosts'
import { folderWorkspaceKey } from '../../../../shared/workspace/identity/workspace-scope'
import type { Bot } from '../../../../shared/bot-types'
import type { BotGroup } from '../../../../shared/bots/bot-group'
import { botGroupSingleRecipient } from '../../../../shared/bots/bot-group-mentions'
import { botGroupSkillBotId } from '../../../../shared/bots/bot-group-commands'
import type { NativeChatComposerRoom } from '../native-chat/composer/native-chat-composer-types'
import { subscribeToNativeChatComposerDraft } from '../native-chat/drafts/native-chat-composer-draft-store'
import { readNativeChatDraftCache } from '../native-chat/drafts/native-chat-draft-views'
import { BotAvatar } from './BotAvatar'
import { BotGroupReplyPicker } from './BotGroupReplyPicker'
import { useBotHome } from '../settings/bots/use-bot-home-file'
import { formatNativeChatFileReference } from '../../../../shared/native-chat/input/composer/agent-image-paste'
import {
  botGroupWorkspaceBotId,
  botGroupWorkspaceFilePath
} from '../../../../shared/bots/bot-group-workspace-paths'

/** The group composer's room: `@` lists members, then files from the home of the one bot on this
 *  computer the draft reaches (else the bot that answers by default), each written as its path on
 *  the host because every member runs in its own home; and who would answer the current draft. */
export function useBotGroupComposerRoom(
  draftScope: string,
  group: BotGroup | undefined,
  bots: readonly Bot[],
  onGroupChange: (group: BotGroup) => void
): {
  room: NativeChatComposerRoom | undefined
  mentionNames: string[]
  recipientId: string | null
  skillBotId: string | null
  /** The home `@` searches, as the composer's workspace. */
  homeWorktreeId: string | undefined
} {
  const t = useTranslate()
  const subscribeDraft = useCallback(
    (listener: () => void) => subscribeToNativeChatComposerDraft(draftScope, listener),
    [draftScope]
  )
  // Model and permission controls belong to one bot, so they show only while exactly one would answer.
  const recipientId = useSyncExternalStore(subscribeDraft, () =>
    group ? botGroupSingleRecipient(readNativeChatDraftCache(draftScope), group, bots) : null
  )
  const skillBotId = useSyncExternalStore(subscribeDraft, () =>
    group ? botGroupSkillBotId(readNativeChatDraftCache(draftScope), group, bots) : null
  )
  const homeBotId =
    (recipientId && group?.members.some((member) => member.botId === recipientId)
      ? recipientId
      : undefined) ?? botGroupWorkspaceBotId(group)
  const homeBot = bots.find((bot) => bot.id === homeBotId && bot.hostId === group?.hostId)
  const home = useBotHome(homeBot ?? null)
  const folderPath = home?.folderPath
  // This computer's members, then bots on paired computers as the room saved them.
  const memberBots = useMemo(
    () => [
      ...bots.filter(
        (bot) =>
          bot.hostId === group?.hostId && group.members.some((member) => member.botId === bot.id)
      ),
      ...(group?.remoteMembers ?? []).map((member) => ({
        id: member.botId,
        hostId: `runtime:${member.environmentId}` as const,
        name: member.name,
        avatar: member.avatar,
        avatarColor: member.avatarColor,
        avatarOutfit: member.avatarOutfit
      }))
    ],
    [bots, group]
  )
  // Keyed by the names so transcript markdown keeps its extension across transcript polls.
  const namesKey = memberBots.map((bot) => bot.name).join('\n')
  const mentionNames = useMemo(() => (namesKey ? namesKey.split('\n') : []), [namesKey])
  const changeGroup = useLatestHandler(onGroupChange)
  const room = useMemo<NativeChatComposerRoom | undefined>(
    () =>
      group && {
        replies: (draft) => (
          <BotGroupReplyPicker group={group} draft={draft} onChange={changeGroup} />
        ),
        mentions: [
          ...memberBots.map((bot) => ({
            name: bot.name,
            recentKey: botRefKey(bot),
            icon: <BotAvatar bot={bot} className="size-5 shrink-0" />
          })),
          {
            name: 'everyone',
            icon: <Users className="size-4 shrink-0 text-muted-foreground" />
          }
        ],
        placeholder: t(
          'bots.groups.composerPlaceholder',
          'Ask anything, @ to mention files, / for commands'
        ),
        ...(folderPath
          ? {
              withFiles: true as const,
              fileReference: (path: string) =>
                formatNativeChatFileReference(botGroupWorkspaceFilePath(folderPath, path))
            }
          : {})
      },
    [changeGroup, group, memberBots, t, folderPath]
  )
  return {
    room,
    mentionNames,
    recipientId,
    skillBotId,
    homeWorktreeId: homeBot ? folderWorkspaceKey(homeBot.folderWorkspaceId) : undefined
  }
}
