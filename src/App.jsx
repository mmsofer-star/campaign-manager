
import { useState, useEffect, useCallback, useRef } from "react";

const SUPABASE_URL = "https://ppilsjtlglteeezrbktg.supabase.co";
const SUPABASE_KEY = "sb_publishable_YS6JywbZMaUyZWxYLwaHAg_qQS18gIk";

async function sbGet(table, id) {
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}?id=eq.${id}&select=data`, {
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
    });
    const rows = await r.json();
    return rows?.[0]?.data ?? null;
  } catch { return null; }
}

async function sbSet(table, id, data) {
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
      method: "POST",
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates"
      },
      body: JSON.stringify({ id, data, updated_at: new Date().toISOString() })
    });
  } catch {}
}

const CIRCLES = {
  FIRST: { label: "First Circle", short: "1st", color: "#C8522A", bg: "#FFF0EB" },
  SECOND: { label: "Second Circle", short: "2nd", color: "#B07D2E", bg: "#FFF8EB" },
  THIRD: { label: "Third Circle", short: "3rd", color: "#4A7B6F", bg: "#EBF5F2" },
  NOT_RELEVANT: { label: "Not Relevant", short: "N/R", color: "#999", bg: "#F5F5F5" },
  UNASSIGNED: { label: "Unassigned", short: "?", color: "#666", bg: "#F0F0F0" },
};
const STATUSES = [
  { key: "NOT_CONTACTED", label: "Not Contacted", color: "#aaa", icon: "○" },
  { key: "CONTACTED", label: "Contacted", color: "#B07D2E", icon: "◑" },
  { key: "INTERESTED", label: "Interested", color: "#4A7B6F", icon: "◕" },
  { key: "PLEDGED", label: "Pledged", color: "#5B7EC8", icon: "★" },
  { key: "DONATED", label: "Donated", color: "#2E7D32", icon: "✓" },
];
const WA = {
  FIRST: "Hi [NAME], I hope you're doing well! As someone who has been such a meaningful part of our community, I wanted to personally reach out about our annual campaign. Your support has always made a real difference, and this year we have a special matching opportunity that doubles every gift. Would love to connect — when's a good time to talk?",
  SECOND: "Hi [NAME]! It's me from Chabad House. We're launching our annual campaign and I'd love to tell you about some exciting things we're doing. Every gift is being matched this year, which makes your support go even further. Could we chat for a few minutes?",
  THIRD: "Hi [NAME], I'm reaching out from Chabad House about our community campaign. We'd love your support as we continue to serve the community. There's a special matching opportunity this year that makes every pound go further. Happy to share more details!",
};

const gid = () => Math.random().toString(36).slice(2, 10);
const tod = () => new Date().toISOString().split("T")[0];

const DEFAULT_CAMPAIGN = {
  name: "Annual Campaign",
  goal: 100000,
  peakStart: "",
  peakEnd: "",
  totalFamilies: 105,
  circles: { FIRST: 30000, SECOND: 25000, THIRD: 15000, COMMUNITY: 20000, MATCHING: 10000 },
};

export default function App() {
  const [page, setPage] = useState("dashboard");
  const [donors, setDonors] = useState([]);
  const [campaign, setCampaign] = useState(DEFAULT_CAMPAIGN);
  const [matchers, setMatchers] = useState([]);
  const [selDonor, setSelDonor] = useState(null);
  const [peakMode, setPeakMode] = useState(false);
  const [toast, setToast] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const [loaded, setLoaded] = useState(false);

  // ─── GLOBAL PERSISTENT FILTERS ───────────────────────────
  const [filters, setFilters] = useState({
    circle: "ALL",
    status: "ALL",
    search: "",
    hideAssigned: false,   // מסתיר מי שכבר שויך
    hideDonated: false,    // מסתיר מי שכבר תרם
  });

  const toastRef = useRef();
  const saveTimer = useRef({});

  const showToast = (msg) => {
    setToast(msg);
    clearTimeout(toastRef.current);
    toastRef.current = setTimeout(() => setToast(null), 2200);
  };

  useEffect(() => {
    (async () => {
      setSyncing(true);
      const [d, c, m] = await Promise.all([
        sbGet("donors", "all"),
        sbGet("campaign", "main"),
        sbGet("matchers", "all"),
      ]);
      if (d) setDonors(d);
      if (c) setCampaign(c);
      if (m) setMatchers(m);
      setSyncing(false);
      setLoaded(true);
    })();
  }, []);

  useEffect(() => { if (!loaded) return; clearTimeout(saveTimer.current.donors); saveTimer.current.donors = setTimeout(() => sbSet("donors", "all", donors), 1000); }, [donors, loaded]);
  useEffect(() => { if (!loaded) return; clearTimeout(saveTimer.current.campaign); saveTimer.current.campaign = setTimeout(() => sbSet("campaign", "main", campaign), 1000); }, [campaign, loaded]);
  useEffect(() => { if (!loaded) return; clearTimeout(saveTimer.current.matchers); saveTimer.current.matchers = setTimeout(() => sbSet("matchers", "all", matchers), 1000); }, [matchers, loaded]);

  const updateDonor = useCallback((id, upd) =>
    setDonors(p => p.map(d => d.id === id ? { ...d, ...upd } : d)), []);

  const setFilter = (key, val) => setFilters(f => ({ ...f, [key]: val }));

  const raised = donors.filter(d => d.status === "DONATED").reduce((s, d) => s + (d.actualAmount || 0), 0);
  const pledged = donors.filter(d => d.status === "PLEDGED").reduce((s, d) => s + (d.estimatedAmount || 0), 0);
  const matching = matchers.reduce((s, m) => s + (m.amount || 0), 0);

  if (!loaded) return (
    <div style={S.loading}>
      <div style={{ fontSize: 40, marginBottom: 12 }}>🕍</div>
      <div>טוען נתונים...</div>
    </div>
  );

  if (selDonor) {
    const d = donors.find(x => x.id === selDonor);
    return d ? <DonorCard donor={d} onUpdate={updateDonor} onBack={() => setSelDonor(null)} showToast={showToast} /> : null;
  }

  return (
    <div style={S.app}>
      {toast && <div style={S.toast}>{toast}</div>}
      {syncing && <div style={S.syncBar}>🔄 מסנכרן...</div>}
      <Header campaign={campaign} peak={peakMode} onPeak={() => setPeakMode(p => !p)} />
      <Nav page={page} setPage={setPage} />
      <main>
        {page === "dashboard" && <Dashboard donors={donors} campaign={campaign} raised={raised} pledged={pledged} matching={matching} peak={peakMode} onSelect={setSelDonor} />}
        {page === "donors" && <DonorList donors={donors} setDonors={setDonors} onSelect={setSelDonor} showToast={showToast} filters={filters} setFilter={setFilter} />}
        {page === "import" && <ImportPage donors={donors} setDonors={setDonors} onSelect={setSelDonor} showToast={showToast} />}
        {page === "matching" && <MatchPage matchers={matchers} setMatchers={setMatchers} campaign={campaign} matching={matching} showToast={showToast} />}
        {page === "settings" && <SettingsPage campaign={campaign} setCampaign={setCampaign} donors={donors} showToast={showToast} />}
      </main>
    </div>
  );
}

function Header({ campaign, peak, onPeak }) {
  const days = campaign.peakStart ? Math.max(0, Math.ceil((new Date(campaign.peakStart) - new Date()) / 86400000)) : null;
  return (
    <header style={{ ...S.hdr, background: peak ? "linear-gradient(135deg,#8B1A1A,#C8522A)" : "linear-gradient(135deg,#1A1A2E,#2D2D5E)" }}>
      <div>
        <div style={{ fontSize: 14, fontWeight: 700, color: "#fff" }}>🕍 {campaign.name}</div>
        {days !== null && days > 0 && <div style={{ fontSize: 11, color: "rgba(255,255,255,0.7)", marginTop: 1 }}>{days} days to Peak Days</div>}
        {days === 0 && <div style={{ fontSize: 11, color: "#FFD700", marginTop: 1, fontWeight: 700 }}>🔥 PEAK DAYS ACTIVE</div>}
      </div>
      <button style={{ ...S.peakBtn, background: peak ? "#FFD700" : "rgba(255,255,255,0.18)", color: peak ? "#8B1A1A" : "#fff" }} onClick={onPeak}>{peak ? "⚡ PEAK" : "Peak Mode"}</button>
    </header>
  );
}

function Nav({ page, setPage }) {
  const items = [{ k: "dashboard", i: "📊", l: "Home" }, { k: "donors", i: "👥", l: "Donors" }, { k: "import", i: "📤", l: "Import" }, { k: "matching", i: "🤝", l: "Match" }, { k: "settings", i: "⚙️", l: "Settings" }];
  return (
    <nav style={S.nav}>
      {items.map(x => (
        <button key={x.k} style={{ ...S.navBtn, ...(page === x.k ? S.navOn : {}) }} onClick={() => setPage(x.k)}>
          <span style={{ fontSize: 20 }}>{x.i}</span>
          <span style={{ fontSize: 10, fontWeight: 700 }}>{x.l}</span>
        </button>
      ))}
    </nav>
  );
}

function Dashboard({ donors, campaign, raised, pledged, matching, peak, onSelect }) {
  const pct = campaign.goal ? Math.min(100, Math.round((raised / campaign.goal) * 100)) : 0;
  const preCamp = donors.filter(d => d.preCampaign && d.status === "DONATED").reduce((s, d) => s + (d.actualAmount || 0), 0);
  const preTgt = campaign.goal * 0.4;
  const c1r = donors.filter(d => d.circle === "FIRST" && d.status === "DONATED").reduce((s, d) => s + (d.actualAmount || 0), 0);
  const c2r = donors.filter(d => d.circle === "SECOND" && d.status === "DONATED").reduce((s, d) => s + (d.actualAmount || 0), 0);
  const c3r = donors.filter(d => d.circle === "THIRD" && d.status === "DONATED").reduce((s, d) => s + (d.actualAmount || 0), 0);
  const families = new Set(donors.filter(d => d.status === "DONATED").map(d => d.family || d.id)).size;

  // ─── תחזית ───────────────────────────────────────────────
  // סך הערכות תרומה של כל מי שעדיין לא תרם
  const est1 = donors.filter(d => d.circle === "FIRST" && d.status !== "DONATED").reduce((s, d) => s + (d.estimatedAmount || 0), 0);
  const est2 = donors.filter(d => d.circle === "SECOND" && d.status !== "DONATED").reduce((s, d) => s + (d.estimatedAmount || 0), 0);
  const est3 = donors.filter(d => d.circle === "THIRD" && d.status !== "DONATED").reduce((s, d) => s + (d.estimatedAmount || 0), 0);
  const totalEstimate = est1 + est2 + est3;
  // תחזית כוללת = כבר נתרם + הערכות שנותרו
  const forecastTotal = raised + totalEstimate;
  const forecastPct = campaign.goal ? Math.min(100, Math.round((forecastTotal / campaign.goal) * 100)) : 0;

  const hp = donors.filter(d => d.circle === "FIRST" && d.status !== "DONATED").sort((a, b) => (b.estimatedAmount || 0) - (a.estimatedAmount || 0)).slice(0, 5);
  const fu = donors.filter(d => ["CONTACTED", "INTERESTED"].includes(d.status)).sort((a, b) => new Date(a.lastContact || 0) - new Date(b.lastContact || 0)).slice(0, 5);
  const nb = donors.filter(d => !["DONATED", "NOT_RELEVANT"].includes(d.status) && d.circle && d.circle !== "UNASSIGNED").sort((a, b) => {
    const o = { FIRST: 0, SECOND: 1, THIRD: 2 };
    const c = (o[a.circle] ?? 3) - (o[b.circle] ?? 3);
    return c !== 0 ? c : (b.estimatedAmount || 0) - (a.estimatedAmount || 0);
  })[0];
  const nc1 = donors.filter(d => d.circle === "FIRST" && d.status === "NOT_CONTACTED");

  if (donors.length === 0) return (
    <div style={S.pg}>
      <div style={{ ...S.card, textAlign: "center", padding: "40px 20px" }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>🕍</div>
        <div style={{ fontSize: 20, fontWeight: 700, color: "#1A1A2E", marginBottom: 8 }}>ברוכים הבאים</div>
        <div style={{ fontSize: 14, color: "#888", lineHeight: 1.7, marginBottom: 20 }}>התחל בייבוא אנשי הקשר שלך</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ background: "#FFF0EB", borderRadius: 10, padding: 12, fontSize: 13, color: "#C8522A", textAlign: "left" }}>📤 <strong>Import</strong> — העלה CSV של אנשי קשר</div>
          <div style={{ background: "#FFF8EB", borderRadius: 10, padding: 12, fontSize: 13, color: "#B07D2E", textAlign: "left" }}>⚙️ <strong>Settings</strong> — הגדר מטרה ותאריכים</div>
          <div style={{ background: "#EBF5F2", borderRadius: 10, padding: 12, fontSize: 13, color: "#4A7B6F", textAlign: "left" }}>🤝 <strong>Match</strong> — הוסף מאצ׳רים</div>
        </div>
      </div>
    </div>
  );

  return (
    <div style={S.pg}>
      {peak && (
        <div style={{ background: "linear-gradient(135deg,#8B1A1A,#C8522A)", borderRadius: 16, padding: 20, marginBottom: 12, color: "#fff", textAlign: "center" }}>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.75)", letterSpacing: 1, textTransform: "uppercase", marginBottom: 4 }}>Total Raised</div>
          <div style={{ fontSize: 52, fontWeight: 700, lineHeight: 1 }}>£{raised.toLocaleString()}</div>
          <div style={{ fontSize: 15, opacity: 0.8, marginBottom: 14 }}>of £{campaign.goal.toLocaleString()} goal</div>
          <div style={{ background: "rgba(255,255,255,0.2)", borderRadius: 99, height: 18 }}>
            <div style={{ width: `${pct}%`, height: "100%", background: "#FFD700", borderRadius: 99, transition: "width 0.6s" }} />
          </div>
          <div style={{ color: "#FFD700", fontWeight: 700, marginTop: 6, fontSize: 16 }}>{pct}%</div>
        </div>
      )}

      <div style={S.g2}>
        <SC l="Raised" v={`£${raised.toLocaleString()}`} a="#2E7D32" />
        <SC l="Goal" v={`£${campaign.goal.toLocaleString()}`} a="#1A1A2E" />
        <SC l="Progress" v={`${pct}%`} a={pct >= 80 ? "#2E7D32" : pct >= 40 ? "#B07D2E" : "#C8522A"} />
        <SC l="Pledged" v={`£${pledged.toLocaleString()}`} a="#5B7EC8" />
      </div>

      <div style={S.card}>
        <div style={S.ct}>Overall Progress</div>
        <PB pct={pct} c="#C8522A" h={14} />
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#999", marginTop: 5 }}>
          <span>£{raised.toLocaleString()} raised</span>
          <span>£{Math.max(0, campaign.goal - raised).toLocaleString()} to go</span>
        </div>
      </div>

      {/* ─── תחזית ─── */}
      {totalEstimate > 0 && (
        <div style={{ ...S.card, background: "linear-gradient(135deg,#F0F7FF,#fff)", borderLeft: "4px solid #5B7EC8" }}>
          <div style={S.ct}>📈 תחזית פוטנציאל</div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10 }}>
            <div>
              <div style={{ fontSize: 26, fontWeight: 700, color: "#5B7EC8" }}>£{forecastTotal.toLocaleString()}</div>
              <div style={{ fontSize: 12, color: "#888", marginTop: 2 }}>תחזית כוללת (בפועל + הערכות)</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 22, fontWeight: 700, color: forecastPct >= 100 ? "#2E7D32" : "#5B7EC8" }}>{forecastPct}%</div>
              <div style={{ fontSize: 11, color: "#aaa" }}>מהיעד</div>
            </div>
          </div>
          <div style={{ background: "#e8e8e8", borderRadius: 99, height: 10, overflow: "hidden", position: "relative" }}>
            {/* בפועל */}
            <div style={{ position: "absolute", left: 0, top: 0, height: "100%", width: `${pct}%`, background: "#2E7D32", borderRadius: 99 }} />
            {/* הערכה */}
            <div style={{ position: "absolute", left: `${pct}%`, top: 0, height: "100%", width: `${Math.min(100 - pct, forecastPct - pct)}%`, background: "#5B7EC8", opacity: 0.5, borderRadius: 99 }} />
          </div>
          <div style={{ display: "flex", gap: 12, marginTop: 8, fontSize: 12 }}>
            <span style={{ color: "#2E7D32" }}>■ £{raised.toLocaleString()} בפועל</span>
            <span style={{ color: "#5B7EC8" }}>■ £{totalEstimate.toLocaleString()} הערכות</span>
          </div>

          {/* פירוט לפי מעגל */}
          <div style={{ marginTop: 12, borderTop: "1px solid #eee", paddingTop: 10 }}>
            {[
              { l: "First Circle", e: est1, c: "#C8522A" },
              { l: "Second Circle", e: est2, c: "#B07D2E" },
              { l: "Third Circle", e: est3, c: "#4A7B6F" },
            ].filter(x => x.e > 0).map(x => (
              <div key={x.l} style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                <span style={{ fontSize: 13, color: x.c, fontWeight: 600 }}>{x.l}</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: "#555" }}>£{x.e.toLocaleString()}</span>
              </div>
            ))}
          </div>
          {forecastPct < 100 && (
            <div style={{ marginTop: 10, fontSize: 13, color: "#C8522A", fontWeight: 600 }}>
              ⚠️ חסר £{Math.max(0, campaign.goal - forecastTotal).toLocaleString()} להשלמת היעד לפי ההערכות הנוכחיות
            </div>
          )}
          {forecastPct >= 100 && (
            <div style={{ marginTop: 10, fontSize: 13, color: "#2E7D32", fontWeight: 600 }}>
              ✓ ההערכות הנוכחיות מכסות את היעד!
            </div>
          )}
        </div>
      )}

      <div style={S.card}>
        <div style={S.ct}>Circle Breakdown</div>
        {[
          { l: "First Circle", r: c1r, t: campaign.circles.FIRST, c: "#C8522A" },
          { l: "Second Circle", r: c2r, t: campaign.circles.SECOND, c: "#B07D2E" },
          { l: "Third Circle", r: c3r, t: campaign.circles.THIRD, c: "#4A7B6F" },
          { l: "Matching", r: matching, t: campaign.circles.MATCHING, c: "#5B7EC8" },
        ].map(b => (
          <div key={b.l} style={{ marginBottom: 13 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: b.c }}>{b.l}</span>
              <span style={{ fontSize: 12, color: "#999" }}>£{b.r.toLocaleString()} / £{(b.t || 0).toLocaleString()}</span>
            </div>
            <PB pct={b.t ? Math.min(100, Math.round((b.r / b.t) * 100)) : 0} c={b.c} h={8} />
          </div>
        ))}
      </div>

      <div style={S.card}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10 }}>
          <div style={S.ct}>Pre-Campaign</div>
          <span style={{ fontSize: 11, color: "#999" }}>Target 40% = £{preTgt.toLocaleString()}</span>
        </div>
        <PB pct={Math.min(100, preTgt ? Math.round((preCamp / preTgt) * 100) : 0)} c="#5B7EC8" h={10} />
        <div style={{ fontSize: 13, color: "#666", marginTop: 5 }}>£{preCamp.toLocaleString()} secured pre-launch</div>
      </div>

      <div style={S.card}>
        <div style={S.ct}>Community Participation</div>
        <div style={{ marginBottom: 8 }}>
          <span style={{ fontSize: 36, fontWeight: 700, color: "#4A7B6F" }}>{families}</span>
          <span style={{ fontSize: 16, color: "#888" }}> / {campaign.totalFamilies} families</span>
        </div>
        <PB pct={Math.min(100, Math.round((families / campaign.totalFamilies) * 100))} c="#4A7B6F" h={10} />
      </div>

      {nb && (
        <div style={{ ...S.card, borderLeft: "4px solid #B07D2E", background: "#FFFDF5" }}>
          <div style={S.ct}>⚡ Next Best Action</div>
          <button style={{ width: "100%", background: "#fff", border: "2px solid #B07D2E", borderRadius: 12, padding: 14, cursor: "pointer", textAlign: "left" }} onClick={() => onSelect(nb.id)}>
            <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>{nb.name}</div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <CB c={nb.circle} /><SB s={nb.status} />
              {nb.estimatedAmount > 0 && <span style={{ marginLeft: "auto", fontSize: 16, fontWeight: 700, color: "#2E7D32" }}>~£{nb.estimatedAmount.toLocaleString()}</span>}
            </div>
          </button>
        </div>
      )}

      {hp.length > 0 && <AL title="🔴 First Circle – High Potential" donors={hp} onSel={onSelect} />}
      {fu.length > 0 && <AL title="🔁 Follow-ups Needed" donors={fu} onSel={onSelect} />}
      {nc1.length > 0 && (
        <div style={S.card}>
          <div style={S.ct}>First Circle – Not Yet Reached</div>
          <div style={{ fontSize: 40, fontWeight: 700, color: "#C8522A" }}>{nc1.length}</div>
          <div style={{ fontSize: 13, color: "#888" }}>priority donors waiting for first contact</div>
        </div>
      )}
    </div>
  );
}

function AL({ title, donors, onSel }) {
  return (
    <div style={S.card}>
      <div style={S.ct}>{title}</div>
      {donors.map((d, i) => (
        <button key={d.id} style={{ ...S.ai, borderTop: i > 0 ? "1px solid #f5f5f5" : "none" }} onClick={() => onSel(d.id)}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 14 }}>{d.name}</div>
            <div style={{ display: "flex", gap: 5, marginTop: 3 }}><CB c={d.circle} /><SB s={d.status} /></div>
          </div>
          <div style={{ textAlign: "right", flexShrink: 0 }}>
            {d.estimatedAmount > 0 && <div style={{ fontSize: 14, fontWeight: 700, color: "#2E7D32" }}>£{d.estimatedAmount.toLocaleString()}</div>}
            {d.lastContact && <div style={{ fontSize: 11, color: "#bbb", marginTop: 1 }}>{d.lastContact}</div>}
            <div style={{ color: "#ddd", fontSize: 16 }}>›</div>
          </div>
        </button>
      ))}
    </div>
  );
}

// ─── DONOR LIST ── עם סינונים גלובליים שנשמרים ───────────────
function DonorList({ donors, setDonors, onSelect, showToast, filters, setFilter }) {
  const [sel, setSel] = useState(new Set());

  // החל סינונים
  const list = donors.filter(d => {
    if (filters.hideAssigned && d.circle !== "UNASSIGNED") return false;
    if (filters.hideDonated && d.status === "DONATED") return false;
    if (filters.circle !== "ALL" && d.circle !== filters.circle) return false;
    if (filters.status !== "ALL" && d.status !== filters.status) return false;
    if (filters.search && !d.name.toLowerCase().includes(filters.search.toLowerCase()) && !(d.phone || "").includes(filters.search)) return false;
    return true;
  });

  const tog = id => setSel(p => { const s = new Set(p); s.has(id) ? s.delete(id) : s.add(id); return s; });
  const clr = () => setSel(new Set());

  useEffect(() => {
    if (sel.size === 0) return;
    const map = { "1": "FIRST", "2": "SECOND", "3": "THIRD", "0": "NOT_RELEVANT" };
    const h = e => {
      if (map[e.key]) {
        setDonors(p => p.map(d => sel.has(d.id) ? { ...d, circle: map[e.key] } : d));
        showToast(`${sel.size} → ${CIRCLES[map[e.key]].label}`);
        clr();
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [sel]);

  const assign = k => {
    setDonors(p => p.map(d => sel.has(d.id) ? { ...d, circle: k } : d));
    showToast(`${sel.size} → ${CIRCLES[k].label}`);
    clr();
  };

  const unassigned = donors.filter(d => d.circle === "UNASSIGNED").length;
  const activeFiltersCount = [
    filters.circle !== "ALL",
    filters.status !== "ALL",
    filters.search !== "",
    filters.hideAssigned,
    filters.hideDonated,
  ].filter(Boolean).length;

  if (donors.length === 0) return (
    <div style={S.pg}>
      <div style={{ ...S.card, textAlign: "center", padding: "40px 20px" }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>👥</div>
        <div style={{ fontSize: 16, fontWeight: 700, color: "#1A1A2E", marginBottom: 8 }}>No donors yet</div>
        <div style={{ fontSize: 14, color: "#888" }}>Go to Import to upload your contact list</div>
      </div>
    </div>
  );

  return (
    <div style={S.pg}>
      {/* SEARCH */}
      <input style={S.inp} placeholder="🔍 Search name or phone..." value={filters.search} onChange={e => setFilter("search", e.target.value)} />

      {/* FILTERS ROW */}
      <div style={{ display: "flex", gap: 8, margin: "8px 0 10px" }}>
        <select style={{ ...S.sel, flex: 1 }} value={filters.circle} onChange={e => { setFilter("circle", e.target.value); clr(); }}>
          <option value="ALL">All Circles</option>
          {Object.entries(CIRCLES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <select style={{ ...S.sel, flex: 1 }} value={filters.status} onChange={e => { setFilter("status", e.target.value); clr(); }}>
          <option value="ALL">All Status</option>
          {STATUSES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
        </select>
      </div>

      {/* QUICK FILTER TOGGLES */}
      <div style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
        <button
          style={{ ...S.toggleBtn, background: filters.hideAssigned ? "#C8522A" : "#f0f0f0", color: filters.hideAssigned ? "#fff" : "#555" }}
          onClick={() => { setFilter("hideAssigned", !filters.hideAssigned); clr(); }}>
          {filters.hideAssigned ? "✓" : ""} הסתר משויכים
        </button>
        <button
          style={{ ...S.toggleBtn, background: filters.hideDonated ? "#2E7D32" : "#f0f0f0", color: filters.hideDonated ? "#fff" : "#555" }}
          onClick={() => { setFilter("hideDonated", !filters.hideDonated); clr(); }}>
          {filters.hideDonated ? "✓" : ""} הסתר תורמים
        </button>
        {activeFiltersCount > 0 && (
          <button
            style={{ ...S.toggleBtn, background: "#1A1A2E", color: "#fff" }}
            onClick={() => { setFilter("circle", "ALL"); setFilter("status", "ALL"); setFilter("search", ""); setFilter("hideAssigned", false); setFilter("hideDonated", false); clr(); }}>
            נקה הכל ✕
          </button>
        )}
      </div>

      {/* UNASSIGNED WARNING */}
      {unassigned > 0 && !filters.hideAssigned && filters.circle !== "UNASSIGNED" && (
        <button style={{ width: "100%", background: "#FFF8EB", border: "1.5px solid #B07D2E", borderRadius: 10, padding: "10px 14px", color: "#B07D2E", fontWeight: 700, fontSize: 13, cursor: "pointer", marginBottom: 10, textAlign: "left" }}
          onClick={() => { setFilter("circle", "UNASSIGNED"); setFilter("hideAssigned", false); clr(); }}>
          ⚠️ {unassigned} לא משויכים — לחץ לשיוך
        </button>
      )}

      {/* COUNT + SELECT ALL */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <span style={{ fontSize: 13, color: "#aaa" }}>{list.length} donors{activeFiltersCount > 0 ? ` (מסונן)` : ""}</span>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          {sel.size > 0 && <span style={{ fontSize: 13, color: "#C8522A", fontWeight: 700 }}>{sel.size} selected</span>}
          <button style={S.lnk} onClick={sel.size > 0 ? clr : () => setSel(new Set(list.map(d => d.id)))}>{sel.size > 0 ? "Clear" : "Select All"}</button>
        </div>
      </div>

      {/* BULK ASSIGN */}
      {sel.size > 0 && (
        <div style={{ background: "#1A1A2E", borderRadius: 12, padding: "12px 14px", marginBottom: 12 }}>
          <div style={{ color: "rgba(255,255,255,0.8)", fontSize: 12, fontWeight: 700, marginBottom: 8 }}>Assign {sel.size} donors:</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {["FIRST", "SECOND", "THIRD", "NOT_RELEVANT"].map(k => (
              <button key={k} style={{ background: CIRCLES[k].color, color: "#fff", border: "none", borderRadius: 20, padding: "7px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer" }} onClick={() => assign(k)}>
                {CIRCLES[k].short}
              </button>
            ))}
          </div>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", marginTop: 6 }}>keyboard: 1 · 2 · 3 · 0</div>
        </div>
      )}

      {/* LIST */}
      {list.map(d => (
        <div key={d.id} style={{ ...S.drow, background: sel.has(d.id) ? "#EBF5F2" : "#fff" }}>
          <div style={{ padding: "15px 8px 15px 14px", cursor: "pointer" }} onClick={() => tog(d.id)}>
            <div style={{ width: 22, height: 22, borderRadius: 6, background: sel.has(d.id) ? "#4A7B6F" : "#e8e8e8", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, color: "#fff", fontWeight: 700 }}>{sel.has(d.id) ? "✓" : ""}</div>
          </div>
          <button style={{ flex: 1, display: "flex", justifyContent: "space-between", alignItems: "center", padding: "13px 14px 13px 4px", background: "none", border: "none", cursor: "pointer", textAlign: "left" }} onClick={() => onSelect(d.id)}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14, color: "#1A1A2E" }}>{d.name}</div>
              <div style={{ display: "flex", gap: 5, marginTop: 4, flexWrap: "wrap" }}><CB c={d.circle} /><SB s={d.status} /></div>
            </div>
            <div style={{ textAlign: "right", flexShrink: 0 }}>
              {d.estimatedAmount > 0 && <div style={{ fontSize: 14, fontWeight: 700, color: "#2E7D32" }}>£{d.estimatedAmount.toLocaleString()}</div>}
              {d.status === "DONATED" && d.actualAmount > 0 && <div style={{ fontSize: 11, color: "#2E7D32" }}>✓ donated</div>}
              <div style={{ color: "#ddd", fontSize: 16 }}>›</div>
            </div>
          </button>
        </div>
      ))}

      {list.length === 0 && (
        <div style={{ textAlign: "center", color: "#aaa", padding: "40px 20px", fontSize: 14 }}>
          אין תוצאות לסינון הנוכחי
        </div>
      )}
    </div>
  );
}

function ImportPage({ donors, setDonors, onSelect, showToast }) {
  const [step, setStep] = useState("up");
  const [parsed, setParsed] = useState(null);
  const [map, setMap] = useState({});
  const [newIds, setNewIds] = useState([]);
  const ref = useRef();

  const parseCSV = txt => {
    const lines = txt.trim().split(/\r?\n/);
    const headers = lines[0].split(",").map(h => h.replace(/"/g, "").trim());
    const rows = lines.slice(1).map(l => l.split(",").map(c => c.replace(/"/g, "").trim())).filter(r => r.some(c => c));
    return { headers, rows };
  };

  const autoMap = headers => {
    const m = {};
    headers.forEach((h, i) => {
      const hl = h.toLowerCase();
      if (/name/i.test(hl) && !m.name) m.name = i;
      else if (/phone|mobile|tel/i.test(hl)) m.phone = i;
      else if (/email/i.test(hl)) m.email = i;
      else if (/note|comment/i.test(hl)) m.notes = i;
      else if (/amount|donation|est/i.test(hl)) m.estimatedAmount = i;
      else if (/family/i.test(hl)) m.family = i;
    });
    setMap(m);
  };

  const handleFile = e => {
    const f = e.target.files[0];
    if (!f) return;
    if (!f.name.toLowerCase().endsWith(".csv")) { showToast("Please use a CSV file"); return; }
    const r = new FileReader();
    r.onload = ev => { const d = parseCSV(ev.target.result); setParsed(d); autoMap(d.headers); setStep("map"); };
    r.readAsText(f);
  };

  const doImport = () => {
    const ids = [];
    const nd = parsed.rows.map(row => {
      const id = gid(); ids.push(id);
      return {
        id, name: String(row[map.name] || "").trim() || "Unknown",
        phone: map.phone !== undefined ? String(row[map.phone] || "").trim() : "",
        email: map.email !== undefined ? String(row[map.email] || "").trim() : "",
        notes: map.notes !== undefined ? String(row[map.notes] || "").trim() : "",
        estimatedAmount: map.estimatedAmount !== undefined ? (Number(String(row[map.estimatedAmount]).replace(/[£$,]/g, "")) || 0) : 0,
        family: map.family !== undefined ? String(row[map.family] || "").trim() : "",
        circle: "UNASSIGNED", status: "NOT_CONTACTED",
        actualAmount: 0, lastContact: null, preCampaign: false, callLog: [], createdAt: tod(),
      };
    }).filter(d => d.name !== "Unknown");
    setDonors(p => [...p, ...nd]);
    setNewIds(ids);
    showToast(`✅ ${nd.length} contacts imported`);
    setStep("done");
  };

  if (step === "done") return (
    <div style={S.pg}>
      <div style={S.card}>
        <div style={{ fontSize: 40, marginBottom: 8 }}>✅</div>
        <div style={S.ct}>Import Complete</div>
        <p style={{ fontSize: 14, color: "#666", marginBottom: 14 }}>{newIds.length} donors added and synced to cloud.</p>
        <button style={S.btn} onClick={() => { setStep("up"); setParsed(null); setNewIds([]); }}>Import Another File</button>
      </div>
      <div style={S.card}>
        <div style={S.ct}>Newly Imported</div>
        {newIds.slice(0, 20).map(id => {
          const d = donors.find(x => x.id === id);
          return d ? (
            <button key={id} style={S.ai} onClick={() => onSelect(id)}>
              <div><div style={{ fontWeight: 700 }}>{d.name}</div><CB c={d.circle} /></div>
              <div style={{ fontSize: 12, color: "#aaa" }}>{d.phone}</div>
            </button>
          ) : null;
        })}
      </div>
    </div>
  );

  if (step === "map" && parsed) return (
    <div style={S.pg}>
      <div style={S.card}>
        <div style={S.ct}>Map Columns</div>
        <div style={{ fontSize: 13, color: "#888", marginBottom: 14 }}>{parsed.rows.length} rows found</div>
        {[["name", "Name *"], ["phone", "Phone"], ["email", "Email"], ["notes", "Notes"], ["estimatedAmount", "Estimated Amount"], ["family", "Family"]].map(([f, l]) => (
          <div key={f} style={{ marginBottom: 10 }}>
            <label style={S.lbl}>{l}</label>
            <select style={S.sel} value={map[f] ?? ""} onChange={e => setMap(m => ({ ...m, [f]: e.target.value === "" ? undefined : Number(e.target.value) }))}>
              <option value="">— skip —</option>
              {parsed.headers.map((h, i) => <option key={i} value={i}>{h}</option>)}
            </select>
          </div>
        ))}
        <div style={{ background: "#f5f5f5", borderRadius: 10, padding: 12, marginBottom: 14, fontSize: 12, color: "#666" }}>
          <strong>Preview:</strong><br />
          {parsed.rows.slice(0, 3).map((row, i) => <div key={i} style={{ marginTop: 3 }}>{map.name !== undefined ? row[map.name] : "?"} {map.phone !== undefined ? `— ${row[map.phone]}` : ""}</div>)}
        </div>
        <button style={S.btn} onClick={doImport}>Import {parsed.rows.length} Contacts</button>
        <button style={{ ...S.btn, background: "#eee", color: "#444", marginTop: 8 }} onClick={() => setStep("up")}>Back</button>
      </div>
    </div>
  );

  return (
    <div style={S.pg}>
      <div style={S.card}>
        <div style={S.ct}>📤 Import Contacts</div>
        <p style={{ fontSize: 14, color: "#666", marginBottom: 20, lineHeight: 1.6 }}>
          Upload a <strong>CSV file</strong> with columns:<br />
          <code style={{ background: "#f5f5f5", padding: "2px 6px", borderRadius: 4, fontSize: 12 }}>Name, Phone, Email, Notes, Estimated Amount</code>
        </p>
        <input ref={ref} type="file" accept=".csv" style={{ display: "none" }} onChange={handleFile} />
        <button style={{ width: "100%", padding: "28px 20px", background: "#f7f7f7", border: "2px dashed #ddd", borderRadius: 14, cursor: "pointer", textAlign: "center", boxSizing: "border-box" }} onClick={() => ref.current?.click()}>
          <div style={{ fontSize: 36, marginBottom: 8 }}>📂</div>
          <div style={{ fontWeight: 700, fontSize: 16 }}>Choose CSV File</div>
          <div style={{ color: "#aaa", fontSize: 13, marginTop: 4 }}>tap to browse</div>
        </button>
      </div>
      <div style={S.card}>
        <div style={S.ct}>Database</div>
        <div style={{ fontSize: 34, fontWeight: 700, color: "#1A1A2E", marginBottom: 10 }}>{donors.length}<span style={{ fontSize: 16, fontWeight: 400, color: "#888" }}> contacts</span></div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {Object.entries(CIRCLES).map(([k, v]) => {
            const n = donors.filter(d => d.circle === k).length;
            return n ? <span key={k} style={{ padding: "4px 12px", borderRadius: 99, background: v.bg, color: v.color, fontSize: 13, fontWeight: 700 }}>{v.short}: {n}</span> : null;
          })}
        </div>
      </div>
    </div>
  );
}

function MatchPage({ matchers, setMatchers, campaign, matching, showToast }) {
  const [name, setName] = useState("");
  const [amt, setAmt] = useState("");
  const tgt = campaign.circles.MATCHING || 0;
  const rem = Math.max(0, tgt - matching);

  const add = () => {
    if (!name.trim() || !Number(amt)) return;
    setMatchers(p => [...p, { id: gid(), name: name.trim(), amount: Number(amt), date: tod() }]);
    showToast(`${name} added`);
    setName(""); setAmt("");
  };

  return (
    <div style={S.pg}>
      <div style={{ ...S.card, borderLeft: "4px solid #5B7EC8" }}>
        <div style={S.ct}>🤝 Matching Fund</div>
        <div style={S.g2}><SC l="Secured" v={`£${matching.toLocaleString()}`} a="#2E7D32" /><SC l="Target" v={`£${tgt.toLocaleString()}`} a="#5B7EC8" /></div>
        <PB pct={tgt ? Math.min(100, Math.round((matching / tgt) * 100)) : 0} c="#5B7EC8" h={12} />
        <div style={{ marginTop: 8, fontSize: 13, fontWeight: 700, color: rem > 0 ? "#C8522A" : "#2E7D32" }}>
          {rem > 0 ? `£${rem.toLocaleString()} more matching needed` : "✓ Matching target reached!"}
        </div>
      </div>
      <div style={S.card}>
        <div style={S.ct}>Add Matcher</div>
        <label style={S.lbl}>Name</label>
        <input style={S.inp} placeholder="e.g. The Cohen Foundation" value={name} onChange={e => setName(e.target.value)} />
        <label style={{ ...S.lbl, marginTop: 10 }}>Amount (£)</label>
        <input style={S.inp} type="number" placeholder="5000" value={amt} onChange={e => setAmt(e.target.value)} />
        <button style={{ ...S.btn, marginTop: 14 }} onClick={add}>Add Matcher</button>
      </div>
      <div style={S.card}>
        <div style={S.ct}>Matchers ({matchers.length})</div>
        {matchers.length === 0 && <div style={{ color: "#ccc", textAlign: "center", padding: "20px 0", fontSize: 14 }}>No matchers yet</div>}
        {matchers.map(m => (
          <div key={m.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 0", borderBottom: "1px solid #f5f5f5" }}>
            <div><div style={{ fontWeight: 700, fontSize: 14 }}>{m.name}</div><div style={{ fontSize: 12, color: "#bbb" }}>{m.date}</div></div>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: "#5B7EC8" }}>£{m.amount.toLocaleString()}</div>
              <button style={{ background: "none", border: "none", color: "#ddd", fontSize: 18, cursor: "pointer" }} onClick={() => { setMatchers(p => p.filter(x => x.id !== m.id)); showToast("Removed"); }}>✕</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SettingsPage({ campaign, setCampaign, donors, showToast }) {
  const [loc, setLoc] = useState({ ...campaign, circles: { ...campaign.circles } });

  const exportList = () => {
    const ord = { FIRST: 0, SECOND: 1, THIRD: 2, UNASSIGNED: 3 };
    const lines = ["CALL LIST FOR TODAY", "=".repeat(44), "",
      ...donors.filter(d => !["DONATED", "NOT_RELEVANT"].includes(d.status))
        .sort((a, b) => (ord[a.circle] ?? 3) - (ord[b.circle] ?? 3))
        .map(d => `${CIRCLES[d.circle]?.short || "?"} | ${d.name.padEnd(25)} | ${(d.phone || "—").padEnd(15)} | Est: £${String(d.estimatedAmount || 0).padStart(6)} | ${STATUSES.find(s => s.key === d.status)?.label || "?"}`)
    ];
    const url = URL.createObjectURL(new Blob([lines.join("\n")], { type: "text/plain" }));
    const a = document.createElement("a"); a.href = url; a.download = `call-list-${tod()}.txt`; a.click();
    showToast("Call list exported");
  };

  return (
    <div style={S.pg}>
      <div style={S.card}>
        <div style={S.ct}>Campaign Settings</div>
        {[["name", "Campaign Name", "text"], ["goal", "Total Goal (£)", "number"], ["peakStart", "Peak Start Date", "date"], ["peakEnd", "Peak End Date", "date"], ["totalFamilies", "Total Families", "number"]].map(([f, l, t]) => (
          <div key={f} style={{ marginBottom: 12 }}>
            <label style={S.lbl}>{l}</label>
            <input style={S.inp} type={t} value={loc[f] || ""} onChange={e => setLoc(p => ({ ...p, [f]: t === "number" ? Number(e.target.value) : e.target.value }))} />
          </div>
        ))}
        <div style={{ ...S.ct, marginTop: 16 }}>Circle Targets (£)</div>
        {["FIRST", "SECOND", "THIRD", "COMMUNITY", "MATCHING"].map(k => (
          <div key={k} style={{ marginBottom: 10 }}>
            <label style={S.lbl}>{CIRCLES[k]?.label || k}</label>
            <input style={S.inp} type="number" value={loc.circles[k] || 0} onChange={e => setLoc(p => ({ ...p, circles: { ...p.circles, [k]: Number(e.target.value) } }))} />
          </div>
        ))}
        <button style={{ ...S.btn, marginTop: 8 }} onClick={() => { setCampaign(loc); showToast("Saved ✓"); }}>Save Settings</button>
      </div>
      <div style={S.card}>
        <div style={S.ct}>Export</div>
        <button style={{ width: "100%", padding: 12, background: "#f0f0f0", border: "none", borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: "pointer", textAlign: "left" }} onClick={exportList}>📋 Export Call List for Today</button>
      </div>
      <div style={S.card}>
        <div style={S.ct}>WhatsApp Templates</div>
        {["FIRST", "SECOND", "THIRD"].map(k => (
          <div key={k} style={{ marginBottom: 18 }}>
            <div style={{ fontWeight: 700, color: CIRCLES[k].color, fontSize: 14, marginBottom: 6 }}>{CIRCLES[k].label}</div>
            <div style={{ background: "#f5f5f5", padding: 12, borderRadius: 10, fontSize: 13, color: "#444", lineHeight: 1.6 }}>{WA[k]}</div>
            <button style={{ marginTop: 6, padding: "6px 16px", background: "#fff", border: "1px solid #ddd", borderRadius: 8, fontSize: 13, cursor: "pointer" }} onClick={() => { navigator.clipboard.writeText(WA[k]); showToast("Copied!"); }}>Copy</button>
          </div>
        ))}
      </div>
    </div>
  );
}

function DonorCard({ donor, onUpdate, onBack, showToast }) {
  const [note, setNote] = useState("");
  const [dam, setDam] = useState("");
  const [showLog, setShowLog] = useState(false);
  const ci = CIRCLES[donor.circle] || CIRCLES.UNASSIGNED;

  const saveNote = () => {
    if (!note.trim()) return;
    onUpdate(donor.id, { callLog: [...(donor.callLog || []), { date: tod(), note: note.trim() }], lastContact: tod() });
    showToast("Note saved");
    setNote("");
  };

  const addDon = () => {
    const a = Number(dam);
    if (!a) return;
    onUpdate(donor.id, { actualAmount: (donor.actualAmount || 0) + a, status: "DONATED", lastContact: tod() });
    showToast(`£${a.toLocaleString()} recorded ✓`);
    setDam("");
  };

  const openWA = () => {
    const t = (WA[donor.circle] || WA.THIRD).replace("[NAME]", donor.name.split(" ")[0]);
    const p = (donor.phone || "").replace(/\D/g, "");
    window.open(`https://wa.me/${p || ""}?text=${encodeURIComponent(t)}`, "_blank");
  };

  return (
    <div style={S.app}>
      <header style={{ ...S.hdr, background: ci.color }}>
        <button style={{ background: "none", border: "none", color: "#fff", fontSize: 15, cursor: "pointer", padding: "4px 10px" }} onClick={onBack}>← Back</button>
        <div style={{ fontSize: 14, fontWeight: 700, color: "#fff" }}>{donor.name}</div>
        <div style={{ width: 64 }} />
      </header>
      <div style={S.pg}>
        <div style={{ ...S.card, borderLeft: `4px solid ${ci.color}` }}>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <div>
              <div style={{ fontSize: 22, fontWeight: 700, color: "#1A1A2E", marginBottom: 8 }}>{donor.name}</div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                <CB c={donor.circle} /><SB s={donor.status} />
                {donor.preCampaign && <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 99, background: "#EBF5F2", color: "#4A7B6F", fontWeight: 600 }}>Pre-Campaign</span>}
              </div>
            </div>
            {donor.status === "DONATED" && <div style={{ fontSize: 36, color: "#2E7D32" }}>✓</div>}
          </div>
          {donor.phone && <div style={{ marginTop: 10, fontSize: 14, color: "#555" }}>📞 <a href={`tel:${donor.phone}`} style={{ color: ci.color, textDecoration: "none" }}>{donor.phone}</a></div>}
          {donor.email && <div style={{ fontSize: 14, color: "#555" }}>✉️ {donor.email}</div>}
          {donor.lastContact && <div style={{ fontSize: 12, color: "#bbb", marginTop: 4 }}>Last contact: {donor.lastContact}</div>}
        </div>
        <div style={S.card}>
          <div style={S.ct}>Circle</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {["FIRST", "SECOND", "THIRD", "NOT_RELEVANT"].map(k => (
              <button key={k} style={{ padding: "9px 16px", borderRadius: 20, border: `2px solid ${CIRCLES[k].color}`, background: donor.circle === k ? CIRCLES[k].color : CIRCLES[k].bg, color: donor.circle === k ? "#fff" : CIRCLES[k].color, fontWeight: 700, fontSize: 13, cursor: "pointer" }}
                onClick={() => { onUpdate(donor.id, { circle: k }); showToast(CIRCLES[k].label); }}>
                {CIRCLES[k].label}
              </button>
            ))}
          </div>
        </div>
        <div style={S.card}>
          <div style={S.ct}>Status</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {STATUSES.map(s => (
              <button key={s.key} style={{ padding: "9px 14px", borderRadius: 20, border: "none", background: donor.status === s.key ? s.color : "#f0f0f0", color: donor.status === s.key ? "#fff" : s.color, fontWeight: 700, fontSize: 13, cursor: "pointer" }}
                onClick={() => { onUpdate(donor.id, { status: s.key, lastContact: tod() }); showToast(s.label); }}>
                {s.icon} {s.label}
              </button>
            ))}
          </div>
        </div>
        <div style={S.card}>
          <div style={S.ct}>Donation</div>
          <div style={{ display: "flex", gap: 14, marginBottom: 14 }}>
            <div style={{ flex: 1 }}>
              <label style={S.lbl}>Estimated (£)</label>
              <input style={S.inp} type="number" value={donor.estimatedAmount || ""} onChange={e => onUpdate(donor.id, { estimatedAmount: Number(e.target.value) || 0 })} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={S.lbl}>Actual</label>
              <div style={{ fontSize: 26, fontWeight: 700, color: "#2E7D32", paddingTop: 8 }}>{donor.actualAmount ? `£${donor.actualAmount.toLocaleString()}` : "—"}</div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <input style={{ ...S.inp, flex: 1 }} type="number" placeholder="Add donation £" value={dam} onChange={e => setDam(e.target.value)} />
            <button style={{ ...S.btn, flex: "none", width: "auto", padding: "0 22px" }} onClick={addDon}>Add</button>
          </div>
          <label style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 14, fontSize: 14, cursor: "pointer" }}>
            <input type="checkbox" checked={!!donor.preCampaign} onChange={e => onUpdate(donor.id, { preCampaign: e.target.checked })} style={{ width: 18, height: 18 }} />
            Pre-campaign donation
          </label>
        </div>
        <div style={S.card}>
          <div style={S.ct}>Call Log</div>
          <textarea style={{ ...S.inp, height: 90, resize: "vertical" }} placeholder="Call notes, personal info, follow-up reminders..." value={note} onChange={e => setNote(e.target.value)} />
          <button style={{ ...S.btn, marginTop: 10 }} onClick={saveNote}>Save Note</button>
          {(donor.callLog || []).length > 0 && (
            <>
              <button style={S.lnk} onClick={() => setShowLog(p => !p)}>{showLog ? "▲ Hide" : "▼ Show"} {donor.callLog.length} {donor.callLog.length === 1 ? "note" : "notes"}</button>
              {showLog && [...(donor.callLog || [])].reverse().map((l, i) => (
                <div key={i} style={{ marginTop: 10, padding: 12, background: "#f9f9f9", borderRadius: 10 }}>
                  <div style={{ fontSize: 11, color: "#bbb", marginBottom: 3 }}>{l.date}</div>
                  <div style={{ fontSize: 14, color: "#333", lineHeight: 1.5 }}>{l.note}</div>
                </div>
              ))}
            </>
          )}
        </div>
        <button style={{ ...S.btn, background: "#25D366", marginBottom: 10 }} onClick={openWA}>💬 Open WhatsApp</button>
        <button style={{ ...S.btn, background: "#f0f0f0", color: "#333" }} onClick={onBack}>← Back to List</button>
      </div>
    </div>
  );
}

