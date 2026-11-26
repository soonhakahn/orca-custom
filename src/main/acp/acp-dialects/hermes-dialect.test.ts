import { describe, expect, it } from 'vitest'
import { isQuietBotResult } from '../../../shared/bot-quiet-result'
import { AcpTimelineTranslator } from '../timeline/acp-timeline-translator'
import { HERMES_ACP_DIALECT } from './hermes-dialect'

const EN_SILENCE_WARNING =
  '\n\n\u26A0\uFE0F The model returned only a silence marker for a message that needed a reply. Try again or rephrase.'
const KO_SILENCE_WARNING =
  '\n\n\u26A0\uFE0F 답변이 필요한 메시지에 모델이 무응답 표시만 반환했어요. 다시 시도하거나 다르게 표현해 보세요.'

function runHermesChunks(chunks: readonly string[]) {
  const lane = new AcpTimelineTranslator({
    sessionId: 'root',
    dialect: HERMES_ACP_DIALECT,
    agentName: 'Hermes'
  })
  lane.openPrompt('prompt-1', 1)
  const events = chunks.flatMap((text, index) =>
    lane.notification(
      'session/update',
      {
        sessionId: 'root',
        update: { sessionUpdate: 'agent_message_chunk', content: { type: 'text', text } }
      },
      index + 2
    )
  )
  const text = events
    .flatMap((event) =>
      event.type === 'text.delta' && event.channel === 'assistant' ? [event.text] : []
    )
    .join('')
  const statuses = events.flatMap((event) =>
    event.type === 'item.update' && event.body.kind === 'status' ? [event.body] : []
  )
  return { text, statuses }
}

describe('HERMES_ACP_DIALECT unexpected silence notice', () => {
  it.each([EN_SILENCE_WARNING, KO_SILENCE_WARNING])(
    'drops Hermes silence warning after NO_REPLY so the turn stays quiet',
    (warning) => {
      const result = runHermesChunks(['NO_REPLY', warning])
      expect(result.text).toBe('NO_REPLY')
      expect(isQuietBotResult(result.text)).toBe(true)
      expect(result.statuses).toEqual([])
    }
  )

  it('keeps normal replies, quoted mentions of the warning, and genuine Hermes errors', () => {
    const quoted =
      'The model returned only a silence marker for a message that needed a reply. Try again or rephrase. That comes from locales/en.yaml.'
    expect(runHermesChunks([quoted]).text).toBe(quoted)

    const otherWarning = '\u26A0\uFE0F Rate limit exceeded. Try again later.'
    expect(runHermesChunks([otherWarning]).text).toBe(otherWarning)

    const noProvider = runHermesChunks([
      '\u26A0\uFE0F Hermes is not connected to any AI provider yet. Run `hermes login`.'
    ])
    expect(noProvider.text).toBe('')
    expect(noProvider.statuses).toMatchObject([{ tone: 'error' }])
  })
})
