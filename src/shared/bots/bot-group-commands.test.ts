import { describe, expect, it } from 'vitest'
import {
  botGroupLeadingCommand,
  isBotGroupSessionCommand,
  botGroupSkillBotId,
  botGroupCommandAvailable
} from './bot-group-commands'

describe('botGroupLeadingCommand', () => {
  it('finds the command a post gives its one member, past the @Name addressing it', () => {
    expect(botGroupLeadingCommand('/review the diff', 'Forge')).toBe('/review the diff')
    expect(botGroupLeadingCommand('@forge, /compact', 'Forge')).toBe('/compact')
    expect(botGroupLeadingCommand('@everyone /plan', 'Forge')).toBe('/plan')
    expect(botGroupLeadingCommand('/Users/me/a.txt what is this?', 'Forge')).toBeNull()
    expect(botGroupLeadingCommand('please /review it', 'Forge')).toBeNull()
    expect(botGroupLeadingCommand('@Scout /review', 'Forge')).toBeNull()
    expect(botGroupLeadingCommand('@Forge @Scout /review', ['Scout', 'Forge'])).toBe('/review')
    expect(botGroupLeadingCommand('@Forge! /review', 'Forge')).toBe('/review')
    expect(botGroupLeadingCommand('@ForgeBot /review', 'Forge')).toBeNull()
  })
})

it('selects skills from the addressed bot, else the default, and hides host paths from remote recipients', () => {
  const bots = [
    { id: 'forge', name: 'Forge' },
    { id: 'scout', name: 'Scout' }
  ]
  const group = {
    members: [
      { botId: 'forge', sessionId: 'a' },
      { botId: 'scout', sessionId: 'b' }
    ],
    replyMode: { kind: 'bot' as const, botId: 'forge' },
    remoteMembers: [{ environmentId: 'remote', botId: 'r', name: 'Remote' }]
  }
  expect(botGroupSkillBotId('', group, bots)).toBe('forge')
  expect(botGroupSkillBotId('@Scout /', group, bots)).toBe('scout')
  expect(botGroupSkillBotId('@Scout @Forge /', group, bots)).toBe('forge')
  expect(botGroupSkillBotId('@everyone /', group, bots)).toBeNull()
  expect(botGroupSkillBotId('@Remote /', group, bots)).toBeNull()
  expect(botGroupSkillBotId('', { ...group, replyMode: { kind: 'all' } }, bots)).toBeNull()
  expect(
    ['fork', 'usage', 'mcp', 'goal', 'resume', 'side', 'btw'].map(botGroupCommandAvailable)
  ).toEqual([false, false, false, false, false, false, false])
})

describe('isBotGroupSessionCommand', () => {
  it('runs only compact, model, effort and permission-mode commands on the session', () => {
    expect(isBotGroupSessionCommand('/compact', 'claude')).toBe(true)
    expect(isBotGroupSessionCommand('/model Opus 5.5', 'claude')).toBe(true)
    expect(isBotGroupSessionCommand('/plan', 'claude')).toBe(true)
    expect(isBotGroupSessionCommand('/default', 'codex')).toBe(true)
    expect(isBotGroupSessionCommand('/clear', 'claude')).toBe(true)
    expect(isBotGroupSessionCommand('/fork', 'claude')).toBe(false)
    expect(isBotGroupSessionCommand('/review', 'claude')).toBe(false)
  })
})
