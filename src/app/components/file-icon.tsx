import { getIcon } from "seti-file-icons";

const colors = {
  blue: "#519aba", grey: "var(--muted-foreground)", "grey-light": "var(--muted-foreground)",
  green: "#8dc149", orange: "#e37933", pink: "#f55385", purple: "#a074c4",
  red: "#cc3e44", white: "var(--foreground)", yellow: "#cbcb41", ignore: "var(--muted-foreground)",
};
const generic = getIcon("").svg;

export function fileIcon(path: string) {
  const name = path.split(/[\\/]/).pop() ?? "";
  const exact = getIcon(name);
  const icon = exact.svg === generic ? getIcon(name.toLowerCase()) : exact;
  return { svg: icon.svg, color: colors[icon.color] };
}

export function FileIcon({ path }: { path: string }) {
  const icon = fileIcon(path);
  // Only trusted, bundled SVG from Seti is inserted; filenames never become markup.
  return <span className="dt-icon dt-file-icon" aria-hidden="true" style={{ color: icon.color }} dangerouslySetInnerHTML={{ __html: icon.svg }} />;
}