function PB({ pct, c, h = 12 }) {
  return (
    <div style={{ background: "#eee", borderRadius: 99, overflow: "hidden", height: h }}>
      <div style={{ width: `${Math.max(0, pct)}%`, height: "100%", background: c, borderRadius: 99, transition: "width 0.5s" }} />
    </div>
  );
}
function SC({ l, v, a }) {
  return (
    <div style={{ background: "#fff", borderRadius: 12, padding: "12px 14px", borderTop: `3px solid ${a}`, boxShadow: "0 1px 4px rgba(0,0,0,0.07)" }}>
      <div style={{ fontSize: 10, color: "#bbb", textTransform: "uppercase", letterSpacing: 1 }}>{l}</div>
      <div style={{ fontSize: 20, fontWeight: 700, color: a, marginTop: 2 }}>{v}</div>
    </div>
  );
}
function CB({ c }) {
  const ci = CIRCLES[c] || CIRCLES.UNASSIGNED;
  return <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 99, background: ci.bg, color: ci.color, fontWeight: 700 }}>{ci.short}</span>;
}
function SB({ s }) {
  const si = STATUSES.find(x => x.key === s) || STATUSES[0];
  return <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 99, background: "#f0f0f0", color: si.color, fontWeight: 600 }}>{si.icon} {si.label}</span>;
}

