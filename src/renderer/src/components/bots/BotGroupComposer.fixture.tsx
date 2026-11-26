import { defineFixture } from '../../component-fixtures/component-fixture'
import { getDefaultSettings } from '../../../../shared/orca-profiles/constants'
import { botGroupCommandAvailable } from '../../../../shared/bots/bot-group-commands'
import { setRendererUiLanguage } from '@/i18n/i18n'
import { NativeChatComposer } from '../native-chat/composer/NativeChatComposer'
import { updateNativeChatComposerDraft } from '../native-chat/drafts/native-chat-composer-draft-store'
import type { NativeChatStructuredComposerTransport } from '../native-chat/composer/submit/native-chat-structured-composer-transport'

const scope = 'group-composer-fixture'
const transport: NativeChatStructuredComposerTransport = {
  runtime: 'local',
  runtimeEnvironmentId: null,
  sessionId: 'group-fixture',
  capturePresentation: () => () => true,
  send: async () => true,
  dispatchCommand: async () => ({ handled: false, accepted: false, error: null }),
  optionsSurface: {
    getSnapshot: () => [],
    subscribe: () => () => {},
    setOption: async () => ({ snapshot: [] }),
    invokeAction: async () => ({ snapshot: [] })
  },
  optionSnapshot: [],
  conversationCommands: ['clear', 'compact'],
  commandAvailable: botGroupCommandAvailable,
  sessionCommands: [
    { name: 'review', kind: 'command', description: 'Review the changes' },
    {
      name: 'skill:review-notes',
      kind: 'skill',
      description: 'Review notes',
      path: '/home/forge/skills/review-notes/SKILL.md'
    }
  ],
  onError: () => {}
}

function composerFixture(text: string, add = false) {
  return defineFixture({
    width: 640,
    store: { settings: { ...getDefaultSettings('/home/fixture'), uiLanguage: 'ko' } },
    setup: () => updateNativeChatComposerDraft(scope, { text, images: [] }, 'immediate'),
    render: () => (
      <div className="native-chat-appearance pt-64">
        <NativeChatComposer
          terminalTabId={scope}
          paneKey={scope}
          targetPtyId={null}
          agent="claude"
          structuredTransport={transport}
          room={{
            replies: () => <span>Forge</span>,
            mentions: [{ name: 'Forge', icon: null }],
            withFiles: true,
            placeholder: '무엇이든 물어보세요. @로 파일 참조, /로 명령어 실행'
          }}
        />
      </div>
    ),
    interact: async (frame) => {
      await setRendererUiLanguage('ko')
      if (!add) {
        const menu = document.querySelector('[role="listbox"]')
        if (!menu?.textContent?.includes('Review notes')) {
          throw new Error('Group slash menu is missing the recipient’s skill')
        }
      }
      if (add) {
        const button = frame.querySelector<HTMLButtonElement>('[data-slot="dropdown-menu-trigger"]')
        if (!button) {
          throw new Error('Missing group attachment menu')
        }
        button.dispatchEvent(
          new PointerEvent('pointerdown', { bubbles: true, button: 0, pointerType: 'mouse' })
        )
      }
    }
  })
}

export const addMenu = composerFixture('', true)
export const slashMenu = composerFixture('/')
export const addressedSlash = composerFixture('@Forge /')
