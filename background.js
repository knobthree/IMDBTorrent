// ---- Compat helpers ----
const actionAPI = (chrome.action || chrome.browserAction);

// Messaging: always reply via sendResponse and return true (works in both)
chrome.runtime.onMessage.addListener((m, s, sendResponse) => {
  if (m?.t !== "fetch") return; // ignore others

  (async () => {
    try {
      const r = await fetch(m.url, m.opts);
      const body = await r.text();
      sendResponse({ ok: true, status: r.status, body });
    } catch (e) {
      sendResponse({ ok: false, error: String(e) });
    }
  })();

  return true; // keep the message channel open for async reply
});

actionAPI.onClicked.addListener((tab) => {
  if (!tab?.id) return;

  chrome.tabs.sendMessage(tab.id, { t: "torrentThisMovie" }, () => {
    if (!chrome.runtime.lastError) return; // message delivered

    // Content script likely not loaded -> inject it, then retry
    const resend = () => chrome.tabs.sendMessage(tab.id, { t: "torrentThisMovie" });
    if (chrome.scripting && chrome.scripting.executeScript) {
      chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["content.js"] })
        .then(resend)
        .catch(() => {});
    } else {
      chrome.tabs.executeScript(tab.id, { file: "content.js" }, resend);
    }
  });
});




