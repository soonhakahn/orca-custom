import {
  nativeChatTextWithFileReferences,
  type PendingNativeChatFile
} from '../session/native-chat/composer/attachments/mobile-native-chat-file-attachment'
import {
  mobileNativeChatDraftDestination,
  readMobileNativeChatDraftInputs,
  returnMobileNativeChatDraftAttachments,
  updateMobileNativeChatDraftInputs
} from '../session/native-chat/composer/drafts/mobile-native-chat-draft-inputs'

type SentFile = PendingNativeChatFile & { readonly path: string }

/** A group send's files, out of the draft at once as its photos are, so a send in flight shows no
 *  chip and a room reopened meanwhile can't bring one back; `restore` returns them, after any
 *  attached since, when the host refuses; `text` adds their `@path`s, as a chat's send does. Null
 *  while a pick or upload still runs: Send waits. */
export function takeBotGroupSendFiles(
  draftKey: string
): { files: readonly SentFile[]; text: (words: string) => string; restore: () => void } | null {
  const held = readMobileNativeChatDraftInputs(draftKey)
  if ((held.pending ?? 0) > 0 || held.files.some((file) => !file.path)) {
    return null
  }
  const files = held.files.flatMap((file) => (file.path ? [{ ...file, path: file.path }] : []))
  const destination = mobileNativeChatDraftDestination(draftKey)
  const sent = new Set(files.map((file) => file.id))
  updateMobileNativeChatDraftInputs(destination, (current) => ({
    ...current,
    files: current.files.filter((file) => !sent.has(file.id))
  }))
  return {
    files,
    text: (words) => nativeChatTextWithFileReferences(words, files),
    restore: () => returnMobileNativeChatDraftAttachments(destination, [], files)
  }
}
