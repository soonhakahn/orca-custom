import { useState, type RefObject } from 'react'
import type { ComposerAutocomplete } from '../../../../../../shared/native-chat/input/composer/native-chat-composer-autocomplete'
import type { NativeChatComposerInput } from '../editor/native-chat-composer-input'
import type { NativeChatComposerRoom } from '../native-chat-composer-types'
import type { NativeChatAddMenu } from '../controls/NativeChatAttachButton'

export function useNativeChatComposerAddMenu(input: {
  room: NativeChatComposerRoom | undefined
  draft: string
  autocomplete: ComposerAutocomplete
  skills: boolean
  commands: boolean
  textareaRef: RefObject<NativeChatComposerInput | null>
  setDraft: (text: string) => void
  setCaret: (caret: number) => void
  setActiveSuggestion: (index: number) => void
  captureFiles: () => (paths: string[]) => void | Promise<void>
}): { autocomplete: ComposerAutocomplete; addMenu: NativeChatAddMenu | undefined } {
  const [narrow, setNarrow] = useState<{ kind: 'skill' | 'command'; triggerKey: string } | null>(
    null
  )
  const { autocomplete, draft, room } = input
  const open = (kind: 'file' | 'skill' | 'command') => {
    const next = `${draft}${draft && !/\s$/u.test(draft) ? ' ' : ''}${kind === 'file' ? '@' : '/'}`
    setNarrow(kind === 'file' ? null : { kind, triggerKey: `/:${next.length - 1}` })
    input.setDraft(next)
    input.setCaret(next.length)
    input.setActiveSuggestion(0)
    requestAnimationFrame(() => input.textareaRef.current?.focus())
  }
  return {
    autocomplete:
      autocomplete.mode === 'slash' && narrow?.triggerKey === autocomplete.triggerKey
        ? { ...autocomplete, items: autocomplete.items.filter((item) => item.kind === narrow.kind) }
        : autocomplete,
    addMenu: room?.replies
      ? {
          photos: () => {
            const attach = input.captureFiles()
            void window.api.shell.pickImage().then(async (path) => {
              if (path) {
                await attach([path])
              }
            })
          },
          files: room.withFiles ? () => open('file') : undefined,
          skills: input.skills ? () => open('skill') : undefined,
          commands: input.commands ? () => open('command') : undefined
        }
      : undefined
  }
}
