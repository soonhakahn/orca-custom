import { describe, expect, it } from 'vitest'
import { botGroupWorkspaceFilePath, botGroupWorkspaceRoot } from './bot-group-workspace-paths'

describe('botGroupWorkspaceFilePath', () => {
  it('joins a pick under the home in the host path flavor', () => {
    expect(botGroupWorkspaceFilePath('/srv/bot-home', 'a\\b.txt')).toBe('/srv/bot-home/a\\b.txt')
    expect(botGroupWorkspaceFilePath('/srv/bot-home/', 'memory/notes.md')).toBe(
      '/srv/bot-home/memory/notes.md'
    )
    expect(botGroupWorkspaceFilePath('C:\\Users\\me\\.orca\\bots\\claude', 'memory/a.md')).toBe(
      'C:/Users/me/.orca/bots/claude/memory/a.md'
    )
    // Every pick starts with the root a send checks it against.
    expect(botGroupWorkspaceRoot('/srv/bot-home/')).toBe('/srv/bot-home')
    expect(botGroupWorkspaceRoot('C:\\Users\\me\\.orca\\bots\\claude')).toBe(
      'C:/Users/me/.orca/bots/claude'
    )
  })
})
