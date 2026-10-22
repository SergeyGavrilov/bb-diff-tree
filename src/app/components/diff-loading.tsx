export function DiffLoading({ smooth }: { smooth: boolean }) {
  if (!smooth) return <div className="dt-notice" role="status">Loading diff…</div>;
  return <div className="dt-diff-skeleton" role="status" aria-label="Loading diff">
    <span className="dt-sr-only">Loading diff…</span>
    <div aria-hidden="true">{[56, 74, 38, 62, 45, 81, 52, 31, 68, 47].map((width, index) =>
      <div className="dt-placeholder-row" key={index}><span className="dt-placeholder-gutter" /><span className="dt-placeholder-code" style={{ width: `${width}%` }} /></div>)}</div>
  </div>;
}
