const STORAGE_KEY = "mode";

const MODES = ["off", "view", "download"];
const DEFAULT_MODE = "off";

const RULESET_FOR_MODE = {
  view: "force_view",
  download: "force_download"
};

const ALL_RULESETS = Object.values(RULESET_FOR_MODE);

const TITLE_FOR_MODE = {
  off: "PDForce — Off (sites decide)",
  view: "PDForce — Force View",
  download: "PDForce — Force Download"
};

function normaliseMode(value) {
  return MODES.includes(value) ? value : DEFAULT_MODE;
}

async function getMode() {
  const stored = await chrome.storage.local.get(STORAGE_KEY);
  return normaliseMode(stored[STORAGE_KEY]);
}

function iconPaths(mode) {
  return {
    16: `icons/${mode}-16.png`,
    32: `icons/${mode}-32.png`,
    48: `icons/${mode}-48.png`,
    128: `icons/${mode}-128.png`
  };
}

async function applyMode(mode) {
  const wanted = RULESET_FOR_MODE[mode];

  await chrome.declarativeNetRequest.updateEnabledRulesets({
    enableRulesetIds: wanted ? [wanted] : [],
    disableRulesetIds: ALL_RULESETS.filter((id) => id !== wanted)
  });

  await chrome.action.setIcon({ path: iconPaths(mode) });
  await chrome.action.setTitle({ title: TITLE_FOR_MODE[mode] });
}

async function syncFromStorage() {
  await applyMode(await getMode());
}

chrome.runtime.onInstalled.addListener(() => {
  syncFromStorage();
});

chrome.runtime.onStartup.addListener(() => {
  syncFromStorage();
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local" || !changes[STORAGE_KEY]) return;
  applyMode(normaliseMode(changes[STORAGE_KEY].newValue));
});
