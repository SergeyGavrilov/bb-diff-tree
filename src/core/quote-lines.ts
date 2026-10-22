export function formatQuote(path: string, revision: string, content: string, location: string) {
  let longest = 0;
  for (const match of content.matchAll(/`+/g)) longest = Math.max(longest, match[0].length);
  const fence = "`".repeat(Math.max(3, longest + 1));
  return `${JSON.stringify(path)} · ${location} · ${revision}\n\n${fence}\n${content}\n${fence}`;
}
