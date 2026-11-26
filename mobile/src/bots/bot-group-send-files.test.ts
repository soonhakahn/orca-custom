import { describe, expect, it, vi } from 'vitest'
import {
  readMobileNativeChatDraftInputs,
  updateMobileNativeChatDraftInputs
} from '../session/native-chat/composer/drafts/mobile-native-chat-draft-inputs'
import { takeBotGroupSendFiles } from './bot-group-send-files'

vi.mock('@react-native-async-storage/async-storage', async () => {
  const { createInMemoryAsyncStorage } = await import('../test-support/in-memory-async-storage')
  return { default: createInMemoryAsyncStorage() }
})

const file = (id: string, path: string | null) => ({
  id,
  name: `${id}.pdf`,
  mime: 'application/pdf',
  byteLength: 10,
  path
})

describe('takeBotGroupSendFiles', () => {
  it('waits for picks, takes uploads out before the send, and returns them after a refusal', () => {
    const key = 'group-draft:host:room'
    updateMobileNativeChatDraftInputs(key, (current) => ({
      ...current,
      files: [file('a', '/store/a.pdf')],
      pending: 1
    }))
    expect(takeBotGroupSendFiles(key)).toBeNull()
    updateMobileNativeChatDraftInputs(key, (current) => ({
      ...current,
      files: [...current.files, file('b', null)],
      pending: 0
    }))
    expect(takeBotGroupSendFiles(key)).toBeNull()
    expect(readMobileNativeChatDraftInputs(key).files.map(({ id }) => id)).toEqual(['a', 'b'])

    updateMobileNativeChatDraftInputs(key, (current) => ({
      ...current,
      files: [file('a', '/store/a.pdf'), file('b', '/store/b.pdf')]
    }))
    const taken = takeBotGroupSendFiles(key)
    expect(taken?.files.map(({ path }) => path)).toEqual(['/store/a.pdf', '/store/b.pdf'])
    expect(readMobileNativeChatDraftInputs(key).files).toEqual([])

    // One attached while the send was in flight stays first; the refused ones follow it.
    updateMobileNativeChatDraftInputs(key, (current) => ({
      ...current,
      files: [file('c', '/store/c.pdf')]
    }))
    taken?.restore()
    expect(readMobileNativeChatDraftInputs(key).files.map(({ id }) => id)).toEqual(['c', 'a', 'b'])
  })
})
