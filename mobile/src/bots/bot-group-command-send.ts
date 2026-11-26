import type { AgentJournalSkillRef } from '../../../src/shared/agent-session/journal/agent-session-journal-types'
import {
  botGroupLeadingCommand,
  botGroupCommandAvailable,
  isBotGroupSessionCommand
} from '../../../src/shared/bots/bot-group-commands'
import { translate as t } from '../i18n/mobile-i18n'
import type { MobileBotGroupSession } from './MobileBotGroupTurns'
import { isStructuredAgentSessionHostCommand } from '../../../src/shared/agent-session/view/structured-agent-session-composer'

/** Loaded at Send; the ordinary chat sender owns fencing, holds and the mutation receipt. */
export async function dispatchBotGroupCommand(input: {
  text: string
  hasAttachments: boolean
  bot: { name: string; agent: string } | undefined
  memberNames: readonly string[]
  skills: readonly AgentJournalSkillRef[]
  session: MobileBotGroupSession | undefined
  onError: (message: string) => void
  onNotice: (message: string) => void
}): Promise<boolean | null> {
  const { text, bot, session, onError, onNotice } = input
  const command = botGroupLeadingCommand(text, bot?.name ?? input.memberNames)
  if (!command || input.skills.some((skill) => command.split(/\s/u)[0] === `/${skill.name}`)) {
    return null
  }
  if (!bot || !session || !botGroupCommandAvailable(command.slice(1).split(/\s/u)[0])) {
    onError(
      t(
        'bots.groups.commandsInSessions',
        'Commands need exactly one bot on this computer and an up-to-date host. Use the bot’s chat for other commands.'
      )
    )
    return false
  }
  if (!isBotGroupSessionCommand(command, bot.agent)) {
    return null
  }
  if (!isStructuredAgentSessionHostCommand(command, false, bot.agent, session.optionSnapshot)) {
    onError(
      t(
        'bots.groups.commandsInSessions',
        'Commands need exactly one bot on this computer and an up-to-date host. Use the bot’s chat for other commands.'
      )
    )
    return false
  }
  if (input.hasAttachments || /@(?:["'\\/~]|[a-z]:[\\/])/iu.test(text)) {
    onError(
      t(
        'session.structuredComposerCommand.removeAttachments',
        'Remove attachments before using a chat-session command.'
      )
    )
    return false
  }
  if ((await session.sendWithOutcome(command)) !== 'accepted') {
    return false
  }
  onNotice(
    t('bots.groups.commandRan', 'Ran {{command}} in {{bot}}’s room session.', {
      command: command.split(/\s/u)[0],
      bot: bot.name
    })
  )
  return true
}
