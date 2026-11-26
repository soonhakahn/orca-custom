import { describe, expect, it } from 'vitest'
import { sendsWorkspaceFileToRemote } from './bot-group-workspace-file-guard'

const HOME = '/Users/owner/.orca/bots/claude'
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

describe('sendsWorkspaceFileToRemote', () => {
  it('refuses a workspace path only when a paired-computer bot would receive it', () => {
    const file = `@${HOME}/memory/notes.md`
    expect(
      sendsWorkspaceFileToRemote(
        `@Helper read ${file}`,
        room({ kind: 'bot', botId: 'claude' }),
        bots,
        HOME
      )
    ).toBe(true)
    expect(
      sendsWorkspaceFileToRemote(
        `@everyone read ${file}`,
        room({ kind: 'bot', botId: 'claude' }),
        bots,
        HOME
      )
    ).toBe(true)
    expect(sendsWorkspaceFileToRemote(`read ${file}`, room({ kind: 'all' }), bots, HOME)).toBe(true)
    expect(
      sendsWorkspaceFileToRemote(`@"${HOME}/My Notes/a b.md"`, room({ kind: 'all' }), bots, HOME)
    ).toBe(true)
    // This computer's bots alone, uploads, other paths and no remote members stay allowed.
    expect(
      sendsWorkspaceFileToRemote(`@Codex read ${file}`, room({ kind: 'all' }), bots, HOME)
    ).toBe(false)
    expect(
      sendsWorkspaceFileToRemote(`read ${file}`, room({ kind: 'bot', botId: 'claude' }), bots, HOME)
    ).toBe(false)
    expect(
      sendsWorkspaceFileToRemote(`@Helper read ${store}`, room({ kind: 'all' }), bots, HOME)
    ).toBe(false)
    expect(
      sendsWorkspaceFileToRemote(`@Helper read @${HOME}-2/x.md`, room({ kind: 'all' }), bots, HOME)
    ).toBe(false)
    expect(
      sendsWorkspaceFileToRemote(
        `read ${file}`,
        { ...room({ kind: 'all' }), remoteMembers: [] },
        bots,
        HOME
      )
    ).toBe(false)
  })
})
