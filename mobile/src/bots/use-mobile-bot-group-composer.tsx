import { useMemo } from 'react'
import { Users } from 'lucide-react-native'
import type { Bot } from '../../../src/shared/bot-types'
import type { BotGroup, BotGroupMessage } from '../../../src/shared/bots/bot-group'
import {
  botGroupDraftAudience,
  botGroupSingleRecipient,
  formatBotGroupAudience
} from '../../../src/shared/bots/bot-group-mentions'
import { useMobileTranslation } from '../i18n/use-mobile-translation'
import { colors } from '../theme/mobile-theme'
import { MobileBotAvatar } from './MobileBotAvatar'
import { mobileBotAvatarSource } from './host-bot-row-facts'
import type { RpcClient } from '../transport/rpc/rpc-client-contract'
import { useBotDraftImages } from './use-bot-draft-images'
import { useMobileNativeChatFileAttachments } from '../session/native-chat/composer/attachments/use-mobile-native-chat-file-attachments'
import { useMobileBotGroupWorkspaceFiles } from './use-mobile-bot-group-workspace-files'
import { sendsLocalFileToRemote } from '../../../src/shared/bots/bot-group-remote-file-guard'
import { useMobileBotGroupCommands } from './use-mobile-bot-group-commands'
import { botFailureMessage } from './bot-failure-message'
import { groupSend } from './bot-group-operations'
import { randomV4Uuid } from '../platform/random-v4-uuid'
import {
  readMobileNativeChatDraftInputs,
  useMobileNativeChatDraftInputs
} from '../session/native-chat/composer/drafts/mobile-native-chat-draft-inputs'
import { takeBotGroupSendFiles } from './bot-group-send-files'
import type { MobileBotGroupSession } from './MobileBotGroupTurns'
import { botGroupSkillBotId } from '../../../src/shared/bots/bot-group-commands'

/** The group composer's `@` members, the room's faces, who the draft reaches, the one bot that would
 *  answer, and its photos and files, which reach the bots as a chat's do: `@path`s in the words. */
