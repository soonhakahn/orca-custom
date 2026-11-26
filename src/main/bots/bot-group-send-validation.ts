import type { AgentJournalSkillRef } from '../../shared/agent-session/journal/agent-session-journal-types'
import {
  botGroupCommandAvailable,
  botGroupLeadingCommand,
  isBotGroupSessionCommand
} from '../../shared/bots/bot-group-commands'
import { sendsLocalFileToRemote } from '../../shared/bots/bot-group-remote-file-guard'
import { hasAttachmentStoreReference } from './bot-attachment-images'
import type { BotGroupMessage } from '../../shared/bots/bot-group'

export function sameBotGroupSendPayload(
  existing: BotGroupMessage,
  input: Pick<BotGroupMessage, 'command' | 'skills'>
): boolean {
  return (
    existing.command === input.command &&
    JSON.stringify(existing.skills ?? []) === JSON.stringify(input.skills ?? [])
  )
}

/** Check before reserving turns or persisting the post, including for non-UI callers. */
export function validateBotGroupSend(
  input: { text: string; command?: true; skills?: readonly AgentJournalSkillRef[] },
  group: Parameters<typeof sendsLocalFileToRemote>[1],
  bots: readonly { id: string; name: string; agent: string }[],
  audience: readonly string[]
): void {
  if (
    sendsLocalFileToRemote(input.text, group, bots, {
      uploads: hasAttachmentStoreReference(input.text) ? 1 : 0,
      skills: input.skills?.length ?? 0
    })
  ) {
    throw new Error('Files and skills cannot be sent to bots on other computers.')
  }
  if (!input.command) {
    return
  }
  const bot = audience.length === 1 ? bots.find((bot) => bot.id === audience[0]) : undefined
  const command = bot && botGroupLeadingCommand(input.text, bot.name)
  if (
    !bot ||
    !command ||
    !botGroupCommandAvailable(command.slice(1).split(/\s/u)[0]) ||
    isBotGroupSessionCommand(command, bot.agent)
  ) {
    throw new Error(
      'Run commands for exactly one local bot; session commands use its session controls.'
    )
  }
}
