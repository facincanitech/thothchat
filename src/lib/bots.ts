export function parseCommand(text: string): { command: string; args: string[]; rest: string } | null {
  const trimmed = text.trim()
  if (!trimmed.startsWith('/')) return null
  const [command, ...args] = trimmed.split(/\s+/)
  const rest = trimmed.slice(command.length).trim()
  return { command: command.toLowerCase(), args, rest }
}

export function rollDice(sides: number): number {
  return 1 + Math.floor(Math.random() * Math.max(1, sides))
}

export function pickRandom<T>(items: T[]): T | null {
  if (items.length === 0) return null
  return items[Math.floor(Math.random() * items.length)]
}