const S = {
  app: { fontFamily: "'Georgia','Times New Roman',serif", background: "#F7F5F0", minHeight: "100vh", maxWidth: 480, margin: "0 auto", paddingBottom: 80 },
  loading: { display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100vh", fontFamily: "Georgia,serif", color: "#888", fontSize: 18 },
  hdr: { position: "sticky", top: 0, zIndex: 100, padding: "14px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" },
  peakBtn: { fontSize: 12, fontWeight: 700, padding: "7px 14px", borderRadius: 20, border: "none", cursor: "pointer" },
  nav: { position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)", width: "100%", maxWidth: 480, background: "#fff", borderTop: "1px solid #eee", display: "flex", zIndex: 100, boxShadow: "0 -2px 12px rgba(0,0,0,0.08)" },
  navBtn: { flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "10px 4px 8px", border: "none", background: "transparent", cursor: "pointer", color: "#ccc", gap: 2, fontFamily: "Georgia,serif" },
  navOn: { color: "#C8522A", borderTop: "2px solid #C8522A" },
  pg: { padding: "14px 12px 20px" },
  card: { background: "#fff", borderRadius: 14, padding: 16, marginBottom: 12, boxShadow: "0 1px 5px rgba(0,0,0,0.07)" },
  ct: { fontSize: 11, fontWeight: 700, color: "#aaa", textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 12 },
  g2: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 },
  ai: { width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 0", background: "none", border: "none", cursor: "pointer", textAlign: "left" },
  drow: { display: "flex", alignItems: "center", marginBottom: 6, borderRadius: 12, overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.07)" },
  inp: { width: "100%", padding: "11px 13px", borderRadius: 10, border: "1.5px solid #e5e5e5", fontSize: 15, fontFamily: "Georgia,serif", background: "#fafafa", boxSizing: "border-box" },
  sel: { padding: "9px 10px", borderRadius: 10, border: "1.5px solid #e5e5e5", fontSize: 13, background: "#fafafa", fontFamily: "Georgia,serif", width: "100%" },
  lbl: { display: "block", fontSize: 11, fontWeight: 700, color: "#aaa", marginBottom: 5, textTransform: "uppercase", letterSpacing: 0.8 },
  btn: { width: "100%", padding: 14, background: "#C8522A", color: "#fff", border: "none", borderRadius: 12, fontSize: 15, fontWeight: 700, cursor: "pointer", fontFamily: "Georgia,serif" },
  lnk: { background: "none", border: "none", color: "#C8522A", fontSize: 13, fontWeight: 700, cursor: "pointer", padding: "6px 0", display: "block", fontFamily: "Georgia,serif" },
  toast: { position: "fixed", top: 68, left: "50%", transform: "translateX(-50%)", background: "#1A1A2E", color: "#fff", padding: "10px 22px", borderRadius: 20, fontSize: 13, fontWeight: 700, zIndex: 9999, boxShadow: "0 4px 20px rgba(0,0,0,0.25)", whiteSpace: "nowrap", pointerEvents: "none" },
  syncBar: { position: "fixed", top: 0, left: 0, right: 0, background: "#5B7EC8", color: "#fff", textAlign: "center", fontSize: 12, padding: "4px", zIndex: 9998 },
  toggleBtn: { padding: "8px 14px", borderRadius: 20, border: "none", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "Georgia,serif", whiteSpace: "nowrap" },
};
