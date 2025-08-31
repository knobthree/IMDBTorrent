(function () {
  const BLOCK_ID = "imdbh-rightcol-block";
  const BTN_ID   = "imdbh-open-btn";
  const PANEL_ID = "imdb-helper-popup";
  const CLOSE_ID = "imdb-helper-popup-close";



  function getTargetContainer(){
	const el = document.querySelector("[data-testid='reviewContent-all-reviews']");
	if(!el)return;
	return el.parentElement;
  }

  function ensureInjected(){
    if (document.getElementById(BLOCK_ID)) return;

    const container = getTargetContainer();
    if (!container) return;

    const block = document.createElement("div");
    block.id = BLOCK_ID;
    block.className = "imdbh-rightcol-block";

    const btn = document.createElement("button");
    btn.id = BTN_ID;
    btn.type = "button";
    btn.className = "imdbh-btn";
    btn.textContent = "Torrent";
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      openPopup();
    });

    block.appendChild(btn);

    // Insert as the FIRST child of the parent-parent container
    container.insertBefore(block, container.firstElementChild || null);
  }

  // ----- Popup (same as before) -----
  function ensurePopup() {
    let panel = document.getElementById(PANEL_ID);
    if (panel) return panel;

    panel = document.createElement("div");
    panel.id = PANEL_ID;
    panel.innerHTML = `
      <div class="imdbh-header">
        <span>IMDBTorrent</span>
        <button id="${CLOSE_ID}" class="imdbh-close" aria-label="Close">×</button>
      </div>
      <div class="imdbh-body">
        
      </div>
    `;
    document.body.appendChild(panel);

    document.getElementById(CLOSE_ID).addEventListener("click", () => panel.remove());
    return panel;
  }
  
  function getCurrentMovieName(){
	  
	  const match = document.documentElement.innerHTML.match(/"titleText":\{"text":"(.*?)"/);
	  if (match) {
	     console.log("SPECIAL FIND "+match[1]); // → Desire
		 return match[1];
	  }
	  else console.log("NO SPECIAL FIND");

	  
	  var el = document.querySelector("[data-testid='hero__primary-text']");
	  if(!el)return;
	  return el.innerText;
  }
  
  //something is causing need for debounce when pressing the extension button ...
  let lastCallStamp = 0;

  function openPopup()
  {
	const now = Date.now();
	if (now - lastCallStamp < 100) return;
	lastCallStamp = now;
	  
	  
    const panel = ensurePopup();
    panel.style.display = "block";
	
    let movieName = getCurrentMovieName();
    if(!movieName){
      log("Error: Cannot get name of movie. Are you looking at page of one?");
      return;
    }
    
    
    TorrentSearch.search("[class='imdbh-body']", movieName, currentPageImdbId);
  }

  function boot(){
    ensureInjected();

    // Re-run when IMDb updates the DOM or navigates SPA-style
    const mo = new MutationObserver(() => ensureInjected());
    mo.observe(document.documentElement, { childList: true, subtree: true });

    const _push = history.pushState;
    history.pushState = function(){
      const r = _push.apply(this, arguments);
      setTimeout(ensureInjected, 300);
      return r;
    };
    window.addEventListener("popstate", () => setTimeout(ensureInjected, 300));
	
	chrome.runtime.onMessage.addListener((msg) => {
		if (msg?.t === "torrentThisMovie") torrentThisMovie();
	});
  }
  
   function torrentThisMovie() {
     openPopup();
   }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
  
  const log = (msg) => {
    const el = document.querySelector("[class='imdbh-body']");
    const line = document.createElement("div");
    line.textContent = msg;
    el.appendChild(line);
  };

})();





const currentPageImdbId = (window.location.href.match(/\/title\/(tt\d+)/) || [])[1];


