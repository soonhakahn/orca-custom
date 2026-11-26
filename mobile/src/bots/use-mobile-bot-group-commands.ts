import { useCallback } from 'react'
import type { AgentJournalSkillRef } from '../../../src/shared/agent-session/journal/agent-session-journal-types'
import {
  SkillRefLimitError,
  pickedSkillsInText
} from '../../../src/shared/agent-session/requests/structured-agent-session-send-mutation'
import { MAX_SKILL_REFS } from '../../../src/shared/rpc-contract/structured-agent-session/structured-agent-session-message-params'
import { folderWorkspaceKey } from '../../../src/shared/workspace/identity/workspace-scope'
import { useMobileTranslation } from '../i18n/use-mobile-translation'
import { useMobileNativeChatSkills } from '../session/native-chat/composer/skills/use-mobile-native-chat-skills'
import type { RpcClient } from '../transport/rpc/rpc-client-contract'
import type { MobileBotGroupSession } from './MobileBotGroupTurns'
import { useMobileStructuredSessionCommands } from '../session/native-chat/composer/commands/use-mobile-structured-session-commands'
import {
  botGroupLeadingCommand,
  botGroupCommandAvailable
} from '../../../src/shared/bots/bot-group-commands'

// Skills picked into each group draft, by the file the post names each by.
const picked = new Map<string, readonly AgentJournalSkillRef[]>()

/** A group draft's `/` menu and the + sheet's Skills and Commands, for the one bot on this computer
 *  the draft reaches (its @mention, else the bot that answers by default): its agent's commands and
 *  its home's skills, as its own chat lists them. The host runs such a post as that bot's own message
 *  and hands its skills on, so both take effect; with no such bot, or on an older host, none list. */
export function useMobileBotGroupCommands({
  hostId,
  client,
  draftKey,
  recipient,
  skillRecipient,
  memberNames,
  supported,
  discoversSkills,
  sessionId,
  session,
  onNotice,
  onError
}: {
  hostId: string
  client: RpcClient | null
  draftKey: string
  recipient: { agent: string; name: string; folderWorkspaceId: string } | undefined
  skillRecipient: { agent: string; folderWorkspaceId: string } | undefined
  memberNames: readonly string[]
  sessionId: string | undefined
  session: MobileBotGroupSession | undefined
  onNotice: (message: string) => void
  /** The host runs a lone command for one member and takes a post's skills. */
  supported: boolean
  discoversSkills: boolean
  onError: (message: string) => void
}) {
  const t = useMobileTranslation()
  const bot = supported ? recipient : undefined
  const skillBot = supported ? skillRecipient : undefined
  const catalog = useMobileStructuredSessionCommands({
    client,
    hostId,
    sessionId: bot ? (sessionId ?? null) : null,
    enabled: !!bot,
    commandsOnRequest: true
  })
  const skills = useMobileNativeChatSkills({
    hostId,
    client: skillBot ? client : null,
    worktreeId: skillBot ? folderWorkspaceKey(skillBot.folderWorkspaceId) : '',
    agent: skillBot?.agent ?? null,
    supported: skillBot !== undefined && discoversSkills
  })
  const onPickSkill = useCallback(
    (skill: AgentJournalSkillRef) => {
      const kept = (picked.get(draftKey) ?? []).filter((held) => held.name !== skill.name)
      picked.set(draftKey, [...kept, skill])
    },
    [draftKey]
  )
  return {
    agent: skillBot?.agent ?? bot?.agent,
    canCommand: !!bot,
    structured:
      bot || skillBot
        ? {
            catalog: {
              reported: catalog.commands,
              conversationCommands: session?.conversationCommands ?? [],
              compactInstructions: session?.compactInstructions,
              commandAvailable: (name: string) => !!bot && botGroupCommandAvailable(name)
            },
            onSlashMenuOpen: catalog.refresh,
            onSlashMenuDemand: catalog.setMenuOpen,
            files: [],
            onRemoveFile: () => {}
          }
        : undefined,
    sessionOptions:
      bot && session
        ? {
            isWorking: session.isWorking,
            controller: {
              snapshot: session.optionSnapshot,
              optionSurface: session.optionSurface,
              optionPickerRequest: session.optionPickerRequest,
              pendingId: null,
              setOption: session.setStructuredOption,
              invokeAction: session.invokeStructuredOption,
              recordCommand: () => {}
            }
          }
        : undefined,
    menu: skillBot
      ? {
          skillDiscovery: skills.nativeChatSkills,
          onNeedSkills: skills.loadNativeChatSkills,
          onPickSkill
        }
      : {},
    /** The skills a send of `text` carries; null, saying why, when it names too many. */
    sent: (text: string): AgentJournalSkillRef[] | null => {
      try {
        const held = pickedSkillsInText(text, picked.get(draftKey) ?? [], ['/', '$'])
        if (held.length > MAX_SKILL_REFS) {
          throw new SkillRefLimitError()
        }
        if (held.length > 0 && !supported) {
          onError(
            t(
              'bots.groups.commandsInSessions',
              'Commands need exactly one bot on this computer and an up-to-date host. Use the bot’s chat for other commands.'
            )
          )
          return null
        }
        return held
      } catch (error) {
        if (!(error instanceof SkillRefLimitError)) {
          throw error
        }
        onError(
          t(
            'bots.items.skillLimit',
            'Message not sent. Keep at most {{limit}} selected skill files and try again.',
            { limit: MAX_SKILL_REFS }
          )
        )
        return null
      }
    },
    clearSent: () => picked.delete(draftKey),
    dispatch: async (text: string, hasAttachments: boolean): Promise<boolean | null> => {
      if (!text.includes('/')) {
        return null
      }
      const { dispatchBotGroupCommand } = await import('./bot-group-command-send')
      return dispatchBotGroupCommand({
        text,
        hasAttachments,
        bot,
        session,
        memberNames,
        skills: picked.get(draftKey) ?? [],
        onError,
        onNotice
      })
    },
    isCommand: (text: string, skills: readonly AgentJournalSkillRef[]) => {
      const command = bot && botGroupLeadingCommand(text, bot.name)
      return !!command && !skills.some((skill) => command.split(/\s/u)[0] === `/${skill.name}`)
    }
  }
}
