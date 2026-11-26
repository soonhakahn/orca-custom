// The group composer's structured transport: routes sends and attachment uploads to the room's host
// using a stable member session id, and falls back to text-only on older paired servers.
import { botErrorText } from './bot-presentation'
import { useState } from 'react'
import { useTranslate } from '@/i18n/use-translate'
import { botTarget, callBotRpc } from '@/lib/bot-hosts'
import { useStructuredAgentSessionHostCapabilityState } from '@/runtime/native-chat/host-capabilities/structured-agent-session-host-capability'
import { runtimeTargetEnvironmentId } from '@/runtime/rpc/targets/runtime-client-target'
import {
  BOTS_GROUP_ATTACHMENTS_RUNTIME_CAPABILITY,
  BOTS_GROUP_COMMANDS_RUNTIME_CAPABILITY
} from '../../../../shared/bot-runtime-capabilities'
import { sendsLocalFileToRemote } from '../../../../shared/bots/bot-group-remote-file-guard'
import type { AgentJournalSkillRef } from '../../../../shared/agent-session/journal/agent-session-journal-types'
import {
  botGroupLeadingCommand,
  botGroupCommandAvailable,
  isBotGroupSessionCommand
} from '../../../../shared/bots/bot-group-commands'
import { dispatchStructuredAgentSessionComposerCommand } from '../../../../shared/agent-session/view/structured-agent-session-composer'
import { localizeStructuredComposerOutcome } from '@/components/native-chat/composer/submit/structured-composer-command-error-text'
import type { AgentType } from '../../../../shared/agent-status/contracts/agent-status-types'
import type { NativeChatOptionPickerRequest } from '../native-chat/session/options/controls/native-chat-option-picker-request'
import type { BotGroup, BotGroupMessage } from '../../../../shared/bots/bot-group'
import { createNonSecureContextUuid as createBrowserUuid } from '../../../../shared/identifiers/non-secure-context-uuid'
import { folderWorkspaceKey } from '../../../../shared/workspace/identity/workspace-scope'
import type { NativeChatStructuredComposerTransport } from '../native-chat/composer/submit/native-chat-structured-composer-transport'
import type { BotGroupSession } from './BotGroupSessionReader'
import { useBotHostLabel } from './use-bot-host-label'

const NO_OPTIONS: NativeChatStructuredComposerTransport['optionsSurface'] = {
  getSnapshot: () => [],
  subscribe: () => () => {},
  setOption: async () => ({ snapshot: [] }),
  invokeAction: async () => ({ snapshot: [] })
}

async function sendBotGroupPost({
  group,
  threadId,
  text,
  images,
  skills,
  command,
  setSending,
  onSent,
  onError
}: {
  group: BotGroup
  threadId: string | undefined
  text: string
  images: readonly string[]
  skills: readonly AgentJournalSkillRef[]
  command: boolean
  setSending: (sending: boolean) => void
  onSent: (message: BotGroupMessage) => void
  onError: (error: string | null) => void
}): Promise<boolean> {
  setSending(true)
  try {
    const { message } = await callBotRpc<{ message: BotGroupMessage }>(group, 'bots.groups.send', {
      groupId: group.id,
      threadId,
      revision: group.revision,
      messageId: createBrowserUuid(),
      text,
      ...(images.length > 0 ? { images } : {}),
      ...(skills.length > 0 ? { skills } : {}),
      ...(command ? { command: true } : {})
    })
    onSent(message)
    onError(null)
    return true
  } catch (error) {
    onError(botErrorText(error))
    return false
  } finally {
    setSending(false)
  }
}