const TorrentSearch = (() => {
    const BASE_URL = "https://apibay.org/";
    const TRACKERS = [
        "udp://tracker.opentrackr.org:1337",
        "udp://open.stealth.si:80/announce",
        "udp://tracker.torrent.eu.org:451/announce",
        "udp://tracker.bittor.pw:1337/announce",
        "udp://public.popcorn-tracker.org:6969/announce",
        "udp://tracker.dler.org:6969/announce",
        "udp://exodus.desync.com:6969",
        "udp://open.demonii.com:1337/announce"
    ];

    const magnetFrom = (infoHash, name) => {
        const dn = encodeURIComponent(name || "");
        const tr = TRACKERS.map(t => "&tr=" + encodeURIComponent(t)).join("");
        return `magnet:?xt=urn:btih:${infoHash}&dn=${dn}${tr}`;
    };

    const getLogEl = (selector) => {
        const el = document.querySelector(selector);
        if (!el) throw new Error(`Log element not found for selector: ${selector}`);
        return el;
    };

    const log = (el, msg) => {
		console.log(log);
        const line = document.createElement("div");
        line.textContent = msg;
        el.appendChild(line);
    };	

	const renderResults = (logEl, results) => {
		
		if(results.length > 0) {
			//logEl.innerHTML = ""; // clear loggy logs
			const divs = logEl.querySelectorAll("div");
			divs.forEach(d => d.remove());
		}
		
		
		
		//sort so that results with matching IMDB id are first as long as results have over x seeds.
		//Below that treshold just don't care, to avoid situations where dead "more valid" torrents are only shown
		results.sort((a,b) => {
			const aPrio = (a.seeders > 10 && a.imdb == currentPageImdbId) ? 1 : 0;
			const bPrio = (b.seeders > 10 && b.imdb == currentPageImdbId) ? 1 : 0;
			
			if(aPrio !== bPrio) {
				return bPrio - aPrio;
			}
			
			return b.seeds - a.seeds;
		});
		

		results.slice(0, Math.min(5, results.length)).forEach(r => {
			const sizeGB = (Number(r.size) || 0) / (1024 ** 3);
			const seeds = r.seeders ?? 0;

			const a = document.createElement("a");
			a.href = r.MagnetLink;
			a.target = "_blank";
			a.rel = "noopener noreferrer";
			a.style.display = "grid";
			a.style.gridTemplateColumns = "7rem 7rem 1fr";
			a.style.gap = "0.75rem";
			a.style.alignItems = "baseline";
			a.style.padding = "4px 6px";
			a.style.textDecoration = "none";
			a.style.color = "inherit";

			a.onmouseover = () => a.style.background = "rgba(0,0,0,.06)";
			a.onmouseout  = () => a.style.background = "";

			const size = document.createElement("span");
			size.textContent = sizeGB.toFixed(1) + " GB";
			size.style.fontFamily = "monospace";

			const seedsEl = document.createElement("span");
			seedsEl.textContent = "Seeds: " + seeds;
			seedsEl.style.fontFamily = "monospace";

			const name = document.createElement("span");
			name.textContent = r.name;

			a.appendChild(size);
			a.appendChild(seedsEl);
			a.appendChild(name);

			logEl.appendChild(a);
		});
	};


	async function internalSearch(query, logEl) {

	  log(logEl, `[TorrentSearch] Query: "${query}"`);

	  const fullUrl = `${BASE_URL}q.php?q=${encodeURIComponent(query)}&cat=200`;
	  log(logEl, `[TorrentSearch] GET ${fullUrl}`);

	  let json;
	  try {
		const res = await fetchExt(fullUrl, { method: "GET" });
		if (!res.ok) throw new Error(`HTTP ${res.status}`);
		const text = await res.body;
		console.log(text);
		// apibay sometimes returns "null" for no results
		json = text && text.trim() !== "null" ? JSON.parse(text) : [];
	  } catch (e) {
		log(logEl, `[TorrentSearch] ERROR: ${e.message}`);
		throw e;
	  }

	  log(logEl, `[TorrentSearch] Results: ${json.length}`);
	  


	  // Normalize + add magnet
	  let result = json.map(r => ({
		id: parseInt(r.id, 10),
		name: r.name,
		info_hash: r.info_hash,
		leechers: parseInt(r.leechers, 10),
		seeders: parseInt(r.seeders, 10),
		num_files: parseInt(r.num_files, 10),
		size: parseInt(r.size, 10),
		username: r.username,
		added: parseInt(r.added, 10),
		status: r.status,
		category: parseInt(r.category, 10),
		imdb: r.imdb,
		get MagnetLink() { return magnetFrom(this.info_hash, this.name); }
	  }));
	  
	   logEl.appendChild(
		  document.createTextNode(
			"Open search page: "
	     )
	  );
	  
	  const openTPBLink = document.createElement("a");
	  openTPBLink.href = `https://thepiratebay.org/search.php?q=${encodeURIComponent(query)}&cat=200`;
	  openTPBLink.target = "_blank";
	  openTPBLink.textContent = query + " (" + result.length+" result"+ (result.length == 1 ? "" : "s") +")";
	  //openTPBLink.classList.add("novisited");
	  openTPBLink.style.color = "blue";
	  logEl.appendChild(openTPBLink);
	  logEl.appendChild(document.createElement("br"));
	  
	  return result;
	}


	// Original search now runs one or two internal searches, combines, then renders.
	async function search(logSelector, query, query2) {
	  const logEl = getLogEl(logSelector);

	  const res1 = await internalSearch(query, logEl);
	  let combined = res1;

	  if (query2 && query2 !== query) {
		const res2 = await internalSearch(query2, logEl);

		// Dedupe by id (fallback to info_hash)
		const map = new Map();
		for (const r of [...res1, ...res2]) {
		  const key = Number.isFinite(r.id) ? `id:${r.id}` : `hash:${r.info_hash}`;
		  if (!map.has(key)) map.set(key, r);
		}
		combined = Array.from(map.values());
	  }

	  // Optional: sort by seeders desc; comment out if you want raw order
	  // combined.sort((a, b) => (b.seeders|0) - (a.seeders|0));

	  renderResults(logEl, combined);
	  return combined;
	}

  // FIX: expose the API so TorrentSearch.search works
  return { search, internalSearch, renderResults, getLogEl, magnetFrom };

})();

//const fetchExt = (url, opts) => chrome.runtime.sendMessage({ t: "fetch", url, opts });

// drop-in replacement for your existing fetchExt:
const fetchExt = (url, opts) => {
  const msg = { t: "fetch", url, opts };
  try {
    // Chrome MV3 returns a Promise here
    const maybe = chrome.runtime.sendMessage(msg);
    if (maybe && typeof maybe.then === "function") return maybe;

    // Firefox MV2 uses callbacks → wrap in a Promise
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(msg, (resp) => {
        if (chrome.runtime.lastError) return reject(chrome.runtime.lastError);
        resolve(resp);
      });
    });
  } catch (e) {
    return Promise.reject(e);
  }
};