export function useMobileBotGroupComposer(
  group: BotGroup | undefined,
  bots: readonly (Pick<Bot, 'id' | 'name' | 'avatar' | 'folderWorkspaceId'> & { agent: string })[],
  composerDraft: {
    key: string
    text: string
    edit: (change: (text: string) => string) => void
    clearForSend: (sent: string) => void
    restoreRefused: (sent: string) => void
  },
  client: RpcClient,
  /** The host takes a post's photos and files; an older one takes text only. */
  takesPhotos: boolean,
  onError: (message: string) => void,
  /** A home path read that failed is read again once the host is back. */
  connected: boolean,
  host: { id: string; runsCommands: boolean; discoversSkills: boolean },
  sessions: ReadonlyMap<string, MobileBotGroupSession>,
  onNotice: (message: string) => void
) {
  const t = useMobileTranslation()
  const draft = composerDraft.text
  // Photos upload to a member's session, as the desktop's do.
  const uploadTo = takesPhotos ? (group?.members[0]?.sessionId ?? null) : null
  const photos = useBotDraftImages({
    client,
    draftKey: composerDraft.key,
    sessionId: uploadTo,
    editText: composerDraft.edit,
    showToast: onError,
    markersInText: false
  })
  // Files upload to the same session; the host claims every store path a post names for each member.
  const attached = useMobileNativeChatFileAttachments({
    client,
    sessionId: uploadTo,
    scopeKey: composerDraft.key,
    enabled: uploadTo !== null,
    showToast: onError
  })
  // A file pick or its upload still running, as a chat's Send waits for.
  const pending = useMobileNativeChatDraftInputs(composerDraft.key, 'pending') ?? 0
  const workspace = useMobileBotGroupWorkspaceFiles(
    uploadTo && connected ? client : null,
    group,
    bots,
    group ? botGroupSingleRecipient(draft, group, bots) : null
  )
  const draftAudience = group ? botGroupDraftAudience(draft, group, bots) : 'invalid'
  // The one bot that would answer, whose agent the composer's commands follow.
  const recipientId =
    draftAudience !== 'invalid' && draftAudience.ids.length === 1 ? draftAudience.ids[0] : null
  const commands = useMobileBotGroupCommands({
    hostId: host.id,
    client: connected ? client : null,
    draftKey: composerDraft.key,
    recipient: bots.find((bot) => bot.id === recipientId),
    skillRecipient: bots.find(
      (bot) => bot.id === (group ? botGroupSkillBotId(draft, group, bots) : null)
    ),
    memberNames: [
      ...bots.map((bot) => bot.name),
      ...(group?.remoteMembers ?? []).map((bot) => bot.name)
    ],
    supported: host.runsCommands,
    discoversSkills: host.discoversSkills,
    sessionId: group?.members.find((m) => m.botId === recipientId)?.sessionId,
    session: sessions.get(group?.members.find((m) => m.botId === recipientId)?.sessionId ?? ''),
    onNotice,
    onError
  })
  const memberBots = useMemo(
    () => bots.filter((bot) => group?.members.some((member) => member.botId === bot.id)),
    [bots, group?.members]
  )
  // This computer's members, then bots on paired computers as the room saved them, as the desktop lists them.
  const roomMentions = useMemo(
    () => [
      ...[...memberBots, ...(group?.remoteMembers ?? [])].map((bot) => ({
        name: bot.name,
        icon: <MobileBotAvatar avatar={mobileBotAvatarSource(bot)} size={20} />
      })),
      { name: 'everyone', icon: <Users size={20} color={colors.textSecondary} strokeWidth={2} /> }
    ],
    [memberBots, group?.remoteMembers]
  )
  // Who is in the room, in the same order, for its picture; a paired computer's upload shows as letters.
  const faces = useMemo(
    () => [
      ...memberBots.map((bot) => ({
        id: bot.id,
        name: bot.name,
        avatar: mobileBotAvatarSource(bot)
      })),
      ...(group?.remoteMembers ?? []).map((bot) => ({
        id: `${bot.environmentId}:${bot.botId}`,
        name: bot.name,
        avatar: mobileBotAvatarSource(bot)
      }))
    ],
    [memberBots, group?.remoteMembers]
  )
  const audience = group ? formatBotGroupAudience(draftAudience, group, bots, t) : ''
  /** Opens the photo library; undefined hides the composer's +. */
  const attachPhotos = uploadTo ? () => void photos.attach() : undefined
  const refusesRemote = (text: string, skills: number) => {
    const refused =
      group !== undefined &&
      sendsLocalFileToRemote(text, group, bots, {
        uploads: readMobileNativeChatDraftInputs(composerDraft.key).files.length,
        skills
      })
    if (refused) {
      onError(
        t(
          'bots.groups.filesRemote',
          "Files and skills can't go to bots on other computers. Remove them, or mention only bots on this computer."
        )
      )
    }
    return refused
  }
  const files = {
    /** The composer's file chips, + sheet and `@` workspace files (none while that home's path is unknown). */
    props: {
      roomFiles: uploadTo
        ? {
            files: attached.files,
            onAttachFiles: () => void attached.attachFiles(),
            onRemoveFile: (id: string) => attached.removeFiles([id])
          }
        : undefined,
      ...workspace,
      /** The room's + sheet lists Skills and Commands. */
      roomCommands: { commands: commands.canCommand, skills: commands.agent !== undefined },
      agent: commands.agent ?? null,
      structured: commands.structured
        ? {
            ...commands.structured,
            files: attached.files,
            onAttachFiles: uploadTo ? () => void attached.attachFiles() : undefined,
            onRemoveFile: (id: string) => attached.removeFiles([id])
          }
        : undefined,
      sessionOptions: commands.sessionOptions,
      ...commands.menu
    },
    attaching: pending > 0
  }
  /** Posts `text` with the draft's photos, files and skills, taken out of the draft as it goes and
   *  handed back after a refusal, as a chat's send does. */
  const send = async (
    text: string,
    room: { threadId: string | undefined; apply: (sent: BotGroupMessage) => void }
  ): Promise<boolean> => {
    const dispatched = await commands.dispatch(
      text,
      photos.images.length > 0 || attached.files.length > 0
    )
    if (dispatched !== null) {
      if (dispatched) {
        composerDraft.clearForSend(text)
      }
      return dispatched
    }
    const skills = group ? commands.sent(text) : null
    const sentFiles =
      group && skills && !refusesRemote(text, skills.length)
        ? takeBotGroupSendFiles(composerDraft.key)
        : null
    if (!group || !skills || !sentFiles) {
      return false
    }
    composerDraft.clearForSend(text)
    const sent = photos.images
    photos.clearSent(sent.map((image) => image.id))
    try {
      const result = groupSend.interpret(
        await groupSend.request(client, {
          groupId: group.id,
          revision: group.revision,
          threadId: room.threadId,
          messageId: randomV4Uuid(),
          text: sentFiles.text(text),
          ...(sent.length > 0 ? { images: sent.map((image) => image.path) } : {}),
          ...(skills.length > 0 ? { skills } : {}),
          ...(commands.isCommand(text, skills) ? { command: true } : {})
        })
      )
      commands.clearSent()
      room.apply(result.message)
      return true
    } catch (error) {
      composerDraft.restoreRefused(text)
      photos.returnRefused(sent)
      sentFiles.restore()
      onError(botFailureMessage(error) ?? String(error))
      return false
    }
  }
  return { recipientId, roomMentions, faces, audience, photos, attachPhotos, files, send }
}