export function useBotGroupComposerTransport({
  roomId,
  threadId,
  group,
  chosen,
  bots,
  recipientId,
  skillBotId,
  homeWorktreeId,
  agent,
  onSent,
  onError,
  onNotice
}: {
  roomId: string
  threadId: string | undefined
  group: BotGroup | undefined
  chosen: BotGroupSession | undefined
  bots: readonly { id: string; name: string }[]
  /** The one bot the draft reaches, whose commands and skills the composer offers. */
  recipientId: string | null
  skillBotId: string | null
  /** The home `@` searches and skills are found in; absent, the room's own. */
  homeWorktreeId: string | undefined
  /** The recipient's agent, whose commands the composer lists. */
  agent: AgentType
  onSent: (message: BotGroupMessage) => void
  onError: (error: string | null) => void
  /** What a command run on a member's session did, said in the room. */
  onNotice: (notice: string) => void
}): NativeChatStructuredComposerTransport {
  const t = useTranslate()
  const [sending, setSending] = useState(false)
  const [optionPickerRequest, setOptionPickerRequest] =
    useState<NativeChatOptionPickerRequest | null>(null)
  const target = group ? botTarget(group) : null
  const runtimeEnvironmentId = target ? runtimeTargetEnvironmentId(target) : null
  const hostLabel = useBotHostLabel(group?.hostId ?? 'local')
  const remoteCapability = useStructuredAgentSessionHostCapabilityState(
    runtimeEnvironmentId !== null ? target : null,
    BOTS_GROUP_ATTACHMENTS_RUNTIME_CAPABILITY
  )
  const remoteCommands = useStructuredAgentSessionHostCapabilityState(
    runtimeEnvironmentId !== null ? target : null,
    BOTS_GROUP_COMMANDS_RUNTIME_CAPABILITY
  )
  // An unknown paired-host capability is treated as unsupported so older servers never see `images`.
  const hostTakesAttachments = runtimeEnvironmentId === null || remoteCapability === 'supported'
  // The host runs a lone command for one member as that member's own message and takes skills.
  const runsCommands =
    (runtimeEnvironmentId === null || remoteCommands === 'supported') &&
    group?.members.some((member) => member.botId === recipientId) === true
  const takesSkills =
    (runtimeEnvironmentId === null || remoteCommands === 'supported') && skillBotId !== null
  const recipientName = bots.find((bot) => bot.id === recipientId)?.name
  // The member's room session uses the same mutation controls as its individual chat.
  const session = runsCommands ? chosen : undefined
  const conversationCommands = session?.conversationCommands
  const hostTooOldNotice = t(
    'bots.groups.attachmentsHostTooOld',
    '{{host}} needs an update to attach files in group chats.',
    { host: hostLabel ?? t('bots.items.comment.thisServer', 'This server') }
  )
  // Pick a stable member session so typing `@Bot` never changes the composer target mid-upload.
  const uploadSessionId = group?.members[0]?.sessionId ?? null
  const acceptsImages = Boolean(group && hostTakesAttachments && uploadSessionId)

  return {
    commandAvailable: (name) => runsCommands && botGroupCommandAvailable(name),
    skillsDisabled: !takesSkills,
    runtime: runtimeEnvironmentId ? 'remote' : 'local',
    sessionId: uploadSessionId ?? `bot-group:${roomId}`,
    runtimeEnvironmentId,
    ...(runtimeEnvironmentId !== null && !hostTakesAttachments
      ? { sessionPending: true, sessionPendingNotice: hostTooOldNotice }
      : {}),
    capturePresentation: chosen?.capturePresentation ?? (() => () => true),
    acceptsImages,
    worktreeId: homeWorktreeId ?? (group && folderWorkspaceKey(group.folderWorkspaceId)),
    optionsSurface: session?.optionSurface ?? NO_OPTIONS,
    optionSnapshot: session?.optionSnapshot ?? [],
    optionPickerRequest: session ? optionPickerRequest : null,
    ...(session
      ? {
          sessionCommands: session.sessionCommands,
          conversationCommands,
          compactInstructions: session.compactInstructions,
          refreshCommands: session.refreshCommands,
          setCommandsMenuOpen: session.setCommandsMenuOpen,
          commandsChecking: session.commandsChecking
        }
      : {}),
    sendOut: sending,
    send: async (text, attachments, request) => {
      if (!group || sending) {
        return false
      }
      if (attachments.length > 0 && !hostTakesAttachments) {
        onError(hostTooOldNotice)
        return false
      }
      const skills = request?.skills ?? []
      if (sendsLocalFileToRemote(text, group, bots, { uploads: 0, skills: skills.length })) {
        onError(
          t(
            'bots.groups.filesRemote',
            "Files and skills can't go to bots on other computers. Remove them, or mention only bots on this computer."
          )
        )
        return false
      }
      if (skills.length > 0 && !takesSkills) {
        onError(
          t(
            'bots.groups.commandsInSessions',
            'Commands need exactly one bot on this computer and an up-to-date host. Use the bot’s chat for other commands.'
          )
        )
        return false
      }
      const prepared = request?.prepareAttachments
        ? await request.prepareAttachments(
            {
              text,
              attachments: attachments.map((image) => ({
                ...image,
                previewUri: image.previewUrl ?? ''
              }))
            },
            () => true
          )
        : { text, attachments }
      const command = recipientName && botGroupLeadingCommand(text, recipientName)
      const accepted = await sendBotGroupPost({
        group,
        threadId,
        text: prepared.text,
        images: (prepared.attachments ?? []).map(({ path }) => path),
        skills,
        command: !!command && !skills.some((skill) => command.split(/\s/u)[0] === `/${skill.name}`),
        setSending,
        onSent,
        onError
      })
      if (accepted) {
        request?.onSettled?.('recorded')
      }
      return accepted
    },
    // For the one bot on this computer the draft reaches: a session command runs on its own session
    // as its chat runs it, any other command goes out as the post, which the host hands that bot as
    // its own message. Without such a bot (or on an older host) commands stay refused.
    dispatchCommand: async (text, onSent, input) => {
      const command = botGroupLeadingCommand(
        text,
        recipientName ?? [
          ...bots.map((bot) => bot.name),
          ...(group?.remoteMembers ?? []).map((bot) => bot.name)
        ]
      )
      if (command && input?.skills.some((skill) => command.split(/\s/u)[0] === `/${skill.name}`)) {
        return { handled: false, accepted: false, error: null }
      }
      if (command && (!session || !botGroupCommandAvailable(command.slice(1).split(/\s/u)[0]))) {
        return {
          handled: true,
          accepted: false,
          error: t(
            'bots.groups.commandsInSessions',
            'Commands need exactly one bot on this computer and an up-to-date host. Use the bot’s chat for other commands.'
          )
        }
      }
      if (session && command && isBotGroupSessionCommand(command, agent)) {
        if (input?.hasAttachments || /@(?:["'\\/~]|[a-z]:[\\/])/iu.test(text)) {
          return {
            handled: true,
            accepted: false,
            error: t(
              'components.native-chat.composer.commandAttachmentsUnsupported',
              'Remove attachments before using a chat-session command.'
            )
          }
        }
        const outcome = await dispatchStructuredAgentSessionComposerCommand(
          command,
          {
            agent,
            snapshot: session.optionSnapshot,
            invokeAction: async (id) => {
              setOptionPickerRequest({ id, consume: () => setOptionPickerRequest(null) })
              return true
            },
            setOption: session.setStructuredOption,
            sessionCommands: session.sessionCommands,
            conversationCommands,
            compactInstructions: session.compactInstructions,
            runConversationCommand: session.runConversationCommand
          },
          onSent
        ).then(localizeStructuredComposerOutcome)
        if (outcome.accepted) {
          onNotice(
            t('bots.groups.commandRan', 'Ran {{command}} in {{bot}}’s room session.', {
              command: command.split(/\s/u, 1)[0] ?? command,
              bot: recipientName ?? ''
            })
          )
        }
        return outcome
      }
      return text.startsWith('/') && !runsCommands
        ? {
            handled: true,
            accepted: false,
            error: t(
              'bots.groups.useEachBotSNativeSessionForCommands',
              'Use each bot’s native session for commands.'
            )
          }
        : { handled: false, accepted: false, error: null }
    },
    onError: (message) => {
      if (message !== null) {
        onError(message)
      }
    }
  }
}
