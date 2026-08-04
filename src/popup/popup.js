const STORAGE_KEY = "mode";
const MODES = ["off", "view", "download"];

const buttons = Array.from(document.querySelectorAll(".mode"));

function render(mode) {
  for (const button of buttons) {
    button.setAttribute("aria-checked", String(button.dataset.mode === mode));
  }
}

function select(mode) {
  render(mode);
  chrome.storage.local.set({ [STORAGE_KEY]: mode });
}

for (const button of buttons) {
  button.addEventListener("click", () => select(button.dataset.mode));
}

document.addEventListener("keydown", (event) => {
  if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
  const current = buttons.findIndex((b) => b.getAttribute("aria-checked") === "true");
  const step = event.key === "ArrowDown" ? 1 : -1;
  const next = (current + step + buttons.length) % buttons.length;
  buttons[next].focus();
  select(buttons[next].dataset.mode);
  event.preventDefault();
});

chrome.storage.local.get(STORAGE_KEY, (stored) => {
  const mode = stored && MODES.includes(stored[STORAGE_KEY]) ? stored[STORAGE_KEY] : "off";
  render(mode);
});
