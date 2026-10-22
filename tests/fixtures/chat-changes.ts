// Accessible DOM structure of GenUI 0.1.0's Changes/CommitChanges FileRow.
// Keep this fixture aligned with ui/components/changes.tsx in that plugin.
export function changesRow(container: HTMLElement, path: string, open = () => {}) {
  let list = container.querySelector('ul[aria-label="Changed files"]');
  if (!list) { list = document.createElement("ul"); list.setAttribute("aria-label", "Changed files"); container.append(list); }
  const row = document.createElement("li");
  const actions = document.createElement("div"); row.append(actions);
  const expander = document.createElement("button"); expander.type = "button";
  expander.setAttribute("aria-controls", "file-diff"); expander.setAttribute("aria-expanded", "false");
  expander.setAttribute("aria-label", `${path}, modified, 1 added, 0 removed`);
  const filename = document.createElement("span"); filename.title = path; filename.textContent = path;
  expander.append(filename); actions.append(expander);
  const button = document.createElement("button"); button.type = "button"; button.title = `Open ${path}`; button.setAttribute("aria-label", `Open ${path}`);
  const icon = document.createElementNS("http://www.w3.org/2000/svg", "svg"); button.append(icon);
  button.addEventListener("click", open); actions.append(button); list.append(row);
  return { row, button, expander, filename, icon };
}
