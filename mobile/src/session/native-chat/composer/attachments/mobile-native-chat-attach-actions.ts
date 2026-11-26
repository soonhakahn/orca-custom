import { AtSign, Image, Package, Paperclip, Terminal } from 'lucide-react-native'
import type { ActionSheetAction } from '../../../../components/sheets/ActionSheetModal'
import { translate } from '../../../../i18n/mobile-i18n'

// Dismiss the sheet before opening pickers because iOS cannot present them over its Modal.
export function mobileNativeChatAttachActions(args: {
  onPhotos: (() => void) | undefined
  onFiles: (() => void) | undefined
  onWorkspaceFile: (() => void) | undefined
  /** Undefined in a room, which runs no skills or commands. */
  onSkills: (() => void) | undefined
  onCommands: (() => void) | undefined
  skillCount: number
}): ActionSheetAction[] {
  const actions: ActionSheetAction[] = []
  if (args.onPhotos) {
    actions.push({
      id: 'photos',
      label: translate('session.nativeChatAttachActions.photos', 'Photos'),
      icon: Image,
      closeBeforePress: true,
      onPress: args.onPhotos
    })
  }
  if (args.onFiles) {
    actions.push({
      id: 'files',
      label: translate('session.nativeChatAttachActions.files', 'Files'),
      hint: translate('session.nativeChatAttachActions.fileTypes', 'PDF, text, code…'),
      icon: Paperclip,
      closeBeforePress: true,
      onPress: args.onFiles
    })
  }
  if (args.onWorkspaceFile) {
    actions.push({
      id: 'workspaceFile',
      label: translate('session.nativeChatAttachActions.workspaceFile', 'Workspace file'),
      icon: AtSign,
      closeBeforePress: true,
      onPress: args.onWorkspaceFile
    })
  }
  if (args.onSkills) {
    actions.push({
      id: 'skills',
      label: translate('session.nativeChatAttachActions.skills', 'Skills'),
      ...(args.skillCount > 0
        ? {
            hint: translate(
              'session.nativeChatAttachActions.availableSkills',
              '{{count}} available',
              {
                count: args.skillCount
              }
            )
          }
        : {}),
      icon: Package,
      closeBeforePress: true,
      onPress: args.onSkills
    })
  }
  if (args.onCommands) {
    actions.push({
      id: 'commands',
      label: translate('session.nativeChatAttachActions.commands', 'Commands'),
      icon: Terminal,
      closeBeforePress: true,
      onPress: args.onCommands
    })
  }
  return actions
}
