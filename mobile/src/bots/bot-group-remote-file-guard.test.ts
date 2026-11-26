import { describe, expect, it } from 'vitest'
import { sendsLocalFileToRemote } from './bot-group-remote-file-guard'

const HOME = '/Users/owner/.orca/bots/claude'
const local = { homeRoot: HOME, uploads: 0 }
const bots = [
  { id: 'claude', name: 'Claude' },
  { id: 'codex', name: 'Codex' }
]
const remote = {
  environmentId: 'studio',
  botId: 'helper',
  chatSessionId: 'chat-1',
  computer: 'Studio Mac',
  joinedAfter: 0,
  name: 'Helper',
  avatar: null
}
const members = [
  { botId: 'claude', sessionId: 's1' },
  { botId: 'codex', sessionId: 's2' }
]
const room = (replyMode: { kind: 'bot'; botId: string } | { kind: 'all' }) => ({
  members,
  remoteMembers: [remote],
  replyMode
})
const store =
  '@"/Users/owner/Library/Application Support/orca/agent-session-attachments/0f8fad5b-d9cb-469f-a165-70867728950e/report.pdf"'

describe('sendsLocalFileToRemote', () => {
  it('refuses a workspace path only when a paired-computer bot would receive it', () => {
    const file = `@${HOME}/memory/notes.md`
    expect(
      sendsLocalFileToRemote(
        `@Helper read ${file}`,
        room({ kind: 'bot', botId: 'claude' }),
        bots,
        local
      )
    ).toBe(true)
    expect(
      sendsLocalFileToRemote(
        `@everyone read ${file}`,
        room({ kind: 'bot', botId: 'claude' }),
        bots,
        local
      )
    ).toBe(true)
    expect(sendsLocalFileToRemote(`read ${file}`, room({ kind: 'all' }), bots, local)).toBe(true)
    expect(
      sendsLocalFileToRemote(`@"${HOME}/My Notes/a b.md"`, room({ kind: 'all' }), bots, local)
    ).toBe(true)
    // This computer's bots alone, uploads, other paths and no remote members stay allowed.
    expect(sendsLocalFileToRemote(`@Codex read ${file}`, room({ kind: 'all' }), bots, local)).toBe(
      false
    )
    expect(
      sendsLocalFileToRemote(`read ${file}`, room({ kind: 'bot', botId: 'claude' }), bots, local)
    ).toBe(false)
    expect(
      sendsLocalFileToRemote(`@Helper read ${store}`, room({ kind: 'all' }), bots, local)
    ).toBe(false)
    expect(
      sendsLocalFileToRemote(`@Helper read @${HOME}-2/x.md`, room({ kind: 'all' }), bots, local)
    ).toBe(false)
    expect(
      sendsLocalFileToRemote(
        `read ${file}`,
        { ...room({ kind: 'all' }), remoteMembers: [] },
        bots,
        local
      )
    ).toBe(false)
  })

  it('refuses uploaded files only when a paired-computer bot would receive them', () => {
    const uploads = { homeRoot: HOME, uploads: 1 }
    expect(sendsLocalFileToRemote('@Helper read this', room({ kind: 'all' }), bots, uploads)).toBe(
      true
    )
    expect(sendsLocalFileToRemote('read this', room({ kind: 'all' }), bots, uploads)).toBe(true)
    expect(
      sendsLocalFileToRemote('@Codex read this', room({ kind: 'all' }), bots, {
        homeRoot: null,
        uploads: 2
      })
    ).toBe(false)
    expect(
      sendsLocalFileToRemote('read this', room({ kind: 'bot', botId: 'claude' }), bots, uploads)
    ).toBe(false)
  })
})
