export function ActionIcon({ kind }: { kind: "refresh" | "expand" | "collapse" | "quote" }) {
  const paths = { refresh: "M20 7v5h-5 M20 12a8 8 0 1 0-2 5 M20 7l-3-3", expand: "m8 9 4-4 4 4 M8 15l4 4 4-4", collapse: "m8 5 4 4 4-4 M8 19l4-4 4 4", quote: "M21 11a8 8 0 0 1-8 8H7l-4 3v-6a8 8 0 1 1 18-5 M8 11h8 M12 7v8" };
  return <svg className="dt-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[kind]} /></svg>;
}
