/** The command as a person would read (and type) it: quotes only where the shell needs them. */
export function formatCommand(argv: string[]): string {
  return argv.map((a) => (/^[A-Za-z0-9_@%+=:,./-]+$/.test(a) ? a : shellQuote(a))).join(' ')
}

/** POSIX single-quote an argument so the remote shell sees it as one literal word. */
export function shellQuote(arg: string): string {
  return `'${arg.replace(/'/g, `'\\''`)}'`
}
