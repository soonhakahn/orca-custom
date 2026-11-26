import { agentSessionInteractionCommand } from '../agent-session/options/permissions/agent-session-interaction-mode'
import { botGroupDraftAudience } from './bot-group-mentions'

const EXCLUDED = new Set(['fork', 'usage', 'mcp', 'goal', 'resume', 'side', 'btw'])

export const botGroupCommandAvailable = (name: string): boolean => !EXCLUDED.has(name.toLowerCase())

/** Skills come from the sole recipient, else the default replier; host paths never cross computers. */
export function botGroupSkillBotId(
  text: string,
  group: Parameters<typeof botGroupDraftAudience>[1],
  bots: Parameters<typeof botGroupDraftAudience>[2]
): string | null {
  const audience = botGroupDraftAudience(text, group, bots)
  if (
    audience === 'invalid' ||
    audience.ids.some((id) => !group.members.some((m) => m.botId === id))
  ) {
    return null
  }
  const id =
    audience.ids.length === 1
      ? audience.ids[0]
      : group.replyMode.kind === 'bot'
        ? group.replyMode.botId
        : null
  return group.members.some((m) => m.botId === id) ? (id ?? null) : null
}

/** The command a group draft or post gives its one addressed member: `/name …` after any `@Name`
 *  (or `@everyone`) addressing it; null for prose, a path such as `/Users/me/a.txt`, or a command
 *  written later in the text. */
export function botGroupLeadingCommand(
  text: string,
  botName: string | readonly string[]
): string | null {
  let rest = text.trimStart()
  const names = [...(typeof botName === 'string' ? [botName] : botName), 'everyone'].sort(
    (a, b) => b.length - a.length
  )
  for (;;) {
    const name = names.find(
      (name) =>
        rest.slice(0, name.length + 1).toLocaleLowerCase() === `@${name}`.toLocaleLowerCase() &&
        /^[\s,:!?]/u.test(rest.slice(name.length + 1))
    )
    if (name === undefined) {
      break
    }
    rest = rest.slice(name.length + 1).replace(/^[\s,:!?]+/u, '')
  }
  if (!/^\/[\p{L}\p{N}][\p{L}\p{N}_:.-]*(?:\s|$)/u.test(rest)) {
    return null
  }
  rest = rest.trimEnd()
  for (;;) {
    const name = names.find((name) =>
      rest.toLocaleLowerCase().endsWith(` @${name}`.toLocaleLowerCase())
    )
    if (name === undefined) {
      return rest
    }
    rest = rest.slice(0, -name.length - 2).trimEnd()
  }
}

const SESSION_COMMANDS = new Set(['clear', 'compact', 'model', 'effort'])

/** Whether `command` (from botGroupLeadingCommand) runs on the member's session, as its chat runs it;
 *  any other command goes to the member as its own message, for its agent to answer. */
export function isBotGroupSessionCommand(command: string, agent: string): boolean {
  const name = /^\/(\S+)/u.exec(command)?.[1]?.toLowerCase()
  return (
    name !== undefined &&
    (SESSION_COMMANDS.has(name) ||
      (agent === 'codex' && name === 'new') ||
      agentSessionInteractionCommand(agent, command) !== null)
  )
}
