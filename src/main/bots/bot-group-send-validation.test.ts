import { expect, it } from 'vitest'
import { validateBotGroupSend, sameBotGroupSendPayload } from './bot-group-send-validation'
import { BotGroupMessageSchema } from '../../shared/bots/bot-group-schema'
import { BotGroupSend } from '../../shared/bots/bot-group'

const bots = [
  { id: 'a', name: 'Forge', agent: 'claude' },
  { id: 'b', name: 'Scout', agent: 'codex' }
]
const group = {
  members: [
    { botId: 'a', sessionId: 'sa' },
    { botId: 'b', sessionId: 'sb' }
  ],
  remoteMembers: [{ botId: 'r', environmentId: 'remote', name: 'Remote' }],
  replyMode: { kind: 'bot' as const, botId: 'a' }
}

it('admits agent commands only for one local recipient, and keeps host commands on the session mutation path', () => {
  expect(() =>
    validateBotGroupSend({ text: '@Forge /review', command: true }, group, bots, ['a'])
  ).not.toThrow()
  for (const audience of [[], ['a', 'b'], ['remote:remote:r']]) {
    expect(() =>
      validateBotGroupSend({ text: '/review', command: true }, group, bots, audience)
    ).toThrow('exactly one local bot')
  }
  for (const text of [
    '/clear',
    '/compact',
    '/model',
    '/plan',
    '/fork',
    '/usage',
    '/mcp',
    '/goal',
    '/resume',
    '/side'
  ]) {
    expect(() => validateBotGroupSend({ text, command: true }, group, bots, ['a'])).toThrow(
      'session controls'
    )
  }
  expect(() =>
    validateBotGroupSend(
      { text: '@everyone use $review', skills: [{ name: 'review', path: '/home/forge/SKILL.md' }] },
      group,
      bots,
      ['a', 'b', 'remote:remote:r']
    )
  ).toThrow('other computers')
})

it('persists explicit command and skill intent and refuses reusing an id with different execution metadata', () => {
  const skills = [{ name: 'review', path: '/home/forge/SKILL.md' }]
  const input = BotGroupSend.parse({
    groupId: 'room',
    messageId: '00000000-0000-4000-8000-000000000001',
    revision: 1,
    text: '/review',
    command: true,
    skills
  })
  const stored = BotGroupMessageSchema.parse({
    ...input,
    id: input.messageId,
    sequence: 1,
    author: { kind: 'owner' },
    turns: [],
    createdAt: 1
  })
  expect(stored.command).toBe(true)
  expect(stored.skills).toEqual([{ name: 'review', path: '/home/forge/SKILL.md' }])
  expect(sameBotGroupSendPayload(stored, input)).toBe(true)
  expect(sameBotGroupSendPayload(stored, { skills })).toBe(false)
  expect(
    sameBotGroupSendPayload(stored, {
      command: true,
      skills: [{ name: 'review', path: '/other/SKILL.md' }]
    })
  ).toBe(false)
})
