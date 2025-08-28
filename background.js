chrome.runtime.onMessage.addListener((m, s, send) => {
  console.log("1");
  if (m?.t !== "fetch") return;
  (async () => {
    try {
		console.log("2");
      const r = await fetch(m.url, m.opts);
      const body = await r.text();
	  console.log("3");
      send({ ok: true, status: r.status, body });
	  console.log("4");
    } catch (e) { send({ ok: false, error: String(e) }); }
  })();
  return true; // keep port open
});


chrome.action.onClicked.addListener(async (tab) => {
  if (!tab.id) return;
  // send a message to the active tab’s content script
  chrome.tabs.sendMessage(tab.id, { t: "torrentThisMovie" });
});