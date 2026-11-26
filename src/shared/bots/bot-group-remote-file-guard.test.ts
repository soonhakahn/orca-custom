import { describe, expect, it } from 'vitest'
import { sendsLocalFileToRemote } from './bot-group-remote-file-guard'

const bots = [
  { id: 'claude', name: 'Claude' },
  { id: 'codex', name: 'Codex' }
]
const remote = { environmentId: 'studio', botId: 'helper', name: 'Helper' }
const members = [
  { botId: 'claude', sessionId: 's1' },
  { botId: 'codex', sessionId: 's2' }
]
const room = (replyMode: { kind: 'bot'; botId: string } | { kind: 'all' }, remotes = [remote]) => ({
  members,
  remoteMembers: remotes,
  replyMode
})
const nothing = { uploads: 0, skills: 0 }
const toDefault = room({ kind: 'bot', botId: 'claude' })
const toAll = room({ kind: 'all' })

describe('sendsLocalFileToRemote', () => {
  it('refuses what only this computer holds when a paired-computer bot would receive it', () => {
    const file = '@/Users/owner/.orca/bots/claude/memory/notes.md'
    expect(sendsLocalFileToRemote(`@Helper read ${file}`, toDefault, bots, nothing)).toBe(true)
    expect(sendsLocalFileToRemote(`@everyone read ${file}`, toDefault, bots, nothing)).toBe(true)
    expect(sendsLocalFileToRemote(`read ${file}`, toAll, bots, nothing)).toBe(true)
    expect(
      sendsLocalFileToRemote('see @"/Users/owner/My Notes/a b.md"', toAll, bots, nothing)
    ).toBe(true)
    expect(sendsLocalFileToRemote('see @C:\\Users\\me\\a.md', toAll, bots, nothing)).toBe(true)
    expect(sendsLocalFileToRemote('read this', toAll, bots, { uploads: 1, skills: 0 })).toBe(true)
    expect(sendsLocalFileToRemote('/review', toAll, bots, { uploads: 0, skills: 1 })).toBe(true)
  })

  it('lets this computer’s bots alone, plain words and rooms without remote members through', () => {
    const file = '@/Users/owner/.orca/bots/claude/memory/notes.md'
    const all = { uploads: 2, skills: 1 }
    expect(sendsLocalFileToRemote(`@Codex read ${file}`, toAll, bots, all)).toBe(false)
    expect(sendsLocalFileToRemote(`read ${file}`, toDefault, bots, all)).toBe(false)
    expect(sendsLocalFileToRemote('@Helper what do you think?', toAll, bots, nothing)).toBe(false)
    expect(sendsLocalFileToRemote(`read ${file}`, room({ kind: 'all' }, []), bots, all)).toBe(false)
  })
})
