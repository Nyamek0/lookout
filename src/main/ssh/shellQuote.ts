/** POSIX single-quote an argument so the remote shell sees it as one literal word. */
export function shellQuote(arg: string): string {
  return `'${arg.replace(/'/g, `'\\''`)}'`
}
