import { useMemo } from 'react'
import { Users } from 'lucide-react-native'
import type { Bot } from '../../../src/shared/bot-types'
import type { BotGroup } from '../../../src/shared/bots/bot-group'
import {
  botGroupDraftAudience,
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

/** The group composer's `@` members, the room's faces, who the draft reaches, the one bot that would
 *  answer, and its photos and files, which reach the bots as a chat's do: `@path`s in the words. */
export function useMobileBotGroupComposer(
  group: BotGroup | undefined,
  bots: readonly Pick<Bot, 'id' | 'name' | 'avatar' | 'folderWorkspaceId'>[],
  composerDraft: { key: string; text: string; edit: (change: (text: string) => string) => void },
  client: RpcClient,
  /** The host takes a post's photos and files; an older one takes text only. */
  takesPhotos: boolean,
  onError: (message: string) => void
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
  const workspace = useMobileBotGroupWorkspaceFiles(uploadTo ? client : null, group, bots)
  const draftAudience = group ? botGroupDraftAudience(draft, group, bots) : 'invalid'
  // The one bot that would answer, whose agent the composer's commands follow.
  const recipientId =
    draftAudience !== 'invalid' && draftAudience.ids.length === 1 ? draftAudience.ids[0] : null
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
  const files = {
    /** The composer's file chips and + sheet; undefined while the host takes no attachments. */
    composer: uploadTo
      ? {
          files: attached.files,
          onAttachFiles: () => void attached.attachFiles(),
          onRemoveFile: (id: string) => attached.removeFiles([id])
        }
      : undefined,
    /** Where `@` finds workspace files, or nothing while that home's path is unknown. */
    workspace: workspace ?? {},
    /** The uploaded files a send carries, which ride as `@path`s as a chat's do. */
    uploaded: () =>
      attached.files.flatMap((file) => (file.path ? [{ ...file, path: file.path }] : [])),
    /** They leave the draft only once the post lands, so a refused send keeps them. */
    clearSent: (sent: readonly { id: string }[]) => attached.removeFiles(sent.map(({ id }) => id))
  }
  return { recipientId, roomMentions, faces, audience, photos, attachPhotos, files }
}
