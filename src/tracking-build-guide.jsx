import { useState, useEffect, useMemo, useRef, useCallback, createContext, useContext } from "react";
import {
  Check, Copy, Camera, ChevronDown, ChevronRight, AlertTriangle,
  RotateCcw, ClipboardList, ExternalLink, BookOpen, Vault, X, Menu, Clipboard,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Design tokens — "field logbook" for tracking builds               */
/* ------------------------------------------------------------------ */
const T = {
  paper: "#F4F6F9",
  panel: "#FFFFFF",
  ink: "#24282f",
  muted: "#5B6B7C",
  line: "#E1E6EC",
  accent: "#0066cc",
  accentSoft: "#E5F0FB",
  warn: "#B4690E",
  warnBg: "#FBF3E4",
  codeBg: "#EAF0F6",
  sidebar: "#002c54",
  sidebarText: "#B9CCE0",
  mono: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
  sans: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
};

/* ------------------------------------------------------------------ */
/*  Code field registry (mirrors the Zoho Campaign IDs table)         */
/* ------------------------------------------------------------------ */
const CODE_FIELDS = [
  { k: "master",        label: "M360+ Master Account Email",        zoho: "M360+ Master Account Email", core: true },
  { k: "ga4measure",    label: "GA4 Measurement ID",                zoho: "GA4 Measurement ID", ph: "G-XXXXXXXXXX", core: true },
  { k: "ga4property",   label: "GA4 Property ID",                   zoho: "GA4 Property ID", core: true },
  { k: "gtm",           label: "GTM Tag ID",                        zoho: "GTM Tag ID", ph: "GTM-XXXXXXX", core: true },
  { k: "scDomain",      label: "Search Console Domain",             zoho: "Search Console Domain", core: true },
  { k: "scMeta",        label: "Search Console Meta Code",          zoho: "Search Console Meta Code", ph: "<meta name=\"google-site-verification\" ...>", core: true },
  { k: "ctcAds",        label: "CTC Number — Ads",                  zoho: "CTC — Ads", when: c => c.c2c === "yes" },
  { k: "ctcContent",    label: "CTC Number — Content",              zoho: "CTC — Content", when: c => c.c2c === "yes" },
  { k: "ctcSocial",     label: "CTC Number — Social",               zoho: "CTC — Social", when: c => c.c2c === "yes" },
  { k: "ctcOther",      label: "CTC Number — Other",                zoho: "CTC — Other", when: c => c.c2c === "yes" },
  { k: "cid",           label: "Google Ads Customer ID (CID)",      zoho: "Google Ads CID", when: c => c.ads },
  { k: "convId",        label: "Google Ads Conversion ID",          zoho: "Google Ads Conversion ID", ph: "AW-#########", when: c => c.ads },
  { k: "leadLabel",     label: "Lead Conversion Label",             zoho: "Google Ads Lead Conversion Label", when: c => c.ads && c.leads !== false },
  { k: "callLabel",     label: "Dynamic Call Conversion Label",     zoho: "Google Ads Dynamic Call Label", when: c => c.ads && c.c2c !== "none" },
  { k: "mobileLabel",   label: "Mobile Call Click Conversion Label",zoho: "Google Ads Mobile Call Click Label", when: c => c.ads && c.c2c !== "none" },
  { k: "purchaseLabel", label: "Purchase Conversion Label",         zoho: "Google Ads Purchase Conversion Label", when: c => c.ads && c.ecom },
  { k: "cartLabel",     label: "Add To Cart Conversion Label",      zoho: "Google Ads Add to Cart Label", when: c => c.ads && c.ecom },
  { k: "checkoutLabel", label: "Begin Checkout Conversion Label",   zoho: "Google Ads Begin Checkout Label", when: c => c.ads && c.ecom },
  { k: "viewItemLabel", label: "View Item Conversion Label",        zoho: "Google Ads View Item Label", when: c => c.ads && c.ecom },
  { k: "merchantId",    label: "Merchant Center ID",                zoho: "Merchant Center ID", when: c => c.merchant },
  { k: "bcc",           label: "Conversions BCC Email",             zoho: "Conversions BCC Email", ph: "marketing360+...@bcc.mad360.net", when: c => c.buildType === "wp" && !c.madforms },
  { k: "outboundLabel", label: "Outbound Click Conversion Label",   zoho: "Google Ads Outbound Click Label", when: c => c.ads && c.outbound },
];

const activeFields = (cfg) => CODE_FIELDS.filter(f => f.core || (f.when && f.when(cfg)));


/* ------------------------------------------------------------------ */
/*  Small building blocks                                             */
/* ------------------------------------------------------------------ */
const L = ({ href, children }) => (
  <a href={href} target="_blank" rel="noopener noreferrer"
     style={{ color: T.accent, fontWeight: 600, textDecoration: "none", borderBottom: `1px solid ${T.accent}55` }}>
    {children}
  </a>
);

const Shot = ({ u, l }) => (
  <a href={u} target="_blank" rel="noopener noreferrer" title={`Screenshot: ${l || "view"}`}
     style={{
       display: "inline-flex", alignItems: "center", gap: 4, margin: "0 3px 3px 0",
       padding: "2px 8px", borderRadius: 20, fontSize: 11.5, fontWeight: 600,
       background: T.codeBg, color: T.ink, textDecoration: "none",
       border: `1px solid ${T.line}`, whiteSpace: "nowrap",
     }}>
    <Camera size={11} strokeWidth={2.4} /> {l || "screenshot"}
  </a>
);

function CopyBtn({ text, small }) {
  const [done, setDone] = useState(false);
  return (
    <button
      onClick={() => {
        const ta = document.createElement("textarea");
        ta.value = text; document.body.appendChild(ta); ta.select();
        try { document.execCommand("copy"); } catch (e) {}
        document.body.removeChild(ta);
        setDone(true); setTimeout(() => setDone(false), 1400);
      }}
      style={{
        display: "inline-flex", alignItems: "center", gap: 4, cursor: "pointer",
        border: `1px solid ${done ? T.accent : T.line}`, background: done ? T.accentSoft : "#fff",
        color: done ? T.accent : T.muted, borderRadius: 6,
        padding: small ? "2px 6px" : "4px 9px", fontSize: small ? 10.5 : 12, fontWeight: 600,
        fontFamily: T.sans, flexShrink: 0,
      }}>
      {done ? <Check size={small ? 10 : 12} /> : <Copy size={small ? 10 : 12} />}
      {done ? "Copied" : "Copy"}
    </button>
  );
}

/* Literal value chip — exact strings you need to type/paste in a tool */
const Lit = ({ v }) => (
  <span style={{ display: "inline-flex", alignItems: "center", gap: 5, margin: "1px 2px" }}>
    <code style={{
      fontFamily: T.mono, fontSize: 12, background: T.codeBg, padding: "2px 6px",
      borderRadius: 4, border: `1px solid ${T.line}`, wordBreak: "break-all",
    }}>{v}</code>
    <CopyBtn text={v} small />
  </span>
);

const Warn = ({ children }) => (
  <div style={{
    display: "flex", gap: 8, background: T.warnBg, border: `1px solid ${T.warn}33`,
    borderLeft: `3px solid ${T.warn}`, borderRadius: 6, padding: "8px 10px",
    fontSize: 13, color: "#6E4408", margin: "8px 0",
  }}>
    <AlertTriangle size={15} style={{ flexShrink: 0, marginTop: 1, color: T.warn }} />
    <div>{children}</div>
  </div>
);

/* Platform-specific callout — blue, so it reads as guidance not warning */
const PlatformNote = ({ platform, children }) => (
  <div style={{
    background: T.accentSoft, border: `1px solid ${T.accent}44`, borderLeft: `3px solid ${T.accent}`,
    borderRadius: 6, padding: "9px 11px", margin: "8px 0", fontSize: 13, color: "#123", lineHeight: 1.55,
  }}>
    <div style={{ fontFamily: T.mono, fontSize: 10, letterSpacing: .8, textTransform: "uppercase", color: T.accent, fontWeight: 800, marginBottom: 4 }}>
      {platform} specifics
    </div>
    {children}
  </div>
);

/* ------------------------------------------------------------------ */
/*  Platform playbooks — distilled from the per-platform build docs.  */
/*  Keyed by the Setup "Platform" choice. Each entry supplies the     */
/*  container name, code-placement path, sitemap, feed method, and    */
/*  order-notification path so the GTM/SC/MC steps can show the       */
/*  right instructions instead of generic Websites 360 ones.          */
/* ------------------------------------------------------------------ */
const PLATFORMS = {
  w360: {
    name: "Websites 360",
    container: c => "Websites 360 - Lead Gen",
    sitemap: "sitemap.xml",
    notes: null,
  },
  wp: {
    name: "WordPress / Woo360",
    container: c => c.ecom
      ? (c.leads !== false ? "WooCommerce (Ecomm+Lead Gen)" : "WooCommerce (Ecomm Only)")
      : (c.madforms ? "Websites 360 - Lead Gen" : "Basic Lead Gen"),
    sitemap: "sitemap_index.xml",
    placement: <>Codes go in the <b>Header and Footer Scripts</b> plugin (Settings → Header and Footer Scripts; already on Woo360 sites). GTM head snippet + Search Console meta in the header box, GTM body in the footer.</>,
    ecomInstall: <>Install <L href="https://madshot.net/f7aa5750be3a.png">GTM for WordPress (GTM4WP) by Thomas Geiger</L> → Settings → Google Tag Manager → paste the GTM ID, Container code + compatibility mode <b>OFF</b>. Integration → WooCommerce → check <b>track e-commerce</b>, <b>Customer data in data layer</b>, <b>Order data in data layer</b>, and set Google Ads Business Vertical to <b>Retail</b>.</>,
    feed: <>Install <L href="https://madshot.net/0b7d646dfd6a.png">CTX Feed by WebAppick</L> → Make Feed → country → Google Shopping template → name it "Product Feed for (business name)" → XML → pick the Google Product category → under Filter, blank out campaign source and campaign name → Generate. Paste that feed URL into Merchant Center as a Scheduled Fetch.</>,
    orderNotif: <>WooCommerce → Settings → Emails → New order → add MSM + BCC to Recipients → Save.</>,
  },
  shopify: {
    name: "Shopify",
    container: c => "Shopify Customer Events (+ Shopify Theme Liquid for CTCs)",
    sitemap: "sitemap.xml",
    gaAccess: "m360+shopify@madwire.com",
    placement: <>Default is the <b>Google &amp; YouTube app</b> for GA4/Ads, or the <b>GTM + Custom Pixel</b> method. For the pixel method: Settings → Customer Events → Add Custom Pixel "M360 Custom Pixel" → paste the Custom Pixel Code with your GTM ID swapped in → Save, then Connect. Search Console meta + (if a second CTC container) GTM head go in <b>theme.liquid</b> between the &lt;head&gt; tags.</>,
    warn: <>Google Tag Assistant and the Tag Assistant Chrome extension <b>do not work</b> with the Shopify custom pixel — you can't preview tags the usual way.</>,
    ads: <>App method: Google &amp; YouTube app → Overview → Google Ads → Turn on conversion measurement → Skip account connection → Manage each event: Checkout Completed → Purchase, Checkout Started → Begin Checkout, Add to Cart → Add to Cart, Product View → View Item. Add Google Tag with a <b>GT</b> prefix.</>,
    feed: <>Install <L href="https://apps.shopify.com/parkour-pixel">Flexify: Facebook Product Feed</L> (Apps → Customize your store → Flexify) → Stand-alone mode → free plan → collection set to 'all' → Generate. Paste the feed URL into Merchant Center.</>,
    orderNotif: <>Settings → Notifications → Staff order notifications → Add recipient → MSM + BCC. (PAS also replaces the New Order email code and maps the source in CRM.)</>,
  },
  bigcommerce: {
    name: "BigCommerce",
    container: c => "check the platform build docs",
    sitemap: "xmlsitemap.php",
    placement: <>Head/body code goes via the store's Script Manager or theme files per the BigCommerce build doc. Search Console meta in the head.</>,
    feed: <>Follow the BigCommerce build doc for the product feed export, then add it to Merchant Center as a Scheduled Fetch.</>,
  },
  volusion: {
    name: "Volusion",
    container: c => "Volusion",
    sitemap: "sitemap.xml",
    ctcWarn: true,
    placement: <><b>Non-Element sites:</b> Design → File Editor → template under theme files → Search Console + GTM head under &lt;head&gt;, GTM body above &lt;/body&gt;, plus the volusion-GA4.js script before &lt;/body&gt; with your Measurement ID. <b>Element sites:</b> Design → Site Designer → Global Template → GA4 in the enhanced-ecommerce block, GTM + meta in the CSS/Script block. Both: add the GTM ecommerce data layer to article 130 (or the ROI_Javascripts article) under Design → Site Content.</>,
    warn: <>Do <b>not</b> create CTCs for Volusion builds — in GTM, pause the CTC Script tag before publishing.</>,
    feed: <>New process: Inventory → Volusion API → enable public XML for All Products + Featured Products; feed is at <code>/feed/google.xml</code>. Add to Merchant Center as Scheduled Fetch and confirm the currency matches the store.</>,
    orderNotif: <>BCC goes under Settings → Config Variables → Email Variables; CRM + Conversion Inbox in any free Email Notification box.</>,
  },
  custom: {
    name: "Other / custom platform",
    container: c => "check the platform build docs",
    sitemap: null,
    placement: <>Head/body placement, container, and feed all come from this platform's page in the PAS build documentation. Head snippet as close to &lt;head&gt; as possible with the Search Console meta; body after &lt;body&gt; or in the footer.</>,
  },
};

/* Squarespace, Wix, Square/Weebly all follow Websites-360-style flows but have
   integration quirks; surfaced as notes on the w360/custom branches via the
   Platform panel below rather than separate Setup options, per the docs. */
const PLATFORM_EXTRA = {
  squarespace: "Squarespace: lead gen uses the Basic Lead Gen container via Website → Code Injection (GTM head + SC meta in header, GTM body in footer). Ecommerce uses Squarespace's built-in GA4 (Settings → Advanced → External API Keys) and Facebook Pixel integrations — pause those tags in GTM. Google Ads purchase script goes on the order confirmation page via Code Injection. Forms connect to CRM via Zapier (no direct BCC).",
  wix: "Wix: import Wix - Lead Gen or Wix - Ecomm+Lead container. Single-page app, so tags use custom events — test every tag in preview. SC meta via Settings → Custom Code (head, all pages); GTM via Marketing Integrations. Ecommerce GA4 uses Wix's integration (pause GA4 config tag in GTM). Forms/orders connect via Zapier.",
  square: "Square/Weebly: import SquareUp (Lead Gen) or SquareUp (Ecomm+Lead) container. Single-page app — tags use page views + History Changes, test every tag in preview. Codes via Settings → Tracking Tools. Appointments can't be tracked. Orders/forms connect via Zapier.",
};

/* ------------------------------------------------------------------ */
/*  Codes context + stable module-level components                    */
/* ------------------------------------------------------------------ */
const CodesCtx = createContext({ codes: {}, setCode: () => {} });

function CodeField({ k }) {
  const { codes, setCode } = useContext(CodesCtx);
  const f = CODE_FIELDS.find(x => x.k === k);
  const v = codes[k] || "";
  return (
    <div style={{
      margin: "8px 0", padding: "9px 11px", background: v.trim() ? T.accentSoft : "#FAFBFD",
      border: `1px solid ${v.trim() ? T.accent + "55" : T.line}`, borderRadius: 8,
      transition: "background .25s, border-color .25s",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 5 }}>
        <label style={{ fontFamily: T.mono, fontSize: 10.5, letterSpacing: .8, textTransform: "uppercase", color: v.trim() ? T.accent : T.muted, fontWeight: 700 }}>
          {v.trim() ? "✓ " : ""}Paste here → {f.label}
        </label>
        {v.trim() ? <CopyBtn text={v} small /> : null}
      </div>
      <input
        value={v}
        onChange={e => setCode(k, e.target.value)}
        placeholder={f.ph || "Paste the value exactly as it appears"}
        style={{
          width: "100%", boxSizing: "border-box", fontFamily: T.mono, fontSize: 13,
          padding: "7px 9px", border: `1px solid ${T.line}`, borderRadius: 6,
          background: "#fff", color: T.ink, outline: "none",
        }}
      />
    </div>
  );
}

/* Quick-copy row — tap anywhere on the row to copy the value */
function QuickRow({ label, value }) {
  const [done, setDone] = useState(false);
  const copy = () => {
    const ta = document.createElement("textarea");
    ta.value = value; document.body.appendChild(ta); ta.select();
    try { document.execCommand("copy"); } catch (e) {}
    document.body.removeChild(ta);
    setDone(true); setTimeout(() => setDone(false), 1400);
  };
  return (
    <button onClick={copy} style={{
      display: "flex", alignItems: "center", gap: 8, width: "100%", textAlign: "left",
      padding: "7px 9px", borderRadius: 8, cursor: "pointer", fontFamily: T.sans,
      border: `1px solid ${done ? T.accent : T.line}`,
      background: done ? T.accentSoft : "#fff", transition: "background .2s, border-color .2s",
    }}>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontSize: 10.5, fontWeight: 700, color: T.muted, textTransform: "uppercase", letterSpacing: .5 }}>{label}</div>
        <div style={{ fontFamily: T.mono, fontSize: 12.5, color: T.ink, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{value}</div>
      </div>
      <span style={{
        display: "inline-flex", alignItems: "center", gap: 4, flexShrink: 0,
        color: done ? T.accent : T.muted, fontSize: 11, fontWeight: 700,
      }}>
        {done ? <Check size={12} /> : <Copy size={12} />}{done ? "Copied" : "Copy"}
      </span>
    </button>
  );
}

function Toggle({ label, sub, value, onChange, options }) {
  return (
    <div style={{ padding: "12px 0", borderBottom: `1px solid ${T.line}` }}>
      <div style={{ fontWeight: 700, fontSize: 13.5, marginBottom: 2 }}>{label}</div>
      {sub && <div style={{ fontSize: 12, color: T.muted, marginBottom: 8 }}>{sub}</div>}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 6 }}>
        {options.map(o => (
          <button key={String(o.v)} onClick={() => onChange(o.v)} style={{
            padding: "6px 12px", borderRadius: 20, cursor: "pointer", fontSize: 12.5, fontWeight: 600,
            fontFamily: T.sans,
            border: `1.5px solid ${value === o.v ? T.accent : T.line}`,
            background: value === o.v ? T.accentSoft : "#fff",
            color: value === o.v ? T.accent : T.muted,
          }}>{o.l}</button>
        ))}
      </div>
    </div>
  );
}

const Eyebrow = ({ children }) => (
  <div style={{ fontFamily: T.mono, fontSize: 10.5, letterSpacing: 1.6, textTransform: "uppercase", color: T.accent, fontWeight: 700 }}>{children}</div>
);
const h2s = { fontSize: 22, fontWeight: 800, letterSpacing: -0.4, margin: "4px 0 2px", color: T.ink };

/* ------------------------------------------------------------------ */
/*  Main app                                                          */
/* ------------------------------------------------------------------ */
const STORAGE_KEY = "tracking-build-guide-v1";

export default function TrackingBuildGuide() {
  const [client, setClient] = useState({ m: "", name: "", url: "", msmEmail: "", adSpecEmail: "" });
  const [cfg, setCfg] = useState({
    buildType: null, // platform: 'w360' | 'wp' | 'shopify' | 'bigcommerce' | 'volusion' | 'custom'
    leads: true,
    ads: true, c2c: "yes", madforms: true, ecom: false, merchant: false,
    outbound: false, subdomain: false, clientPlacing: false,
  });
  const [codes, setCodes] = useState({});
  const [checks, setChecks] = useState({});
  const [active, setActive] = useState("setup");
  const [vaultOpen, setVaultOpen] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const [clipOpen, setClipOpen] = useState(false);
  const openDrawer = (which) => {
    setNavOpen(which === "nav" ? v => !v : false);
    setClipOpen(which === "clip" ? v => !v : false);
  };
  const vaultDismissed = useRef(false);
  const prevFilled = useRef(0);
  const closeVault = () => { setVaultOpen(false); vaultDismissed.current = true; };
  const [loaded, setLoaded] = useState(false);
  const [openSpecial, setOpenSpecial] = useState(null);
  const [resetArmed, setResetArmed] = useState(false);
  const saveTimer = useRef(null);

  /* ---- persistence ---- */
  useEffect(() => {
    (async () => {
      try {
        const r = await window.storage.get(STORAGE_KEY);
        if (r && r.value) {
          const s = JSON.parse(r.value);
          if (s.client) setClient(p => ({ ...p, ...s.client }));
          if (s.cfg) setCfg(p => ({ ...p, ...s.cfg, ...(s.cfg.buildType === "ecom" ? { buildType: null, ecom: true, leads: true } : {}) }));
          if (s.codes) setCodes(s.codes);
          if (s.checks) setChecks(s.checks);
          if (s.active) setActive(s.active);
        }
      } catch (e) { /* nothing saved yet */ }
      setLoaded(true);
    })();
  }, []);

  useEffect(() => {
    if (!loaded) return;
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      try {
        await window.storage.set(STORAGE_KEY, JSON.stringify({ client, cfg, codes, checks, active }));
      } catch (e) { /* storage unavailable — keep working in memory */ }
    }, 600);
    return () => clearTimeout(saveTimer.current);
  }, [client, cfg, codes, checks, active, loaded]);

  const resetAll = async () => {
    if (!resetArmed) {
      setResetArmed(true);
      setTimeout(() => setResetArmed(false), 3500);
      return;
    }
    setResetArmed(false);
    setClient({ m: "", name: "", url: "", msmEmail: "", adSpecEmail: "" });
    setCfg({ buildType: null, leads: true, ads: true, c2c: "yes", madforms: true, ecom: false, merchant: false, outbound: false, subdomain: false, clientPlacing: false });
    setCodes({}); setChecks({}); setActive("setup"); setOpenSpecial(null);
    setVaultOpen(false); vaultDismissed.current = false; prevFilled.current = 0;
    try { await window.storage.delete(STORAGE_KEY); } catch (e) {}
  };

  const setCode = useCallback((k, v) => setCodes(p => ({ ...p, [k]: v })), []);
  const toggle = (id) => setChecks(p => ({ ...p, [id]: !p[id] }));

  const M = client.m ? client.m.toUpperCase().replace(/^([0-9])/, "M$1") : "M#####";
  const bizName = client.name || "Business Name";
  const msmChip = client.msmEmail ? <> MSM <Lit v={client.msmEmail} /></> : <> the MSM</>;
  const adSpecChip = cfg.ads ? (client.adSpecEmail ? <> and Ad Specialist <Lit v={client.adSpecEmail} /></> : <> and the Ad Specialist</>) : null;

  /* ---- quick-copy clipboard strings, derived from setup ---- */
  const quickCopies = useMemo(() => {
    const baseDomain = (client.url || "").replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/.*$/, "");
    const noHttps = (client.url || "").replace(/^https?:\/\//, "").replace(/\/$/, "");
    const g = [];
    g.push({
      title: "Naming",
      items: [
        { l: "Account / property name (GA4, Optmyzr, GTM, PO field)", v: `${M} - ${bizName}` },
        client.url ? { l: "Site URL (no https) — streams, GTM container", v: noHttps } : null,
        baseDomain ? { l: "Base domain (no www) — CTC tracked domain", v: baseDomain } : null,
        cfg.subdomain && baseDomain ? { l: "Marketing 360 Search Console field (domain property)", v: `sc-domain:${baseDomain}` } : null,
      ].filter(Boolean),
    });
    g.push({
      title: "Contacts",
      items: [
        codes.master ? { l: "Master account email", v: codes.master } : null,
        client.msmEmail ? { l: "MSM email", v: client.msmEmail } : null,
        cfg.ads && client.adSpecEmail ? { l: "Ad Specialist email", v: client.adSpecEmail } : null,
      ].filter(Boolean),
    });
    if (cfg.ads) {
      const conv = [];
      if (cfg.leads !== false) conv.push({ l: "Lead goal name", v: `New Web Lead ${M}` });
      if (cfg.c2c !== "none") {
        conv.push({ l: "Calls goal name", v: `Calls From Ads ${M}` });
        conv.push({ l: "Dynamic call goal name", v: `Dynamic Call Conversion ${M}` });
        conv.push({ l: "Mobile call click goal name", v: `Mobile Call Click Conversion ${M}` });
      }
      if (cfg.ecom) {
        conv.push({ l: "Purchase goal name", v: `New Web Order For ${M}` });
        conv.push({ l: "Add to cart goal name", v: `Add To Cart For ${M}` });
        conv.push({ l: "Checkout goal name", v: `Initiate Checkout For ${M}` });
        conv.push({ l: "Product view goal name", v: `Product Page View For ${M}` });
      }
      g.push({ title: "Conversion action names", items: conv });
    }
    g.push({
      title: "Exact values",
      items: [
        cfg.c2c === "yes" ? { l: "Whisper message (Ads number only)", v: "Marketing three sixty lead" } : null,
        { l: "GA4 internal traffic rule value", v: "52\\.173\\.65\\.50|198\\.99\\.81\\.210|198\\.99\\.82\\.118" },
        { l: "GA4 key event name", v: "generate_lead" },
        cfg.outbound ? { l: "Outbound event name", v: "outbound_click" } : null,
        { l: "Referral exclusion", v: "marketing360.com" },
        { l: "Referral exclusion", v: "madwire.net" },
        { l: "Referral exclusion", v: "zoho.com" },
        cfg.ecom ? { l: "Referral exclusion (ecommerce)", v: "paypal.com" } : null,
        ["w360", "shopify"].includes(cfg.buildType) ? { l: "Sitemap", v: "sitemap.xml" } : null,
        cfg.buildType === "wp" ? { l: "Sitemap (Woo360/WP)", v: "sitemap_index.xml" } : null,
        cfg.buildType === "bigcommerce" ? { l: "Sitemap (BigCommerce)", v: "xmlsitemap.php" } : null,
        cfg.merchant ? { l: "Merchant Center feed label", v: "SHOP_APP" } : null,
        { l: "GTM publish name", v: "Initial Build" },
      ].filter(Boolean),
    });
    return g.filter(grp => grp.items.length);
  }, [client, cfg, codes.master, M, bizName]);
  const fields = useMemo(() => activeFields(cfg), [cfg]);
  const filled = fields.filter(f => (codes[f.k] || "").trim()).length;

  /* Auto-open the vault drawer when a new code gets captured */
  useEffect(() => {
    if (loaded && filled > prevFilled.current && !vaultDismissed.current) setVaultOpen(true);
    prevFilled.current = filled;
  }, [filled, loaded]);

  /* ---- shared field component lives at module level (CodesCtx) ---- */

  /* ---------------------------------------------------------------- */
  /*  Step content per section (built from handbook)                  */
  /* ---------------------------------------------------------------- */
  const sections = useMemo(() => {
    if (!cfg.buildType) return [];
    const secs = [];
    const isWP = cfg.buildType === "wp";
    const isCustom = !["w360", "wp"].includes(cfg.buildType);
    const ecomOnly = cfg.ecom && cfg.leads === false;
    const isEcom = cfg.ecom;
    const plat = PLATFORMS[cfg.buildType] || PLATFORMS.custom;
    const platName = plat.name;

    /* ---------- GETTING STARTED ---------- */
    secs.push({
      id: "start", title: "Getting started",
      steps: [
        { id: "adpause", title: "Check Adpausing before anything else", body: <>
          Open <L href="https://adpausing.marketing360.com/">Adpausing</L> and search the M#. You should see <Shot u="https://madshot.net/d28e4900ae2e.png" l="no accounts linked" /> yet.
          <Warn><b>Google Ad account already linked?</b> Search it in Google Ads. LSA next to the account → proceed. A normal Ads account → this is a <b>Rebuild</b>; chat the link in your chatroom for reassignment.</Warn>
          <Warn><b>Facebook Ad account already linked?</b> Use the existing master account from the Facebook Additions task (check the Campaign IDs section in Zoho, or the MO quicklink — migrate to Zoho if needed). A GTM account will already exist — <b>do not create a second one</b>; update its variables and verify codes instead. Master account passwords live in MadPass.</Warn>
        </> },
        { id: "live", title: "Confirm the site is live", body: <>
          The site must be live to complete a Tracking Build. If it's still in GoLive: cancel all tasks in the project, comment your reason in each, and chat the MSM to create a new task once the site is live.
        </> },
        { id: "zoho", title: "Open the Zoho Campaign IDs table", body: <>
          All tracking IDs, emails, and labels are stored in Zoho. <L href="https://www.canva.com/design/DAGsyztsFmI/u96lxkWDYpraJRCjfty9gg/edit">Walkthrough video</L>. In crm.zoho.com open the client's dashboard → <Shot u="https://madshot.net/194dffb003b5.png" l="Ads tab" /> → Campaign ID section. To add a row: <Shot u="https://madshot.net/c3267e484812.png" l="Add row" />, pick the Type from the <Shot u="https://madshot.net/03343aeceecb.png" l="dropdown" />, Identifier = the value, Title = optional detail, then the blue checkmark.
          <div style={{ marginTop: 6, fontSize: 12.5, color: T.muted }}>This guide mirrors that table — paste each value into the boxes as you create it and the Code Vault will assemble your final list.</div>
        </> },
        { id: "checklist", title: "Copy your personal DoubleCheck sheet", optional: true, body: <>
          The old Checklist is retired. If you like working from a personal doublecheck copy: in Sheets, +New → Google Sheets → <Shot u="https://madshot.net/f0749127b30c.png" l="From a template" /> → select <L href="https://docs.google.com/spreadsheets/d/1Cle3EyNsV3EZgoWYDRxP_-DTqmYfkuvOFjyg1kN62d0/edit?gid=0#gid=0">AS/PAS DoubleCheck – MASTER</L>. This guide's checklist and Code Vault cover the same ground, so use whichever keeps you honest.
        </> },
        { id: "master", title: "Log into your Master Account", body: <>
          GA4, Google Ads, and Search Console are built through a <b>master account</b> (credentials in <Shot u="https://madshot.net/11a9f06b216e.png" l="Passbolt" /> under Platform Analytics Specialist). GTM is created under your @madwire email and shared to the master at the end. Tip: run a dedicated Chrome workspace for the master account — click the icon next to the 3 dots in the <Shot u="https://madshot.net/38b1f165b311.png" l="top right corner" />.
          <details style={{ marginTop: 6 }}>
            <summary style={{ cursor: "pointer", fontWeight: 600, fontSize: 13, color: T.accent }}>Master account assignments</summary>
            <div style={{ fontFamily: T.mono, fontSize: 12, lineHeight: 1.9, marginTop: 4 }}>
              Erika, Kaela — 1019 · Ryan, Val — 1020 · Kris, Tim — 1022 · Chris — 1023 · Greg, Maddie — 1024 · Steph, Ian — 1025 · Dom, Alliyah — 1028 · John — 1029 · Katie, Hollie — 1031 · Kirsten, Zach — 1032 · Alissa, Zay — 1033
              <div style={{ marginTop: 2, color: T.muted }}>Format: M360+Accounts10XX@madwiremedia.com</div>
            </div>
          </details>
          <CodeField k="master" />
        </> },
        ...(isEcom ? [{ id: "shopfeed", title: "Shop App: kick off feed generation now", body: <>
          For <L href="https://missioncontrol.madwire.com/platform-analytics-specialist/pas-shopapp-build-documentation-master/">Shop App</L> builds, generate the product feed <b>before</b> you begin — it can take a while. Jump to the Feed Generation steps in that doc, start it, then continue here.
        </> }] : []),
      ],
    });

    /* ---------- C2Cs ---------- */
    if (cfg.c2c === "yes") {
      secs.push({
        id: "c2c", title: "Click to Calls (C2Cs)",
        steps: [
          { id: "c2c1", title: "Add the first tracking number (Ads)", body: <>
            In the client's Marketing 360 account open the <Shot u="https://madshot.net/a5eaa49783b0.png" l="Intelligence app" /> → Settings tab → <Shot u="https://madshot.net/65291fb1fbdc.png" l="Add Tracking Number" />. Ring-To number comes from the task. Toll free vs. area code should also be in the task — pick it in the <Shot u="https://madshot.net/637bfcc4f550.png" l="select or transfer section" />.
            <Warn>No phone number in the task? Note it and move on to GA4. If the MSM doesn't specify area code, match their location; if no numbers populate for it, try their other locations/area codes, otherwise it must be toll free or we can't set up call tracking.</Warn>
          </> },
          { id: "c2c2", title: "Configure the Ads number", body: <>
            In Configure: name it <Lit v={`${bizName} - Ads`} />, set Channel Attribution to <b>Ads</b>, and add <Lit v="Marketing three sixty lead" /> in the <Shot u="https://madshot.net/623c6776de99.png" l="whisper message" /> box (Ads number only). Check <b>record calls</b> — unless the client is Canadian or recording would violate HIPAA (health-related; it'll be noted in your task). Check <b>count as lead</b> and save.
            <CodeField k="ctcAds" />
          </> },
          { id: "c2c3", title: "Repeat for Content, Social, Other", body: <>
            Same setup three more times with the matching Channel Attribution — no whisper message on these.
            <CodeField k="ctcContent" />
            <CodeField k="ctcSocial" />
            <CodeField k="ctcOther" />
          </> },
          { id: "c2c4", title: "Notifications, domain, and testing", body: <>
            <Shot u="https://madshot.net/97d886fffa1c.png" l="Add email notifications" /> requested in the task (usually the client) and <b>always add</b>{msmChip}. Then click Add Domain and enter the base URL only — <Lit v="test.com" /> not https://www.test.com. Finally, paste the numbers in the task and chat them to the MSM for testing.
          </> },
        ],
      });
    }

    /* ---------- GA4 ---------- */
    secs.push({
      id: "ga4", title: "Google Analytics (GA4)",
      steps: [
        { id: "ga1", title: "Create the account (master account)", body: <>
          Open <L href="https://analytics.google.com/">analytics.google.com</L> logged in as the master. Make sure you're in "All Accounts", not an organization: click the <Shot u="https://madshot.net/318600432669.png" l="account" />, open the org dropdown → <Shot u="https://madshot.net/8bc45e63e507.png" l="All Accounts" />, open any random M# account, and confirm <Shot u="https://madshot.net/268ec4d9ebe1.png" l="All Accounts is showing" />. Then <Shot u="https://madshot.net/81e012287968.png" l="Admin" /> → <Shot u="https://madshot.net/752de71d1348.png" l="+ Create Account" />.
        </> },
        { id: "ga2", title: "Account + property details", body: <>
          Account name: <Lit v={`${M} - ${bizName}`} /> with only <Shot u="https://madshot.net/72850884c08e.png" l="Technical Support checked" />. Property name: same <Lit v={`${M} - ${bizName}`} />, set the client's reporting <Shot u="https://madshot.net/ecdb44ebccbe.png" l="time zone" /> (no location? use the call tracking area code). Industry: closest match or "other"; business size: small if unknown <Shot u="https://madshot.net/25642aac70d3.png" l="example" />. Business objective: <Shot u="https://madshot.net/5d2bc96f177b.png" l="other" />, then accept <Shot u="https://madshot.net/675f333fc961.png" l="usage terms" />.
        </> },
        { id: "ga3", title: "Create the web stream → grab Measurement ID", body: <>
          Platform: <Shot u="https://madshot.net/0c1dd669faf1.png" l="Web" />. Enter the URL without https (URL doubles as stream name) and confirm the <Shot u="https://madshot.net/cac778b004ad.png" l="SSL matches the site" />. Close the <Shot u="https://madshot.net/0cb37a86865d.png" l="set up google tags page" /> with X so the <Shot u="https://madshot.net/9245999fd2b4.png" l="web stream details" /> appear, then copy the <Shot u="https://madshot.net/93b592ce5c65.png" l="Measurement ID" />.
          <CodeField k="ga4measure" />
        </> },
        { id: "ga4tag", title: "Configure tag settings (internal traffic + referrals)", body: <>
          Scroll to Google Tag → <Shot u="https://madshot.net/a4960b4f3857.png" l="Configure tag settings" /> (also where <Shot u="https://madshot.net/8a66de73b03a.png" l="cross-domain tracking" /> lives). Show all → <Shot u="https://madshot.net/25944abd3713.png" l="Define internal traffic" /> → new rule per <Shot u="https://madshot.net/8e93a2e27f9a.png" l="this setup" />:
          <div style={{ margin: "6px 0" }}>
            Rule name <Lit v="Madwire IP" /> · Match type: IP address matches regular expression · Value: <Lit v="52\.173\.65\.50|198\.99\.81\.210|198\.99\.82\.118" />
          </div>
          Then <Shot u="https://madshot.net/ff2239cadce9.png" l="List unwanted referrals" /> ("Referral domain contains"): <Lit v="marketing360.com" /> <Lit v="madwire.net" /> <Lit v="zoho.com" /> {isEcom ? <Lit v="paypal.com" /> : null}{isEcom ? " (paypal.com is ecommerce only)" : ""}. <Shot u="https://madshot.net/e9de13be5c84.png" l="Save" />, close the flyouts, <Shot u="https://madshot.net/9f1a4a8ac400.png" l="Next" />, <Shot u="https://madshot.net/23a895df4501.png" l="Continue to Home" />.
        </> },
        { id: "ga5", title: "Data collection + retention", body: <>
          <Shot u="https://madshot.net/812b71d7be3e.png" l="gear icon" /> → Admin → Data collection and modification → <Shot u="https://madshot.net/0bf5261fd9c7.png" l="Data collection" />. <Shot u="https://madshot.net/97587073e897.png" l="Turn on" /> every <Shot u="https://madshot.net/fa6ecee87779.png" l="option" /> and <Shot u="https://madshot.net/23d3e106f245.png" l="acknowledge user data collection" />. Then <Shot u="https://madshot.net/a10a4d68a4fa.png" l="data retention" /> → set to <b>14 months</b> <Shot u="https://madshot.net/fadb1770f5e2.png" l="setting" /> → Save.
        </> },
        { id: "ga6", title: ecomOnly ? "Verify the purchase key event" : isEcom ? "Key events (purchase + generate_lead)" : "Create the generate_lead key event", body: ecomOnly ? <>
          Admin → Data display → <Shot u="https://madshot.net/d5c9a4af0223.png" l="Events" />: verify the <Shot u="https://madshot.net/44d5a09f3576.png" l="purchase" /> key event was defaulted into the account. Since this build only tracks purchases, you don't need to create the generate_lead key event.
        </> : <>
          Admin → Data display → <Shot u="https://madshot.net/d5c9a4af0223.png" l="Events" /> → <Shot u="https://madshot.net/dcc7a64f0c63.png" l="+ Create event" />: name <Lit v="generate_lead" /> (don't miss the underscore), toggle on <Shot u="https://madshot.net/e50d102a9812.png" l="Make key event" />, don't set a default key event value, counting method <b>Once per session</b>, and <Shot u="https://madshot.net/9af92c5de1ce.png" l="Create with code" />. Click Create.
          {isEcom && <Warn><b>Ecommerce:</b> also verify the <Shot u="https://madshot.net/44d5a09f3576.png" l="purchase" /> key event defaulted into the account. generate_lead is needed because this build tracks both leads <i>and</i> purchases.</Warn>}
        </> },
        { id: "ga7", title: "Access + Property ID", body: <>
          Admin → <Shot u="https://madshot.net/059c2dfdcfa2.png" l="Account Access Management" />: add{msmChip}{adSpecChip} as <Shot u="https://madshot.net/3528c65f7a9c.png" l="Administrator" />. If a user can't be added, skip and note it in comments. Then Property → Property Details → <Shot u="https://madshot.net/5af8c62712da.png" l="copy the Property ID" />.
          <CodeField k="ga4property" />
        </> },
      ],
    });

    /* ---------- GOOGLE ADS ---------- */
    if (cfg.ads) {
      const goalSteps = [];
      if (isEcom) {
        goalSteps.push({ id: "adse1", title: "Ecommerce goals: Purchase (primary)", body: <>
          Goals → Summary → <Shot u="https://madshot.net/6939edc61230.png" l="New Conversion Action" /> → <Shot u="https://madshot.net/39c38ff4674d.png" l="Website" /> → <Shot u="https://madshot.net/8a2751dc3e0d.png" l="paste URL and Scan" /> → <Shot u="https://madshot.net/950d36ea5800.png" l="cancel auto action" /> → <Shot u="https://madshot.net/9e6bc346fc90.png" l="add manually" />. Goal/optimization: <Shot u="https://madshot.net/4e27047e2a2d.png" l="Purchase" />. Name <Lit v={`New Web Order For ${M}`} />. <Shot u="https://madshot.net/cd185ad757fd.png" l="Value" />: use different values, leave $1. <Shot u="https://madshot.net/14879e676be1.png" l="Count" />: Every. Done. Ensure <Shot u="https://madshot.net/d04b8f3695fa.png" l="Turn on enhanced conversions" /> is checked, agree and continue. Select Use Google Tag Manager and copy the <Shot u="https://madshot.net/ef8e1ee43c66.png" l="New Web Conversion Label" />.
          <CodeField k="purchaseLabel" />
        </> });
        goalSteps.push({ id: "adse2", title: "Ecommerce goals: Add To Cart (secondary)", body: <>
          Same flow (Website → Scan → cancel → add manually). Goal: Add To Cart. Name <Lit v={`Add To Cart For ${M}`} />. Value: different values, $1. Count: Every. Enhanced conversions checked → agree and continue → copy the <Shot u="https://madshot.net/9032265ba5f6.png" l="Add To Cart label" />.
          <Warn><b>Then:</b> go to settings and change it to a <Shot u="https://madshot.net/b6262d9ce857.png" l="secondary conversion" /> and <b>uncheck enhanced conversions</b> <Shot u="https://madshot.net/f2a0fc8b1136.png" l="example" />.</Warn>
          <CodeField k="cartLabel" />
        </> });
        goalSteps.push({ id: "adse3", title: "Ecommerce goals: Begin Checkout (secondary)", body: <>
          Same flow. Goal: Begin Checkout. Name <Lit v={`Initiate Checkout For ${M}`} />. Value: different values, $1. Count: Every. Copy the <Shot u="https://madshot.net/29db0943a2f6.png" l="Initiate Checkout label" />.
          <Warn>Change to <Shot u="https://madshot.net/b6262d9ce857.png" l="secondary" /> + uncheck enhanced conversions.</Warn>
          <CodeField k="checkoutLabel" />
        </> });
        goalSteps.push({ id: "adse4", title: "Ecommerce goals: Product Page View (secondary)", body: <>
          Same flow. Goal: Page View. Name <Lit v={`Product Page View For ${M}`} />. Value: different values, $1. Count: Every. Copy the <Shot u="https://madshot.net/79d2ef4df99e.png" l="Product Page View label" /> (logs to Zoho as Google Ads View Item Label).
          <Warn>Change to <Shot u="https://madshot.net/b6262d9ce857.png" l="secondary" /> + uncheck enhanced conversions.</Warn>
          <CodeField k="viewItemLabel" />
        </> });
      }
      if (!isEcom) {
        goalSteps.push({ id: "adsl1", title: "Lead goal: New Web Lead", body: <>
          Navigate to <Shot u="https://madshot.net/6939edc61230.png" l="Goals › Summary › New Conversion Action" />. Website conversions are checked by default; also check <Shot u="https://madshot.net/a3dd190460d6.png" l="Conversions from phone calls" />. <Shot u="https://madshot.net/56e0b2ed5435.png" l="Add URL" /> → paste your URL → <Shot u="https://madshot.net/b16db59b5ce4.png" l="select Google Tag" /> → Done → Save and Continue. Click See All → <Shot u="https://madshot.net/819c5c04308a.png" l="Submit lead form" /> → <Shot u="https://madshot.net/9f4041ca6915.png" l="+ Add conversion actions" /> → <Shot u="https://madshot.net/4d400b1f372f.png" l="the google tag under Web" /> → create new → <Shot u="https://madshot.net/2b34050ba824.png" l="set up manually using code" /> → enter URL, Scan, open Conversion Setting.
          <div style={{ margin: "6px 0" }}>Primary action for bidding · Name <Lit v={`New Web Lead ${M}`} /> · Value: <Shot u="https://madshot.net/d4f10e64b5a5.png" l="different values per conversion" />, check Event snippet, default USD $0 · <Shot u="https://madshot.net/d318108d5fa9.png" l="Count: One" /> · rest default → Done.</div>
          Once saved, open <b>See event snippet</b> (or Tag Setup → Use Google Tag Manager) — the second value is this goal's label; paste it now so you don't have to circle back:
          <CodeField k="leadLabel" />
        </> });
      } else if (cfg.leads !== false) {
        goalSteps.push({ id: "adsl1b", title: "Lead goal: New Web Lead", body: <>
          <Shot u="https://madshot.net/39c38ff4674d.png" l="Website" /> → <Shot u="https://madshot.net/8a2751dc3e0d.png" l="paste URL and Scan" /> → <Shot u="https://madshot.net/451486779f24.png" l="cancel" /> the auto action → <Shot u="https://madshot.net/0b7277e3ef08.png" l="Add Conversion Action Manually" />. Name <Lit v={`New Web Lead ${M}`} />, category "Submit lead form", <Shot u="https://madshot.net/18871bf41ae7.png" l="don't use a value" />, <Shot u="https://madshot.net/d318108d5fa9.png" l="count: one" />, defaults, Done → Agree and Continue. Copy the <Shot u="https://madshot.net/a7500afbd786.png" l="Lead Conversion Label" />.
          <CodeField k="leadLabel" />
        </> });
      }
      if (cfg.c2c !== "none") {
        goalSteps.push({ id: "adsc1", title: "Call goals: Calls From Ads", body: <>
          <Shot u="https://madshot.net/ddd741a0bab8.png" l="Add another category" /> → <Shot u="https://madshot.net/70a260cdd710.png" l="Phone call lead" /> → +Add conversion action → <Shot u="https://madshot.net/bbd3e3cf595a.png" l="Calls from ads" /> → Edit Settings. Primary action · Name <Lit v={`Calls From Ads ${M}`} /> · Value: <Shot u="https://madshot.net/d4f10e64b5a5.png" l="different values" />, Event snippet checked, USD $0 · <Shot u="https://madshot.net/d318108d5fa9.png" l="Count: one" /> · Done.
          <div style={{ marginTop: 6, fontSize: 12.5, color: T.muted }}>No label to paste for this one — Calls From Ads fires from the ad itself, not a site tag, so it never goes in GTM or Zoho.</div>
        </> });
        goalSteps.push({ id: "adsc2", title: "Call goals: Dynamic Call Conversion", body: <>
          +Add conversion action → <Shot u="https://madshot.net/272c8606d5e3.png" l="Calls from website visits" />. Check "Someone calls a number on my website" and <Shot u="https://madshot.net/cd0a4c3148cb.png" l="paste the CTC-Ads number" /> in the correct format into <b>both</b> boxes → Use this event → <Shot u="https://madshot.net/8aa4d9204318.png" l="Edit Settings" />. Primary action · Name <Lit v={`Dynamic Call Conversion ${M}`} /> · <Shot u="https://madshot.net/18871bf41ae7.png" l="don't use a value" /> · Count: one · Done. Grab the label from See event snippet / Tag Setup and paste it here:
          <CodeField k="callLabel" />
          <Warn>Destination + display number must be your CTC-Ads number. No CTCs? Use the website's phone number — unless the MSM said to skip dynamic call tracking.</Warn>
        </> });
        goalSteps.push({ id: "adsc3", title: "Call goals: Mobile Call Click (if floating mobile footer)", body: <>
          Only if the mobile click-to-call link shows an icon only (floating mobile footer enabled). +Add conversion action → Calls from website visits → <Shot u="https://madshot.net/f459a9add2d3.png" l="someone makes a call by clicking a number" /> → Use this event → Edit Settings. <b>Secondary</b> action (not used for bidding) · Name <Lit v={`Mobile Call Click Conversion ${M}`} /> · Value: different values, Event snippet, USD $0 · Count: one · Done. Label goes here (screenshot: <Shot u="https://madshot.net/e23d20a6b6ec.png" l="mobile label" />):
          <CodeField k="mobileLabel" />
          <Warn>If it won't let you set Secondary here, open the goal from the main dashboard afterward and switch it to <Shot u="https://madshot.net/dcfad7c29323.png" l="Secondary" />. These can generate spam — Secondary keeps them out of Marketing 360.</Warn>
        </> });
      }
      goalSteps.push({ id: "adslabels", title: "Save and capture the Conversion ID", body: <>
        Click Save and continue, then select <b>See event snippet</b> on any conversion action: the first number is the <Shot u="https://madshot.net/9a6bbc707e10.png" l="Conversion ID" /> (shared by every goal), the second is that goal's label. Or click Finish, open an action, and use <Shot u="https://madshot.net/51f00b361b4c.png" l="Tag Setup" /> → Use Google Tag Manager → <Shot u="https://madshot.net/01cb7054c229.png" l="Conversion ID and Label" />. The labels have paste boxes on their goal steps above — check the vault to confirm none are missing. Negative keywords are no longer added during setup.
        <CodeField k="convId" />
      </> });

      secs.push({
        id: "ads", title: "Google Ads tracking",
        steps: [
          { id: "adsbudget", title: "Verify the ad budget first", body: <>
            This lives in the separate <b>"Google Ads Tracking"</b> task inside your tracking build project (its partner "Google Ads Campaign" task is worked after this one). Confirm an Ad Specialist is assigned in Zoho and the client has an <Shot u="https://madshot.net/a35862a391e7.png" l="Ad Credit balance" /> in <L href="https://backoffice.marketing360.com/">BackOffice</L>.
            <Warn>No budget? Cancel Google Ads Tracking + Google Ads Campaign tasks with a comment, flip the "Google Ads budget" toggle off in this guide's setup, and skip to GTM.</Warn>
          </> },
          { id: "optmyzr", title: "Create the account in Optmyzr", body: <>
            Open <L href="https://tools.optmyzr.com/toolsv2">Optmyzr</L> → <Shot u="https://madshot.net/15c7946c0f88.png" l="Accounts" /> → <Shot u="https://madshot.net/b6dd9c934f15.png" l="Link another account" /> → wait for load → <Shot u="https://madshot.net/7a00d15e105f.png" l="+ Create Account" /> (click again if the popup doesn't appear). In the popup: Manager Account <Shot u="https://madshot.net/780e4cfcaf27.png" l="Madwire MCC (122-703-6021)" />, Account Name <Shot u="https://madshot.net/71ed82f9c7bd.png" l="M# - Client Name" /> = <Lit v={`${M} - ${bizName}`} />, Currency <Shot u="https://madshot.net/97097b03e307.png" l="USD" />, <Shot u="https://madshot.net/1011b3d80ba7.png" l="timezone from task" /> → Create. Success = <Shot u="https://madshot.net/43817038e1d9.png" l="confirmation popup" /> → <Shot u="https://madshot.net/e75fcaeb59bb.png" l="copy the CID" /> → "Maybe later". Error? Click Create again.
            <CodeField k="cid" />
          </> },
          { id: "billing", title: "Billing in Google Ads (master profile)", body: <>
            In your Master Account Chrome profile, open Google Ads and search the <Shot u="https://madshot.net/cb2671aaa4ab.png" l="CID or account name" />. <Shot u="https://madshot.net/c80b088618a2.png" l="Billing" /> → Billing Setup → <Shot u="https://madshot.net/fa53edc72d55.png" l="Select Existing Billing Setup" />. M# accounts: pick the <Shot u="https://madshot.net/2a1bb0f86757.png" l="Master Invoice" /> with the most accounts. C#/Canadian: the Canada Master Client Invoice. <Shot u="https://madshot.net/80c162a864ff.png" l="Save and continue" />, then paste <Lit v={`${M} - ${bizName}`} /> into the <Shot u="https://madshot.net/dd594561a6dd.png" l="Purchase order (optional)" /> field → save and finish. "Pending Approval"? Refresh.
          </> },
          { id: "verify", title: "Advertiser verification (new UI)", body: <>
            Admin → Policy → <Shot u="https://madshot.net/83c0fbc779de.png" l="Account" />. EU political ads task → <Shot u="https://madshot.net/f0ef1d90fe5c.png" l="No, I don't plan to run EU political ads" /> → Submit Answer. Organization task: legal name <Lit v="Madwire LLC" />; "Yes, Madwire, LLC manages Google Ads accounts for other organizations" → <Shot u="https://madshot.net/dee8fadb1de2.png" l="Submit" />.
            <div style={{ marginTop: 6, fontSize: 12.5, color: T.muted }}>Old UI instead? Billing → <Shot u="https://madshot.net/3000f4c4b09a.png" l="Advertiser Verification" />: Task 1 <Shot u="https://madshot.net/7581e4469335.png" l="who pays" /> = Madwire LLC; Task 2 <Shot u="https://madshot.net/8f6a4164a9e7.png" l="about your org" /> = Yes agency / verify My agency. Then <Shot u="https://madshot.net/18ad08eacede.png" l="close settings" /> and refresh to see <Shot u="https://madshot.net/6aa2060ef864.png" l="your new account" />.</div>
            Also paste the <Shot u="https://madshot.net/0488156ec173.png" l="Ad Customer ID" /> into Zoho and Adpausing for later.
          </> },
          { id: "linkga", title: "Link GA4 to Google Ads", body: <>
            {isEcom ? "Switch from your @madwire account to the master account for the rest of these steps. " : ""}Tools → Data Manager → <Shot u="https://madshot.net/2282c9ab510c.png" l="Google Analytics" /> → find <Shot u="https://madshot.net/23714bf1874e.png" l="the GA4 account you just made" /> → next → confirm both <Shot u="https://madshot.net/2039855cabcf.png" l="data sharing settings on" /> → Link → Done.
          </> },
          { id: "remarket", title: "Remarketing audiences + Conversion ID", body: <>
            {isEcom && <><b>Classic UI:</b> Tools → Shared Library → <Shot u="https://madshot.net/af9833c278ec.png" l="Audience Manager › Your Data Sources" /> → Google Ads tag → <Shot u="https://madshot.net/7c909bb9fee8.png" l="Set up tag" />. Ecommerce: "Collect data on specific actions…" + <Shot u="https://madshot.net/edc64011f19c.png" l="Retail" />; Lead Gen: "Only collect general website visit data" <Shot u="https://madshot.net/dcbd7bdac81f.png" l="example" />. Check restricted data processing → Save → Use Google Tag Manager → <Shot u="https://madshot.net/0bfb5fd9ba03.png" l="copy the conversion ID" />.<br /><br /></>}
            <b>New UI (6/16/2025):</b> if <Shot u="https://madshot.net/9de1c02c7200.png" l="this appears" /> in Your data source, you're in the newest UI. Data Manager → 3 dots next to your Google Tag → <Shot u="https://madshot.net/6eed2db651b7.png" l="Manage" /> → <Shot u="https://madshot.net/448570d86019.png" l="Installation instructions" /> → <Shot u="https://madshot.net/f324f999d1a5.png" l="Install manually" /> → copy the part after AW- <Shot u="https://madshot.net/22cc6aa31f27.png" l="here" /> — that's your Conversion ID. Then exit and open <Shot u="https://madshot.net/7eff17e792c6.png" l="Consent settings" /> → Restricted data processing → <Shot u="https://madshot.net/56be590e2248.png" l="check the box" />.
            <CodeField k="convId" />
          </> },
          ...goalSteps,
          { id: "newset", title: "New settings + auto-apply recommendations", body: <>
            Goals → Settings → set the Call Conversion Action to your Calls From Ads goal <Shot u="https://madshot.net/445b7adef0da.png" l="example" />. Settings → Account Settings → Customer Match: check <b>Smart Bidding</b> and <b>Conversion Tags</b> <Shot u="https://madshot.net/57f3e0acdfb7.png" l="example" />. Then <Shot u="https://madshot.net/529bb858c082.png" l="Campaigns › Recommendations" /> → <Shot u="https://madshot.net/7de0ac242e7b.png" l="Auto-apply" /> → check these <Shot u="https://madshot.net/32b13deaa07e.png" l="boxes" />: optimized ad rotation, remove redundant / non-serving / conflicting negative keywords, upgrade conversion tracking → Save.
          </> },
          { id: "awlink", title: "Connect the AW tag back in GA4", body: <>
            In GA4: Property Settings → Data collection and modification → Data Streams → click the URL stream → <Shot u="https://madshot.net/dbe90a36f54a.png" l="Manage connected site tags" /> → add <Lit v={`AW-${(codes.convId || "").replace(/^AW-?/i, "") || "#########"}`} /> <Shot u="https://madshot.net/f5a26f3e2468.png" l="here" />. The same ID works as the connection's nickname.
          </> },
        ],
      });
    }

    /* ---------- GTM ---------- */
    const gtmVarSteps = <>
      <b>All accounts:</b> <Shot u="https://madshot.net/340ed16f2600.png" l="GA4" /> → your Measurement ID{codes.ga4measure ? <> (<Lit v={codes.ga4measure} />)</> : ""} and add it to the title. <Shot u="https://madshot.net/ade26562a5e5.png" l="Phone Number" /> → your CTC Ads number{cfg.c2c !== "yes" ? " (or the site's phone number)" : ""} in <Lit v="(###) ###-####" /> format.
      {cfg.ads && <><br /><br /><b>With Google Ads:</b> <Shot u="https://madshot.net/82c0fa9734dd.png" l="Conversion ID" />{cfg.leads !== false ? <>, <Shot u="https://madshot.net/64e6b976cf8b.png" l="Conversion Label" /> (lead)</> : null}{cfg.c2c !== "none" ? <>, <Shot u="https://madshot.net/a4577821faa0.png" l="Call Conversion Label" />, <Shot u="https://madshot.net/ff2f75ee650b.png" l="Conversion Label - Mobile Call Click" /></> : null}.</>}
      {cfg.ads && isEcom && <><br /><br /><b>Ecommerce with Google Ads:</b> <Shot u="https://madshot.net/6aead47fb872.png" l="Order Conversion Label" /> → Purchase label, <Shot u="https://madshot.net/3dcdc9ba2bc2.png" l="Conversion Label - Add To Cart" />, Conversion Label - Initiate Checkout → Begin Checkout label, Conversion Label - View Content → View Item label.</>}
    </>;

    secs.push({
      id: "gtm", title: "Google Tag Manager (GTM)",
      steps: [
        { id: "gtm1", title: "Create the container under your @madwire email", body: <>
          GTM is the one account created under your <b>@madwire</b> email first, then shared to the master at the end. Open <L href="https://tagmanager.google.com/">tagmanager.google.com</L> → <Shot u="https://madshot.net/4b197cbbe950.png" l="Create Account" />. <Shot u="https://madshot.net/bc49135517f8.png" l="Account Name" />: <Lit v={`${M} - ${bizName}`} />. <Shot u="https://madshot.net/b04a4710c13e.png" l="Container Name" />: the site URL (no https). Platform: <Shot u="https://madshot.net/9fbc025cfe2e.png" l="Web" /> → Create → accept the agreement. The <Shot u="https://madshot.net/77f413aa5516.png" l="code snippets popup" /> appears — copy the <Shot u="https://madshot.net/fa9237ad1efb.png" l="GTM Tag ID" /> to <Shot u="https://madshot.net/1a4ab91db715.png" l="Zoho" /> and close.
          <CodeField k="gtm" />
        </> },
        { id: "gtm2", title: "Import the right template container", body: <>
          Reload GTM in a new tab to open the <Shot u="https://madshot.net/2354eddbd9bb.png" l="Automation GTM Templates" /> account, then export the container that matches this build and import it into the client's container.
          <PlatformNote platform={platName}>
            Container to export: <Lit v={plat.container(cfg)} />.
            {isWP && <> Woo360 with MadForms can also use <Shot u="https://madshot.net/8399934e307a.png" l="Websites 360 - Lead Gen" />; without MadForms fall back to <Shot u="https://madshot.net/c7aa8a2c90e1.png" l="Basic Lead Gen" />.</>}
            {cfg.buildType === "shopify" && <> If the MSM wants CTCs, also create a second web container named <b>Theme Liquid</b> under the same account and import the Shopify Theme Liquid container for call tracking.</>}
          </PlatformNote>
          <Shot u="https://madshot.net/74cddbfce341.png" l="Admin › Export Container" /> → <Shot u="https://madshot.net/249a1288d84b.png" l="Default Container" /> → <Shot u="https://madshot.net/4af1151f0346.png" l="Export" />. Back in the client's container: <Shot u="https://madshot.net/7149259a2f9c.png" l="Admin › Import Container" /> → choose the JSON → Existing workspace → Default Workspace → <b>Overwrite</b> → <Shot u="https://madshot.net/fdd5b6e3e921.png" l="Add to Workspace" />.
          {isCustom && isEcom && <Warn>Ecommerce triggers (purchase, add to cart, checkout, view item) are platform-specific — set them up per the platform build docs, and keep conversion tags firing once per page with any edits.</Warn>}
        </> },
        { id: "gtm3", title: "Replace the User-Defined Variables", body: <>
          <Shot u="https://madshot.net/6d49bfecf2d0.png" l="Variables tab" /> → <Shot u="https://madshot.net/9b644f19b5a8.png" l="User-Defined Variables" />. Your Code Vault (right panel) has everything you've captured so far — swap the defaults:
          <div style={{ margin: "6px 0" }}>{gtmVarSteps}</div>
          Then review <Shot u="https://madshot.net/d174405979cf.png" l="Tags" /> and confirm the <Shot u="https://madshot.net/6a801f5e1c5b.png" l="proper ones are on" />.
          {!cfg.ads && <Warn>No Google Ads: <Shot u="https://madshot.net/29378fb90b1d.png" l="pause the Google Ads Conversion Tracking tags" /> under <Shot u="https://madshot.net/88cfbd2c9a74.png" l="Tags" /> — everything named Google Ads <Shot u="https://madshot.net/ea06b06459f0.png" l="example" />.</Warn>}
          {cfg.c2c === "none" && <Warn>No C2C and no phone on site: skip the phone number variable and pause call-related tags (GA4 Call Click, Dynamic Call Tracking, Mobile Call Click).</Warn>}
        </> },
        { id: "gtm4", title: "Share with the master account, remove yourself", body: <>
          Admin → User Management (account column) → <Shot u="https://madshot.net/2c0d94d07a2e.png" l="blue plus" /> → add {cfg.ads && client.adSpecEmail ? <>the Ad Specialist <Lit v={client.adSpecEmail} /></> : "the Ad Specialist"} and the <b>Master Account</b> email{codes.master ? <> <Lit v={codes.master} /></> : null} with <Shot u="https://madshot.net/864136865a32.png" l="Admin and Publish access" />. (Can't add someone? Skip + note it.) Log into GTM as the master, <Shot u="https://madshot.net/0a514e4ed8c8.png" l="accept the invitation" />, <Shot u="https://madshot.net/e8a9b9119faa.png" l="find the account" />, and <Shot u="https://madshot.net/bc479e2230aa.png" l="remove your @madwire email" /> to keep your account clear.
        </> },
        { id: "gtm5", title: cfg.clientPlacing ? "Hand tracking codes to the client" : "Place the codes on the website", body: cfg.clientPlacing ? <>
          The client is placing codes themselves. Comment in your build task <Shot u="https://madshot.net/ea3436bcdce4.png" l="example" /> with: (1) the Meta Tag + GTM Header Tag placed as close to the opening <Lit v="<head>" /> as possible, (2) the GTM Footer Tag above the closing <Lit v="</body>" />, (3) the BCC email for form notifications if applicable, and a note that once codes are placed the task should be set to Complete and a <b>finish tracking build</b> task submitted to the queue. Then add your comments with an MSM tag, log time, and set the task to <b>Completed DNF</b>.
        </> : isWP ? <>
          Codes are placed with the <b>Header and Footer Scripts</b> plugin (Settings → <Shot u="https://madshot.net/9f7bc94ed317.png" l="Header and Footer Scripts" />; Woo360 sites should have it already). Missing? Plugins → <Shot u="https://madshot.net/eee52a75818f.png" l="Add New Plugin" /> → search <L href="https://wordpress.org/plugins/header-and-footer-scripts/">Header and Footer Scripts</L> → Install → Activate. Place the GTM Head snippet + Search Console meta in the header box, the GTM Body snippet in the footer box. <L href="https://drive.google.com/drive/folders/19xRIJlxP3HmTFSv3mvlAs6VL9DxHQNyP?dmr=1&ec=wgc-drive-hero-goto">Code placement walkthrough video</L> (ignore FB/GTM-plugin steps).
          <Warn>Logins too low to install plugins? Note it for the MSM in the todo comments and the MO note with your todo link — codes not placed. MSM submits a PAS todo once correct logins arrive.</Warn>
        </> : isCustom ? <>
          {plat.gaAccess && <PlatformNote platform={platName}>Add <Lit v={plat.gaAccess} /> to the client's Google Analytics before starting.</PlatformNote>}
          <PlatformNote platform={platName}>{plat.placement}</PlatformNote>
          {plat.warn && <Warn>{plat.warn}</Warn>}
          {plat.ecomInstall && isEcom && <div style={{ margin: "6px 0" }}>{plat.ecomInstall}</div>}
          Follow this platform's page in the <L href="https://missioncontrol.madwire.com/category/platform-analytics-specialist/builds-platform-analytics-specialist/#">PAS build documentation</L> for the exact clicks. In your GTM workspace, click the <Shot u="https://madshot.net/fee180ff153a.png" l="GTM Tag ID in the top bar" /> to grab the head and body snippets.{isEcom && cfg.buildType === "shopify" ? <> Shopify pulls ecommerce events through the Custom Pixel Code — no Shop App codes needed unless it's a Shop App build.</> : null}
          <Warn>If our logins can't reach the theme/code area, note it for the MSM in your todo comments and the MO note — codes not placed — and the MSM submits a PAS todo once access arrives.</Warn>
        </> : <>
          In your GTM workspace, click the <Shot u="https://madshot.net/fee180ff153a.png" l="GTM Tag ID in the top bar" /> to open the snippets popup. <b>Head snippet</b> <Shot u="https://madshot.net/a6ff9585206d.png" l="the head code" /> goes under <Shot u="https://madshot.net/e23740419bc4.png" l="Developer › Head JS" /> — <b>remove the comments and the &lt;script&gt; tags</b>; it should <Shot u="https://madshot.net/e23740419bc4.png" l="look like this" />. Save. <b>Body snippet</b> <Shot u="https://madshot.net/0031d18545e1.png" l="the body code" /> goes in the site Footer via an HTML widget, <Shot u="https://madshot.net/b557c686e3a9.png" l="pasted as-is" />. Save and Publish the site.{isEcom ? <> Shop App also needs codes in the Shop App and website plus extra settings — see <L href="https://missioncontrol.madwire.com/platform-analytics-specialist/pas-shopapp-build-documentation-master/">Shop App docs</L>.</> : null}
        </> },
        ...(!cfg.clientPlacing ? [{ id: "gtm6", title: "Preview, test the funnel, publish", body: <>
          In GTM click <Shot u="https://madshot.net/3355d9821d61.png" l="Preview" />, paste your <Shot u="https://madshot.net/3ed63237bfe3.png" l="website URL" />, Connect. <Shot u="https://madshot.net/776d076cbbf6.png" l="Tag Assistant" /> opens on the site and you'll see your <Shot u="https://madshot.net/b821afe97679.png" l="active tags" />. Send a <Shot u="https://madshot.net/3f03a407db8c.png" l="test form submission" /> and confirm in the summary: <Shot u="https://madshot.net/8b01a57036be.png" l="Link Click" />, <Shot u="https://madshot.net/f2810d361bad.png" l="Container Loaded" />, {(!isCustom && (!isWP || cfg.madforms)) ? <Shot u="https://madshot.net/7dff2d748342.png" l="madform_submit" /> : <>your form-submission trigger</>}{isEcom ? <> — and for purchases, run a test checkout to confirm the ecommerce tags fire</> : null}{cfg.ads ? <>, and <Shot u="https://madshot.net/9cf0f6e93920.png" l="Google Lead Conversion" /> with the <Shot u="https://madshot.net/98478dea163b.png" l="value and ID" /> and <Shot u="https://madshot.net/59a9e30cb4bc.png" l="values" /> pulling in</> : null}. Then <Shot u="https://madshot.net/b5333a3364f7.png" l="Submit" /> and <Shot u="https://madshot.net/fb46c8a8898a.png" l="Publish" />, named <Shot u="https://madshot.net/2eb7bee4e9ad.png" l="Initial Build" />.
          {cfg.ads && <div style={{ marginTop: 6 }}><b>Update Google Ads:</b> Settings → Enhanced Conversions → set to <Shot u="https://madshot.net/db2f069299b6.png" l="Google Tag Manager" /> → Save.</div>}
          {isWP && <div style={{ marginTop: 6, fontSize: 12.5, color: T.muted }}>Tags not firing on a WP form? See the "Iframe forms & trigger fixes" special case below before completing the build.</div>}
        </> }] : []),
        ...(isWP && !cfg.madforms ? [{ id: "gtmbcc", title: "Add the BCC email to form notifications", body: <>
          Non-MadForms sites need a BCC so submissions pull into Marketing 360. Marketing 360 → search the M# → Intelligence → Settings → Connect Sales and Leads → <Shot u="https://madshot.net/d82edc84676d.png" l="copy the email address" /> (looks like marketing360+…@bcc.mad360.net).
          <CodeField k="bcc" />
          <div style={{ marginTop: 4 }}>
            <b>Gravity Forms:</b> Forms → hover <Shot u="https://madshot.net/9f5bc74d8980.png" l="Settings" /> → <Shot u="https://madshot.net/e9e98fbc8eb7.png" l="Edit" /> Admin Notifications → add MSM + BCC in the BCC field (<Shot u="https://madshot.net/e174d8201132.png" l="commas for multiple" />) → <Shot u="https://madshot.net/459af6579747.png" l="Update Notification" />. Repeat per form.<br />
            <b>Contact Form 7:</b> Contact → <Shot u="https://madshot.net/d6d0fd345fcd.png" l="Edit" /> → Mail → Additional Headers → <Shot u="https://madshot.net/1c84d8c2852c.png" l="add Bcc: prefix" /> e.g. <Lit v="Bcc:marketing360+...@bcc.mad360.net" /> → <Shot u="https://madshot.net/25d414160fdc.png" l="Save" />.<br />
            <b>iFrame forms:</b> we need logins to the third-party form to add the email — no logins in the todo? Note it for MSM/PAS and request a follow-up todo. <b>Builder-native forms</b> (Elementor, Divi, WP Bakery): open the builder per page and add the notification email there. Anything unique (no email option, etc.): note it for the MSM and continue the build.
          </div>
        </> }] : []),
      ],
    });

    /* ---------- SEARCH CONSOLE ---------- */
    secs.push({
      id: "sc", title: "Google Search Console",
      steps: cfg.subdomain ? [
        { id: "scd1", title: "Add a Domain property (subdomain build)", body: <>
          CMPro subdomain tracking verifies via the <b>Domain</b> method so one property covers root + all subdomains. In <L href="https://search.google.com/search-console">Search Console</L> (master account): domain dropdown → <Shot u="https://madshot.net/133b87af757d.png" l="+ Add Property" /> → choose <b>Domain</b> (NOT URL prefix) → enter the root domain (no http/https/www).
        </> },
        { id: "scd2", title: "Verify via DNS TXT record", body: <>
          Copy the TXT record Google provides (choose TXT / Any DNS Provider), add it to the client's DNS wherever the domain is managed, then click Verify.
          <CodeField k="scMeta" />
          <CodeField k="scDomain" />
        </> },
        { id: "scd3", title: "Sitemaps for root AND subdomain", body: <>
          Submit both: <Lit v={`${client.url || "domain.com"}/sitemap.xml`} /> and the subdomain's, e.g. <Lit v="subdomain.domain.com/sitemap.xml" />.
        </> },
        { id: "scd4", title: "Permissions + GTM on the subdomain", body: <>
          Settings → Users and permissions → add{msmChip}{adSpecChip} with full permissions. For GTM, reuse the <b>same</b> container: paste the Head code in the subdomain site's Developer → Head JS (comments and &lt;script&gt; tags removed) and the Body code in its footer HTML widget, then Save and Publish.
        </> },
        { id: "scd5", title: "Connect to Marketing 360 (special format)", body: <>
          On the client's Setup page, the Search Console URL field must use exactly <Lit v={`sc-domain:${(client.url || "domain.com").replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/.*$/, "")}`} /> plus the master account email. Save.
        </> },
      ] : [
        { id: "sc1", title: "Add the property (URL prefix)", body: <>
          Open <L href="https://search.google.com/search-console">Search Console</L> as the master account. Top-left domain dropdown → <Shot u="https://madshot.net/133b87af757d.png" l="+ Add Property" /> → <Shot u="https://madshot.net/da6317558a4e.png" l="URL prefix" /> → enter the URL <b>exactly</b> as it loads in a browser.
          <CodeField k="scDomain" />
        </> },
        { id: "sc2", title: "Verify with the HTML meta tag", body: <>
          Choose HTML tag verification and <Shot u="https://madshot.net/dde66806f54a.png" l="copy the meta tag" />. In Marketing 360 → Websites → Settings → SEO → paste under Google Site Verification Code (it reformats to <Shot u="https://madshot.net/ff1a294f79f0.png" l="look like this" />).{cfg.buildType === "w360" ? <> Ensure <Shot u="https://madshot.net/d50307c864fb.png" l="Allow search engines to index the website" /> is toggled on.</> : null} Publish, then click <Shot u="https://madshot.net/374d90cf4e9c.png" l="Verify" /> back in Search Console. Paste the whole meta code below (and in <Shot u="https://madshot.net/ebb5e89f354d.png" l="Zoho" />).
          {isWP && <div style={{ marginTop: 4, fontSize: 12.5, color: T.muted }}>WordPress: this meta tag goes in the Header and Footer Scripts header box alongside the GTM head snippet.</div>}
          <CodeField k="scMeta" />
        </> },
        { id: "sc3", title: "Submit the sitemap", body: <>
          {plat.sitemap && <PlatformNote platform={platName}>Submit <Lit v={plat.sitemap} /> for this build.</PlatformNote>}
          Sitemaps tab → <Shot u="https://madshot.net/f0f08edf5b6b.png" l="submit the right sitemap" />. Reference by platform: Websites 360 <Lit v="sitemap.xml" /> · Woo360/WooComm/WP <Lit v="sitemap_index.xml" /> · BigCommerce <Lit v="xmlsitemap.php" /> · Shopify <Lit v="sitemap.xml" /> · Volusion <Lit v="sitemap.xml" /> · Wix <Lit v="sitemap.xml" /> · Webflow <Lit v="sitemap.xml" /> (toggle sitemap on in Webflow <Shot u="https://madshot.net/7fba6c248dd1.png" l="settings" />). Status should show <Shot u="https://madshot.net/e3c349fac266.png" l="Success" />.
        </> },
        { id: "sc4", title: "Users + GA4 association", body: <>
          Settings → <Shot u="https://madshot.net/658d4bc3e3c0.png" l="Users and permissions" /> → add{msmChip}{adSpecChip} with full permissions (skip + note if blocked). Settings → <Shot u="https://madshot.net/4d5d8a3e882f.png" l="Associations" /> → <Shot u="https://madshot.net/87aaffd89ecb.png" l="associate" /> → Ctrl+F your M# to find the GA4 account → radio button → continue → <Shot u="https://madshot.net/1958ada54966.png" l="associate" />.
        </> },
        ...(cfg.ads ? [{ id: "sc5", title: "Link Search Console in Google Ads", body: <>
          In Google Ads: Tools → Data Manager → Featured Products → <Shot u="https://madshot.net/09f995181a45.png" l="Search Console" /> → select it → Ctrl+F your site URL → <Shot u="https://madshot.net/18b6dbe40210.png" l="link" />. Once linked it <Shot u="https://madshot.net/33bf73715ed2.png" l="populates at the top" />.
        </> }] : []),
      ],
    });

    /* ---------- MERCHANT CENTER ---------- */
    if (cfg.merchant) {
      secs.push({
        id: "mc", title: "Google Merchant Center",
        steps: [
          { id: "mc1", title: "Create the account under Madwire Media", body: <>
            Ecommerce accounts selling products only — you'll have a separate "Merchant Center Setup" task. Video refs at 53:00 and 1:14 in the <L href="https://drive.google.com/drive/folders/19xRIJlxP3HmTFSv3mvlAs6VL9DxHQNyP?dmr=1&ec=wgc-drive-hero-goto">WooCommerce walkthrough</L>. Open <L href="https://merchants.google.com/mc/mcadiagnostics">Merchant Center</L> in the master profile → <Shot u="https://madshot.net/0dc608eaea42.png" l="Accounts › Add Account" /> under <Shot u="https://madshot.net/d15575856b29.png" l="Madwire Media" />. The <Shot u="https://madshot.net/17e3f534a9db.png" l="store name" /> must match the on-site branding — <b>no M# here</b> (it can differ from the MO name). Only check the adult-content <Shot u="https://madshot.net/e42c012d1bd1.png" l="box" /> if applicable. Add the full URL including https:// and trailing / → Save → <Shot u="https://madshot.net/87326926dfc6.png" l="search for the account" /> → copy your <Shot u="https://madshot.net/48915b584bee.png" l="Merchant Center ID" />.
            <CodeField k="merchantId" />
          </> },
          { id: "mc2", title: "Business information + claim the store", body: <>
            <Shot u="https://madshot.net/32490ea48a7e.png" l="Business Information" /> in the sidebar — pull everything from the <b>website</b>, not the todo. Under Your Online Store: <Shot u="https://madshot.net/8c1ce68ed95e.png" l="Claim Online Store" /> → Claim Store → both <Shot u="https://madshot.net/2ae0065cbecf.png" l="checks green" />. <Shot u="https://madshot.net/4c5021f333a8.png" l="Edit business details" />: <Shot u="https://madshot.net/7d5a683f7068.png" l="Business Name (no M#)" /> + address, <b>no phone number</b>. Customer Service: contact-page link, business email if any, preferred contact = Website, no phone <Shot u="https://madshot.net/7f11d48608e4.png" l="example" />. Save.
          </> },
          { id: "mc3", title: "Sales tax + time zone", body: <>
            <Shot u="https://madshot.net/dcec53e74347.png" l="Sales Tax › Edit" /> → "Specify my own settings" + "Automatic based on location" → save <Shot u="https://madshot.net/eb8ae1c635af.png" l="example" />. Gear → <Shot u="https://madshot.net/176a9fd872d0.png" l="General Account Options" /> → <Shot u="https://madshot.net/e8044f2cde40.png" l="time zone" /> → exit via the <Shot u="https://madshot.net/59bde7c9c8f0.png" l="X" />.
          </> },
          { id: "mc4", title: "Returns + shipping", body: <>
            <Shot u="https://madshot.net/7af127fc05c7.png" l="Shipping and Returns" /> → <Shot u="https://madshot.net/f12394553d0a.png" l="Return Policies" /> (auto-generates from location). No returns policy on their site? Skip, note it for the MSM, check <Shot u="https://madshot.net/069996aafb4c.png" l="Shop App" /> for shipping. Otherwise <Shot u="https://madshot.net/b737b7945e48.png" l="Next" /> → condition/window <Shot u="https://madshot.net/63b4cc5893f8.png" l="next" /> → update notes from their site → Save.
            <div style={{ marginTop: 6 }}>Shipping Policies: <Shot u="https://madshot.net/27dd26430731.png" l="Get Started" /> → <Shot u="https://madshot.net/855f7e08da65.png" l="Add or remove countries" /> → <Shot u="https://madshot.net/2b74f1e7c97e.png" l="United States" /> (or Canada) → <Shot u="https://madshot.net/e04ab8aa555e.png" l="Continue" /> → keep the <Shot u="https://madshot.net/2664243e57fe.png" l="default shipping name" /> → <Shot u="https://madshot.net/738a4d628973.png" l="continue" /> → All Products <Shot u="https://madshot.net/15884874de76.png" l="continue" />. Ship-from location: reference the site for <Shot u="https://madshot.net/8bf5e9b7679c.png" l="settings" /> — defaults: handling 5 days, fulfilled Mon–Fri, cutoff 2pm. Match their <Shot u="https://madshot.net/0409542e3421.png" l="carrier" /> or default UPS Ground; final <Shot u="https://madshot.net/4372bae0c8f0.png" l="options" /> should mirror the site. You may need a test checkout to see their real shipping.</div>
          </> },
          { id: "mc5", title: "Link to Google Ads + users", body: <>
            <Shot u="https://madshot.net/af10544186a9.png" l="Settings › Apps and Services" />. In Google Ads: <Shot u="https://madshot.net/b6027c145d5d.png" l="Tools › Data Manager" /> → Merchant Center → "Send request to other Merchant Center Account" → paste your <Shot u="https://madshot.net/f0af0eb1087e.png" l="Merchant Center ID" /> → next → submit → Done. Refresh Apps and Services and confirm <Shot u="https://madshot.net/96f78b80c72a.png" l="Google Ads linked" />. Then settings → People and access → <Shot u="https://madshot.net/a1642162d24b.png" l="add person" /> →{msmChip}{adSpecChip} as admins.
          </> },
          { id: "mc6", title: "Connect products (feed)", body: <>
            {plat.feed && <PlatformNote platform={platName}>{plat.feed}</PlatformNote>}
            Your Business → <Shot u="https://madshot.net/4634c9a9a720.png" l="Products" /> (should be empty) → <Shot u="https://madshot.net/6400f775553f.png" l="Add Products" />. See <L href="https://missioncontrol.madwire.com/category/platform-analytics-specialist/builds-platform-analytics-specialist/#">build docs</L> for platform specifics; <L href="https://missioncontrol.madwire.com/platform-analytics-specialist/pas-shopapp-build-documentation-master/">Shop App is unique</L>. Typical flow: keep <Shot u="https://madshot.net/52daa10764d8.png" l="Add products from a file" /> → paste the feed link into the <Shot u="https://madshot.net/6a623d22533b.png" l="file link field" />{cfg.buildType === "w360" ? <> → set <Shot u="https://madshot.net/cc97d7c557d8.png" l="Feed Label" /> to <Lit v="SHOP_APP" /></> : null} → Continue → <Shot u="https://madshot.net/424928789e64.png" l="update" /> to show the product count. Fix what errors you can; flag client-side fixes to the MSM. On <Shot u="https://madshot.net/ef4db447d501.png" l="Data source setup" />: <Shot u="https://madshot.net/6aa82e184491.png" l="country of sale" /> matches your shipping countries, <Shot u="https://madshot.net/8ecbaa817a6f.png" l="language" /> English, source name = <Lit v={`Product feed for ${bizName}`} />, scheduled updates every 24h at ~12:00 AM client time. Saving lands you on <Shot u="https://madshot.net/ed08a9a6c99a.png" l="Feeds" />.
          </> },
          { id: "mc7", title: "Add the Advanced Data Source Management add-on", body: <>
            <Shot u="https://madshot.net/cdfb06b791d1.png" l="gear" /> → Add-ons → search <Shot u="https://madshot.net/2ce2a771a4f1.png" l="Advanced data source management" /> → Add.
          </> },
        ],
      });
    }

    /* ---------- OUTBOUND CLICKS ---------- */
    if (cfg.outbound) {
      secs.push({
        id: "ob", title: "Outbound clicks",
        steps: [
          { id: "ob0", title: "Identify what we're tracking", body: <>
            Outbound clicks = third-party links in CTAs (scheduling, booking, ordering apps). If the todo doesn't name the link, inspect the site's CTAs — there can be more than one (reservations + online ordering, multiple booking calendars). Still unclear? Get clarification from the MSM before building.
          </> },
          { id: "ob1", title: "GTM: enable click variables + build the trigger", body: <>
            <Shot u="https://madshot.net/300236157d72.png" l="Variables › Configure" /> → check everything under <Shot u="https://madshot.net/4f8bdbc1bfc2.png" l="Clicks" /> → close. Then <Shot u="https://madshot.net/299777412aaf.png" l="Triggers › Add New" /> → <Shot u="https://madshot.net/3e268aee35d7.png" l="Click - All Elements" /> → Some Clicks → Click URL <b>contains</b> your target URL — trim it to the root, e.g. <Lit v="https://calendly.com" /> instead of a long parameterized link, and pull the real URL from the button itself (not the todo) in case of redirects. Name it <Shot u="https://madshot.net/56dd374ce884.png" l="Outbound Click - [CTA TYPE]" /> → Save.
          </> },
          { id: "ob2", title: "GTM: GA4 outbound_click tag", body: <>
            <Shot u="https://madshot.net/fc67355339ad.png" l="Tags › New" /> → <Shot u="https://madshot.net/aa085965a452.png" l="Google Analytics › GA4 Event" /> → use your <Shot u="https://madshot.net/0edb56af9994.png" l="GA4 ID variable" /> as the <Shot u="https://madshot.net/b24072d959df.png" l="Measurement ID" />. Event name <Shot u="https://madshot.net/5147f175e5c7.png" l="outbound_click" /> = <Lit v="outbound_click" /> (exact). Advanced → <Shot u="https://madshot.net/293ab7b5a607.png" l="Once Per Page" />. <Shot u="https://madshot.net/0b7fc81036f5.png" l="Triggering" /> = your <Shot u="https://madshot.net/7d825c515734.png" l="outbound trigger" />. Name the tag "GA4 - Outbound Click - [CTA TYPE]" → <Shot u="https://madshot.net/b8e89d2b415e.png" l="save" />. Then in GA4 → <Shot u="https://madshot.net/c6e38defdca6.png" l="Key Events" /> add <Shot u="https://madshot.net/35a2deb87daf.png" l="outbound_click" /> (typed identically) alongside generate_lead.
          </> },
          ...(cfg.ads ? [{ id: "ob3", title: "Google Ads outbound goal + GTM tag", body: <>
            Google Ads → Goals → Summary → <Shot u="https://madshot.net/d65cd6c6a8ff.png" l="Add New" /> → Website → <Shot u="https://madshot.net/bd656858e728.png" l="continue" /> → <Shot u="https://madshot.net/716688db691e.png" l="Outbound Click" /> → <Shot u="https://madshot.net/1e85287c79c1.png" l="Setup" /> → Manual Event → "Outbound Click - [CTA TYPE]". Counting: <b>once per event</b> for purchases (off-site tickets), <b>once per session</b> for leads (booking a consult). <Shot u="https://madshot.net/7e07f5421c3e.png" l="Use Event" /> → Save and Continue → <Shot u="https://madshot.net/e6957df21bd4.png" l="Settings" /> → value none, count one; Primary if it's all we track, Secondary if forms are also tracked. Use Google Tag Manager → copy the <Shot u="https://madshot.net/39fd8e96cf93.png" l="Conversion Label" /> (Zoho row: Type "Google Ads Outbound Click").
            <CodeField k="outboundLabel" />
            <div style={{ marginTop: 6 }}>Back in GTM: <Shot u="https://madshot.net/06e2be43facc.png" l="Variables › Add New" /> → <Shot u="https://madshot.net/29b85aeb54e2.png" l="Variable Configuration" /> → <Shot u="https://madshot.net/e274265b1f7e.png" l="Constant" /> = that label, titled like <Shot u="https://madshot.net/1ad7c6e8ddef.png" l="Outbound Click - Schedule - [LABEL]" />. Then <Shot u="https://madshot.net/5177baadea5d.png" l="Tags › Add New" /> → <Shot u="https://madshot.net/7df197af2b78.png" l="Google Ads Conversion Tracking" /> → same <Shot u="https://madshot.net/7a7e10857708.png" l="Conversion ID" />, label = <Shot u="https://madshot.net/903e7a45ac06.png" l="Outbound Clicks" />, firing <Shot u="https://madshot.net/3416d189eec7.png" l="Once per page" />, trigger = your <Shot u="https://madshot.net/73d05f41136f.png" l="outbound trigger" />, name it <Shot u="https://madshot.net/ba1068a16ad3.png" l="Google Ads - Outbound Clicks" /> → Save.</div>
          </> }] : []),
          { id: "ob4", title: "Test + Facebook tag if applicable", body: <>
            Preview the site and click the link: the GA4 outbound tag fires every time{cfg.ads ? "; the Google Ads outbound tag fires too" : ""}. Not firing? Check the Click <Shot u="https://madshot.net/515237618fe6.png" l="Variable" /> → <Shot u="https://madshot.net/3dfb45e2eafa.png" l="Click URL" /> matches the trigger, or switch the trigger from <Shot u="https://madshot.net/de3538fe1b8b.png" l="Click - All Elements" /> to <Shot u="https://madshot.net/2ba5fb79a5b1.png" l="Click - Just Links" />.
            <div style={{ marginTop: 6 }}><b>Facebook Ads already set up?</b> Tags → <Shot u="https://madshot.net/1cb551ad4f2b.png" l="FB Lead Script" /> → <Shot u="https://madshot.net/1fa8322d22b8.png" l="Triggering" /> → <Shot u="https://madshot.net/2f42be74250c.png" l="plus sign" /> → add your outbound trigger → Save. Custom platforms: mirror any form-tag changes on the <Shot u="https://madshot.net/f84edf18e0a9.png" l="FB Lead Script tag" />. Publish, titled "Outbound Click Addition".</div>
          </> },
        ],
      });
    }

    /* ---------- FINALIZE ---------- */
    secs.push({
      id: "final", title: "Finalize & complete",
      steps: [
        ...(cfg.ads ? [{ id: "fin1", title: "Connect Google Ads to Adpausing", body: <>
          Open <L href="https://adpausing.marketing360.com/">Adpausing</L> → search your M# → Link Account. Copy the Advertising ID <Shot u="https://madshot.net/0488156ec173.png" l="exactly as it is in Google Ads" /> (already in your vault), type = Google Ads → <Shot u="https://madshot.net/74b37e54bed5.png" l="Link Account" />.
        </> }] : []),
        { id: "fin2", title: "Log IDs in Marketing 360", body: <>
          In Marketing 360: account name (top right) → <Shot u="https://madshot.net/36c280ed692f.png" l="View All" /> → search the M# → <Shot u="https://madshot.net/f8111ffb91da.png" l="Setup" />. Fill from your vault: <Shot u="https://madshot.net/66475a481789.png" l="Google Ad Account ID" /> + master email, <Shot u="https://madshot.net/56aa3537d1fd.png" l="Analytics Property ID" /> + master email, <Shot u="https://madshot.net/d45290abb5df.png" l="Search Console URL" /> (EXACTLY as logged in Search Console) + master email{cfg.merchant ? ", Merchant Center ID + master email" : ""}. You should have 6 fields filled before <Shot u="https://madshot.net/fae88a181dc2.png" l="submitting" />.
          {cfg.subdomain && <Warn>Subdomain builds: the Search Console URL must be the <Lit v="sc-domain:domain.com" /> format.</Warn>}
          {isEcom && <div style={{ marginTop: 6 }}><b>Order notifications → Conversions Inbox:</b> add the Order Notification BCC email (Intelligence → Settings → <Shot u="https://madshot.net/62e85e8d0137.png" l="Connect Sales and Leads" />) plus the MSM to the store's order notifications.{plat.orderNotif ? <> {platName}: {plat.orderNotif}</> : <> Placement varies by platform — see the platform build docs.</>}{["squarespace", "wix", "square"].includes(cfg.buildType) || cfg.buildType === "custom" ? <> Some platforms (Squarespace, Wix, Square) can't take a BCC directly — the MSM submits a CRM/Form Additions task to connect orders via Zapier instead.</> : null}</div>}
        </> },
        { id: "fin3", title: "Doublecheck the build", body: <>
          Confirm every code slot in this guide's vault is filled or intentionally n/a, and that every step above is checked. If you made a personal copy of the <L href="https://docs.google.com/spreadsheets/d/1Cle3EyNsV3EZgoWYDRxP_-DTqmYfkuvOFjyg1kN62d0/edit?gid=0#gid=0">Build Checklist</L>, run it now and tick off what's done.
        </> },
        { id: "fin4", title: "Comment, log time, set statuses", body: <>
          Comment in the task (a ready-made template with your codes is on the Export screen). Log time <b>separately per task</b> in the project — split overlap between tracking build{cfg.merchant ? ", merchant center setup," : ""} and Google Ads tracking as accurately as you can. Statuses: Initial Tracking Build → <Lit v="Complete DNF" />{cfg.ads ? <>, Google Ads Tracking → <Lit v="Complete" /></> : null}{cfg.merchant ? <>, Merchant Center Setup → <Lit v="Complete" /></> : null}. Assigned the Google Ad Campaign task too? Continue with that process next.
          {!cfg.ads && <div style={{ marginTop: 6, fontSize: 12.5, color: T.muted }}>No ad spend: assign the todo to the MSM instead of the Ad Specialist queue. You shouldn't have a Google Ads Tracking task — if you do, comment and cancel it.</div>}
        </> },
      ],
    });

    return secs;
  }, [cfg, client, codes.ga4measure, codes.convId, codes.master]);

  const allSteps = sections.flatMap(s => s.steps.filter(st => !st.optional).map(st => st.id));
  const doneCount = allSteps.filter(id => checks[id]).length;

  /* ---------------------------------------------------------------- */
  /*  Export text                                                     */
  /* ---------------------------------------------------------------- */
  const exportText = useMemo(() => {
    const lines = [
      `TRACKING BUILD — ${M} - ${bizName}`,
      `Site: ${client.url || "—"}`,
      `MSM: ${client.msmEmail || "—"}${cfg.ads ? `   ·   Ad Specialist: ${client.adSpecEmail || "—"}` : ""}`,
      `Build: ${({ w360: "Websites 360", wp: "WordPress / Woo360", shopify: "Shopify", bigcommerce: "BigCommerce", volusion: "Volusion", custom: "Custom platform" })[cfg.buildType] || "—"} · ${cfg.ecom ? (cfg.leads !== false ? "Leads + Ecommerce" : "Ecommerce") : "Lead Gen"}${cfg.ads ? " · Google Ads" : " · No ad spend"}${cfg.c2c === "yes" ? " · C2Cs" : cfg.c2c === "site" ? " · site number (no C2C)" : " · no call tracking"}${cfg.merchant ? " · Merchant Center" : ""}${cfg.outbound ? " · Outbound clicks" : ""}${cfg.subdomain ? " · Subdomain (sc-domain)" : ""}`,
      "-".repeat(46),
      ...fields.map(f => `${f.zoho}: ${(codes[f.k] || "").trim() || "(not captured)"}`),
    ];
    return lines.join("\n");
  }, [fields, codes, client, cfg, M, bizName]);

  const commentText = `Hey @${client.msmEmail || "[MSM]"}, this Initial Build is complete\n\n${cfg.ads
    ? "We are building ads, so please double check the tracking build and the ad campaigns once the Google Ad Campaign task has been set to \u201CComplete DNF\u201D."
    : "We are not building ads, so please double check the tracking build."}\n\n[Add pertinent notes]\n\nThanks, let me know if you have any questions!`;

  /* ---------------------------------------------------------------- */
  /*  Special cases reference                                         */
  /* ---------------------------------------------------------------- */
  const specials = [
    { t: "Squarespace specifics", b: <>{PLATFORM_EXTRA.squarespace}</> },
    { t: "Wix specifics", b: <>{PLATFORM_EXTRA.wix}</> },
    { t: "Square / Weebly specifics", b: <>{PLATFORM_EXTRA.square}</> },
    { t: "No Google Ad Spend", b: <>Skip: Google Ads account, Adpausing link, the GTM ads variables (Conversion ID/labels, Phone Number for calls), and the Marketing 360 Ads connection. You shouldn't have a Google Ads Tracking task — comment + cancel if you do. In GTM, <Shot u="https://madshot.net/88cfbd2c9a74.png" l="Tags" /> → pause everything named Google Ads <Shot u="https://madshot.net/ea06b06459f0.png" l="example" />. Assign the todo to the MSM instead of the Ad Specialist queue. <i>Tip: turn off the "Google Ads budget" toggle in Setup and this guide removes those steps for you.</i></> },
    { t: "No C2C Setup", b: <><b>MSM says no C2Cs but the site has a phone number:</b> use the site's ring-to number wherever the Ads tracking number is called for. <b>No C2C and no phone at all:</b> skip all call goals in Google Ads and the phone variable in GTM, and pause the call tags (GA4 Call Click, Dynamic Call Tracking, Mobile Call Click). <i>The "Call tracking" setting in Setup handles both.</i></> },
    { t: "Alternate Google Ads UI", b: <>Full alternate flow with screenshots: <Shot u="https://madshot.net/6939edc61230.png" l="Goals › New Conversion Action" /> → also check <Shot u="https://madshot.net/20782665a6d4.png" l="phone call conversions" /> → Continue → See All → <Shot u="https://madshot.net/819c5c04308a.png" l="Submit lead form" /> → Set Up → <Shot u="https://madshot.net/0509e84a3851.png" l="create a manual event" /> named "New Web Lead M#####" → Use event → Settings: Primary, <Shot u="https://madshot.net/18871bf41ae7.png" l="no value" />, <Shot u="https://madshot.net/d318108d5fa9.png" l="count one" /> → Done → copy the <Shot u="https://madshot.net/a7500afbd786.png" l="Lead Conversion Label" />. Calls From Ads and Dynamic Call follow the same pattern (paste <Shot u="https://madshot.net/cd0a4c3148cb.png" l="CTC-Ads into both boxes" />); Mobile Call Click via <Shot u="https://madshot.net/105a829e00fe.png" l="Add an event to this category" /> as Secondary. Labels via See event snippet — first number is the <Shot u="https://madshot.net/9a6bbc707e10.png" l="Conversion ID" />, second is the label; or per action via <Shot u="https://madshot.net/51f00b361b4c.png" l="Tag Setup" /> → GTM → <Shot u="https://madshot.net/01cb7054c229.png" l="ID + label" />, mobile label <Shot u="https://madshot.net/e23d20a6b6ec.png" l="here" />.</> },
    { t: "Old Google Ads UI", b: <>Website → <Shot u="https://madshot.net/8a2751dc3e0d.png" l="URL + Scan" /> → <Shot u="https://madshot.net/451486779f24.png" l="cancel" /> → <Shot u="https://madshot.net/0b7277e3ef08.png" l="add manually" />: "New Web Lead M#####", Submit lead form, no value, count one → <Shot u="https://madshot.net/a7500afbd786.png" l="copy label" />. Phone calls → "Calls from ads using call extensions" <Shot u="https://madshot.net/452e3cd51f41.png" l="Continue" /> → "Calls From Ads M#####", <Shot u="https://madshot.net/7800b3097253.png" l="no value" />, count one → <Shot u="https://madshot.net/b2b15e25b00f.png" l="Save and Continue" />. "Calls to a phone number on your website" <Shot u="https://madshot.net/1242a90aaed3.png" l="Next" /> → "Dynamic Call Conversion M#####", <Shot u="https://madshot.net/bd95a97943cd.png" l="no value" />, count one, <Shot u="https://madshot.net/24c24939d172.png" l="CTC Ads number" /> in <Shot u="https://madshot.net/e5792bb69c4b.png" l="both fields" /> → GTM → copy the <Shot u="https://madshot.net/79bdac86e247.png" l="Dynamic Call label" />. Mobile clicks: "Clicks on your number on your mobile website" <Shot u="https://madshot.net/090a344fb972.png" l="next" /> (new UI location <Shot u="https://madshot.net/33ef674ea057.png" l="here" />), <Shot u="https://madshot.net/9709d7176db6.png" l="no value" />, <Shot u="https://madshot.net/1556b2fa321c.png" l="count one" /> → copy the <Shot u="https://madshot.net/e23d20a6b6ec.png" l="mobile label" /> and set it to <Shot u="https://madshot.net/dcfad7c29323.png" l="Secondary" />.</> },
    { t: "Unique phone number formatting", b: <>If site numbers aren't in <Lit v="(###) ###-####" /> the "Other" tracking number won't swap. Edit the <Shot u="https://madshot.net/a68ebe3ebe30.png" l="CTC Script tag" /> (the <Shot u="https://madshot.net/15d5c02ebe6b.png" l="default script" />): duplicate <Shot u="https://madshot.net/ff26270cdc91.png" l="line 10 onto line 11" /> and match the site's format — prefix with x where there's no leading 1; +1 works too <Shot u="https://madshot.net/8a0f19a7ee5a.png" l="examples" />. Display format is editable <Shot u="https://madshot.net/26f214b1dc3f.png" l="here" />. Test with the inspect tool or by appending <Lit v="?utm_medium=cpc" /> or <Lit v="#google-wcc-force" /> to the URL.</> },
    { t: "Unique MadForms (Websites 360)", b: <>Unique MadForms are covered by tags on the <Shot u="https://madshot.net/f917e5038746.png" l="madform_submit trigger" /> automatically — except <b>Give Feedback</b> and <b>Subscribe for Updates</b>, which are excluded. To track them, open <Shot u="https://madshot.net/f70801bba2e2.png" l="madform_submit" /> in Triggers and remove the title(s) from <Shot u="https://madshot.net/28a6df99dc16.png" l="excludes" />. To exclude another form (e.g. Apply), add its name as <Lit v="FORM NAME|FORM NAME" /> <Shot u="https://madshot.net/33c315b79006.png" l="example" />. Third-party forms on Websites 360 shouldn't happen — chat the room if you see one requested.</> },
    { t: "Iframe forms & trigger fixes (WP)", b: <>The Basic Lead Gen template's <Shot u="https://madshot.net/a34528ef44f3.png" l="Form Submission trigger" /> works for most WP forms. If not, keep conversion tags at <Shot u="https://madshot.net/cc73b79f7992.png" l="once per page" /> with any edits, and if you edit <Shot u="https://madshot.net/74c305e20cb5.png" l="GA4 Lead Event" /> check whether <Shot u="https://madshot.net/e7ec56eda005.png" l="FB Lead Script" /> and <Shot u="https://madshot.net/ff682372e87d.png" l="Google Lead Conversion" /> need the same edit. Target/exclude specific forms by ID, name, or page URL when <Shot u="https://madshot.net/5ac53a3d1e69.png" l="editing the trigger" /> — examples: <Shot u="https://madshot.net/f4c38135c112.png" l="include URL" /> <Shot u="https://madshot.net/e0651d0f8cbc.png" l="include name" /> <Shot u="https://madshot.net/f805648eeb14.png" l="exclude URL" /> <Shot u="https://madshot.net/c341a7371211.png" l="exclude name" />. MadForms + custom forms together: use the Websites 360 container and add a <Shot u="https://madshot.net/01f438f14fc4.png" l="Form Submission trigger" /> per extra form <Shot u="https://madshot.net/9e0079e53776.png" l="example" />, then attach it to the madform tags via <Shot u="https://madshot.net/c80d202fc5ab.png" l="Triggering" /> → <Shot u="https://madshot.net/dea42effa655.png" l="plus" /> → <Shot u="https://madshot.net/1dc63aff6316.png" l="your trigger" />. <b>Iframes can't use Form Submission</b> — track the thank-you page instead (edit the trigger's <Shot u="https://madshot.net/5bc92a1982b2.png" l="type" /> to <Shot u="https://madshot.net/4037c05574c7.png" l="Page View" />, URL contains slug <Shot u="https://madshot.net/746b7b81fd79.png" l="example" />) or Element Visibility for on-page confirmation text — steps and <L href="https://missioncontrol.madwire.com/platform-analytics-specialist/pas-google-tag-manager-guide-master/">Elementor event-listener notes here</L>. Note: <Shot u="https://madshot.net/59a9e30cb4bc.png" l="form field values" /> won't show in preview with these methods.</> },
    { t: "Client is placing tracking codes", b: <>Turn on the "Client placing codes" toggle in Setup and the GTM section swaps the placement step for a handoff comment: meta tag + GTM header as close to <Lit v="<head>" /> as possible, GTM footer above <Lit v="</body>" />, BCC email for forms if applicable <Shot u="https://madshot.net/ea3436bcdce4.png" l="example comment" />. Wrap up with an MSM tag, log time, status Completed DNF; the MSM completes it and submits a finish-tracking-build task once codes are live.</> },
    { t: "CMPro subdomain tracking", b: <>Toggle "Subdomain (CMPro)" in Setup. Same GTM container for both domains — codes placed on the subdomain site too. Search Console switches to a <b>Domain</b> property verified by DNS TXT record, sitemaps submitted for root and subdomain, and Marketing 360 gets the <Lit v="sc-domain:domain.com" /> format.</> },
  ];

  /* ---------------------------------------------------------------- */
  /*  Render                                                          */
  /* ---------------------------------------------------------------- */
  if (!loaded) return <div style={{ fontFamily: T.sans, padding: 40, color: T.muted }}>Loading your build…</div>;

  const navItems = [
    { id: "setup", title: "Client & build setup" },
    ...sections.map(s => ({ id: s.id, title: s.title })),
    { id: "special", title: "Special cases" },
    { id: "export", title: "Export codes" },
  ];

  const sectionProgress = (s) => {
    const req = s.steps.filter(st => !st.optional);
    return { done: req.filter(st => checks[st.id]).length, total: req.length };
  };

  /* --- Vault panel --- */
  const VaultPanel = ({ compact }) => (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <div style={{ fontFamily: T.mono, fontSize: 10.5, letterSpacing: 1.4, textTransform: "uppercase", color: T.muted, fontWeight: 700 }}>Captured this build</div>
        <div style={{ fontFamily: T.mono, fontSize: 11, color: filled === fields.length && fields.length ? T.accent : T.muted, fontWeight: 700 }}>{filled}/{fields.length}</div>
      </div>
      <div style={{ height: 3, background: T.line, borderRadius: 2, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${fields.length ? (filled / fields.length) * 100 : 0}%`, background: T.accent, transition: "width .4s" }} />
      </div>
      {(client.m || client.name) && (
        <div style={{
          display: "flex", alignItems: "center", gap: 6, marginTop: 6, padding: "7px 9px",
          borderRadius: 8, background: T.sidebar, color: "#fff",
        }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontFamily: T.mono, fontSize: 9.5, letterSpacing: 1.2, textTransform: "uppercase", color: "#8FB4D9", fontWeight: 700 }}>Account name</div>
            <div style={{ fontFamily: T.mono, fontSize: 12, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{`${M} - ${bizName}`}</div>
          </div>
          <CopyBtn text={`${M} - ${bizName}`} small />
        </div>
      )}
      {client.url && (
        <div style={{
          display: "flex", alignItems: "center", gap: 6, padding: "7px 9px",
          borderRadius: 8, background: T.sidebar, color: "#fff",
        }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontFamily: T.mono, fontSize: 9.5, letterSpacing: 1.2, textTransform: "uppercase", color: "#8FB4D9", fontWeight: 700 }}>Site URL</div>
            <div style={{ fontFamily: T.mono, fontSize: 12, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{client.url}</div>
          </div>
          <CopyBtn text={client.url} small />
        </div>
      )}
      {(client.msmEmail || (cfg.ads && client.adSpecEmail)) && (
        <div style={{ marginTop: 6 }}>
          <div style={{ fontFamily: T.mono, fontSize: 9.5, letterSpacing: 1.2, textTransform: "uppercase", color: T.muted, fontWeight: 700, marginBottom: 4 }}>Contacts</div>
          {[
            client.msmEmail ? { l: "MSM", v: client.msmEmail } : null,
            cfg.ads && client.adSpecEmail ? { l: "Ad Specialist", v: client.adSpecEmail } : null,
          ].filter(Boolean).map(c => (
            <div key={c.l} style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 7px", borderRadius: 6, background: T.codeBg, marginBottom: 4 }}>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: T.ink }}>{c.l}</div>
                <div style={{ fontFamily: T.mono, fontSize: 10.5, color: T.muted, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.v}</div>
              </div>
              <CopyBtn text={c.v} small />
            </div>
          ))}
        </div>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 4, maxHeight: compact ? "45vh" : "none", overflowY: compact ? "auto" : "visible" }}>
        {fields.map(f => {
          const v = (codes[f.k] || "").trim();
          return (
            <div key={f.k} style={{
              display: "flex", alignItems: "center", gap: 6, padding: "5px 7px",
              borderRadius: 6, background: v ? T.accentSoft : "transparent",
              border: `1px dashed ${v ? "transparent" : T.line}`,
            }}>
              <div style={{
                width: 14, height: 14, borderRadius: 7, flexShrink: 0,
                background: v ? T.accent : "transparent", border: v ? "none" : `1.5px solid ${T.line}`,
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>{v ? <Check size={9} color="#fff" strokeWidth={3.2} /> : null}</div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: v ? T.ink : T.muted }}>{f.label}</div>
                {v ? <div style={{ fontFamily: T.mono, fontSize: 10.5, color: T.muted, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{v}</div> : null}
              </div>
              {v ? <CopyBtn text={v} small /> : null}
            </div>
          );
        })}
      </div>
      <button onClick={() => { setActive("export"); setVaultOpen(false); }} style={{
        marginTop: 6, padding: "8px 10px", borderRadius: 8, border: "none", cursor: "pointer",
        background: T.ink, color: "#fff", fontWeight: 700, fontSize: 12.5, display: "flex",
        alignItems: "center", justifyContent: "center", gap: 6, fontFamily: T.sans,
      }}><ClipboardList size={13} /> Open export list</button>
    </div>
  );

  /* --- Setup screen --- */
  const SetupScreen = () => (
    <div>
      <Eyebrow>Before you start</Eyebrow>
      <h2 style={h2s}>Client & build setup</h2>
      <p style={{ fontSize: 13.5, color: T.muted, lineHeight: 1.55, marginTop: 4 }}>
        Answer these once and the guide assembles only the steps this build needs — including the special-case
        variations. Everything auto-saves, and the M# you enter is used to pre-fill your conversion names.
      </p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10, margin: "14px 0 6px" }}>
        {[
          ["m", "M# (e.g. M12345)"], ["name", "Business name"], ["url", "Site URL"],
          ["msmEmail", "MSM email"],
          ...(cfg.ads ? [["adSpecEmail", "Ad Specialist email"]] : []),
        ].map(([k, ph]) => (
          <input key={k} value={client[k]} onChange={e => setClient(p => ({ ...p, [k]: e.target.value }))}
            placeholder={ph}
            style={{ padding: "9px 11px", border: `1px solid ${T.line}`, borderRadius: 8, fontSize: 13, fontFamily: k === "name" ? T.sans : T.mono, background: "#fff", outline: "none", color: T.ink }} />
        ))}
      </div>
      <Toggle label="Platform" sub="Squarespace, Wix, and Square/Weebly follow the Websites 360 lead-gen flow with a few integration quirks (called out in the steps). Shopify, BigCommerce, and Volusion have their own code placement and containers, pulled from the platform build docs." value={cfg.buildType}
        onChange={v => setCfg(p => ({ ...p, buildType: v, ...(v !== "wp" ? { madforms: true } : {}), ...(v === "volusion" ? { c2c: "none" } : {}) }))}
        options={[{ v: "w360", l: "Websites 360" }, { v: "wp", l: "WordPress / Woo360" }, { v: "shopify", l: "Shopify" }, { v: "bigcommerce", l: "BigCommerce" }, { v: "volusion", l: "Volusion" }, { v: "custom", l: "Other / custom" }]} />
      <Toggle label="What are we tracking?" sub="Purchases adds the ecommerce goals, labels, and paypal referral exclusion. Both adds the lead goal and generate_lead on top." value={cfg.ecom ? (cfg.leads !== false ? "both" : "ecom") : "leads"}
        onChange={v => setCfg(p => ({ ...p, ecom: v !== "leads", leads: v !== "ecom", ...(v === "leads" ? { merchant: false } : {}) }))}
        options={[{ v: "leads", l: "Leads only" }, { v: "ecom", l: "Purchases (ecommerce)" }, { v: "both", l: "Both" }]} />
      <Toggle label="Google Ads budget?" sub="Verified via Ad Specialist in Zoho + Ad Credit balance in BackOffice." value={cfg.ads}
        onChange={v => setCfg(p => ({ ...p, ads: v }))}
        options={[{ v: true, l: "Yes — build Ads tracking" }, { v: false, l: "No ad spend" }]} />
      {cfg.buildType === "volusion" ? (
        <div style={{ padding: "12px 0", borderBottom: `1px solid ${T.line}` }}>
          <div style={{ fontWeight: 700, fontSize: 13.5, marginBottom: 2 }}>Call tracking</div>
          <div style={{ fontSize: 12, color: T.muted }}>Volusion builds don't use CTCs — the CTC Script tag is paused in GTM before publishing. Call tracking is turned off for this build.</div>
        </div>
      ) : (
        <Toggle label="Call tracking" value={cfg.c2c}
          onChange={v => setCfg(p => ({ ...p, c2c: v }))}
          options={[{ v: "yes", l: "Set up C2Cs" }, { v: "site", l: "No C2C — use site number" }, { v: "none", l: "No C2C, no phone" }]} />
      )}
      {cfg.buildType === "wp" && (
        <Toggle label="Forms on the site" sub="Check the site — some run multiple plugins but still use MadForms." value={cfg.madforms}
          onChange={v => setCfg(p => ({ ...p, madforms: v }))}
          options={[{ v: true, l: "MadForms" }, { v: false, l: "Other forms (BCC needed)" }]} />
      )}
      {cfg.ecom && (
        <Toggle label="Merchant Center setup?" sub="Only for ecommerce clients selling products — you'll have a separate task for it." value={cfg.merchant}
          onChange={v => setCfg(p => ({ ...p, merchant: v }))}
          options={[{ v: true, l: "Yes — Merchant Center task" }, { v: false, l: "No" }]} />
      )}
      <Toggle label="Tracking outbound clicks?" sub="Third-party CTA links — scheduling, booking, or ordering apps." value={cfg.outbound}
        onChange={v => setCfg(p => ({ ...p, outbound: v }))}
        options={[{ v: false, l: "No" }, { v: true, l: "Yes" }]} />
      <Toggle label="Subdomain (CMPro)?" sub="Client uses e.g. blog.domain.com on Websites 360 alongside the main domain." value={cfg.subdomain}
        onChange={v => setCfg(p => ({ ...p, subdomain: v }))}
        options={[{ v: false, l: "No" }, { v: true, l: "Yes — domain property" }]} />
      <Toggle label="Who places the codes?" value={cfg.clientPlacing}
        onChange={v => setCfg(p => ({ ...p, clientPlacing: v }))}
        options={[{ v: false, l: "We do" }, { v: true, l: "Client is placing codes" }]} />
      <button
        disabled={!cfg.buildType}
        onClick={() => setActive(sections[0] ? sections[0].id : "setup")}
        style={{
          marginTop: 18, padding: "11px 20px", borderRadius: 10, border: "none",
          cursor: cfg.buildType ? "pointer" : "not-allowed",
          background: cfg.buildType ? T.accent : T.line, color: "#fff", fontWeight: 800, fontSize: 14,
          display: "inline-flex", alignItems: "center", gap: 8, fontFamily: T.sans,
        }}>
        Start the build <ChevronRight size={16} />
      </button>
      <div style={{ marginTop: 14, fontSize: 12, color: T.muted, display: "flex", gap: 12, flexWrap: "wrap" }}>
        <L href="https://drive.google.com/drive/folders/1M9YyFnqgHPE0oD4F6u6pfOn9x5goJqvg?dmr=1&ec=wgc-drive-hero-goto">Training recordings</L>
        <L href="https://docs.google.com/presentation/d/1oEo65HEoNPxyWGtJSO-BV61nmqxr2eyIl4xY8TB7XD8/edit#slide=id.g32b6d9f6b31_0_65">Lead Gen slide deck</L>
        <L href="https://docs.google.com/presentation/d/1krMYWYoX1wawm43EY9jN9trkVytZpo5pjZXF-vfokq0/edit#slide=id.g32b6d9f6b31_0_17">Ecomm slide deck</L>
        <L href="https://missioncontrol.madwire.com/category/platform-analytics-specialist/builds-platform-analytics-specialist/#">Custom platform resources</L>
      </div>
    </div>
  );

  /* --- Section screen --- */
  const SectionScreen = ({ sec, index }) => {
    const p = sectionProgress(sec);
    const next = navItems[navItems.findIndex(n => n.id === sec.id) + 1];
    return (
      <div>
        <Eyebrow>Phase {index + 1} of {sections.length} · {p.done}/{p.total} steps</Eyebrow>
        <h2 style={h2s}>{sec.title}</h2>
        <div style={{ height: 4, background: T.line, borderRadius: 2, overflow: "hidden", margin: "10px 0 16px" }}>
          <div style={{ height: "100%", width: `${(p.done / p.total) * 100}%`, background: T.accent, transition: "width .4s" }} />
        </div>
        {sec.steps.map((st, i) => {
          const done = !!checks[st.id];
          return (
            <div key={st.id} style={{
              background: T.panel, border: `1px solid ${done ? T.accent + "44" : T.line}`,
              borderRadius: 12, padding: "13px 14px", marginBottom: 10,
              opacity: done ? .82 : 1, transition: "opacity .25s, border-color .25s",
            }}>
              <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                <button onClick={() => toggle(st.id)} aria-label={done ? "Mark step incomplete" : "Mark step complete"} style={{
                  width: 22, height: 22, borderRadius: 7, flexShrink: 0, marginTop: 1, cursor: "pointer",
                  border: done ? "none" : `2px solid ${T.line}`, background: done ? T.accent : "#fff",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>{done ? <Check size={13} color="#fff" strokeWidth={3.2} /> : null}</button>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontWeight: 750, fontSize: 14, color: T.ink, textDecoration: done ? "line-through" : "none", textDecorationColor: T.muted }}>
                    <span style={{ fontFamily: T.mono, fontSize: 11, color: T.muted, marginRight: 7 }}>{String(i + 1).padStart(2, "0")}</span>
                    {st.title}
                    {st.optional && <span style={{
                      marginLeft: 8, padding: "1px 7px", borderRadius: 10, fontSize: 10, fontWeight: 800,
                      letterSpacing: .6, textTransform: "uppercase", verticalAlign: "middle",
                      background: T.codeBg, color: T.muted, border: `1px solid ${T.line}`,
                    }}>Optional</span>}
                  </div>
                  <div style={{ fontSize: 13.2, lineHeight: 1.62, color: "#3A4550", marginTop: 5 }}>{st.body}</div>
                </div>
              </div>
            </div>
          );
        })}
        {next && (
          <button onClick={() => setActive(next.id)} style={{
            marginTop: 6, padding: "10px 18px", borderRadius: 10, border: "none", cursor: "pointer",
            background: T.ink, color: "#fff", fontWeight: 700, fontSize: 13.5,
            display: "inline-flex", alignItems: "center", gap: 8, fontFamily: T.sans,
          }}>Continue to {next.title} <ChevronRight size={15} /></button>
        )}
      </div>
    );
  };

  /* --- Special cases screen --- */
  const SpecialScreen = () => (
    <div>
      <Eyebrow>Reference</Eyebrow>
      <h2 style={h2s}>Special cases & unique process notes</h2>
      <p style={{ fontSize: 13.5, color: T.muted, lineHeight: 1.55 }}>
        The handbook's Unique Process Notes. Several are already folded into your steps when the matching
        setup toggle is on — the rest live here for when a build throws you a curveball.
      </p>
      {specials.map((s, i) => (
        <div key={i} style={{ background: T.panel, border: `1px solid ${T.line}`, borderRadius: 12, marginBottom: 8, overflow: "hidden" }}>
          <button onClick={() => setOpenSpecial(openSpecial === i ? null : i)} style={{
            width: "100%", textAlign: "left", padding: "12px 14px", background: "none", border: "none",
            cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center",
            fontWeight: 750, fontSize: 13.5, color: T.ink, fontFamily: T.sans,
          }}>
            <span style={{ display: "flex", alignItems: "center", gap: 8 }}><AlertTriangle size={14} color={T.warn} /> {s.t}</span>
            {openSpecial === i ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
          </button>
          {openSpecial === i && <div style={{ padding: "0 14px 13px", fontSize: 13.2, lineHeight: 1.62, color: "#3A4550" }}>{s.b}</div>}
        </div>
      ))}
    </div>
  );

  /* --- Export screen --- */
  const ExportScreen = () => (
    <div>
      <Eyebrow>Build output · {filled}/{fields.length} codes captured</Eyebrow>
      <h2 style={h2s}>Your tracking codes</h2>
      <p style={{ fontSize: 13.5, color: T.muted, lineHeight: 1.55 }}>
        Everything you pasted along the way, formatted for the Zoho Campaign IDs table, Marketing 360 Setup,
        and your task comment. Copy the full list or grab values one at a time.
      </p>
      {filled < fields.length && (
        <Warn>{fields.length - filled} code slot{fields.length - filled === 1 ? "" : "s"} still empty — marked "(not captured)" below. Fill them in the build phases or directly here before handing off.</Warn>
      )}
      <div style={{ background: T.ink, borderRadius: 14, padding: "16px 16px 14px", marginTop: 10 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <div style={{ fontFamily: T.mono, fontSize: 10.5, letterSpacing: 1.6, textTransform: "uppercase", color: "#8FB4D9", fontWeight: 700 }}>Copyable code list</div>
          <CopyBtn text={exportText} />
        </div>
        <pre style={{
          fontFamily: T.mono, fontSize: 12, lineHeight: 1.75, color: "#E7EFEC", margin: 0,
          whiteSpace: "pre-wrap", wordBreak: "break-word",
        }}>{exportText}</pre>
      </div>
      <div style={{ marginTop: 16 }}>
        <div style={{ fontFamily: T.mono, fontSize: 10.5, letterSpacing: 1.4, textTransform: "uppercase", color: T.muted, fontWeight: 700, marginBottom: 8 }}>Edit individual values</div>
        {fields.map(f => <CodeField key={f.k} k={f.k} />)}
      </div>
      <div style={{ background: T.panel, border: `1px solid ${T.line}`, borderRadius: 14, padding: "14px 16px", marginTop: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <div style={{ fontFamily: T.mono, fontSize: 10.5, letterSpacing: 1.4, textTransform: "uppercase", color: T.muted, fontWeight: 700 }}>Task comment template</div>
          <CopyBtn text={commentText} />
        </div>
        <pre style={{ fontFamily: T.sans, fontSize: 13, lineHeight: 1.6, color: T.ink, margin: 0, whiteSpace: "pre-wrap" }}>{commentText}</pre>
      </div>
      <button onClick={resetAll} style={{
        marginTop: 18, padding: "9px 16px", borderRadius: 10, cursor: "pointer",
        border: `1px solid ${resetArmed ? "#B4432A" : T.line}`, background: resetArmed ? "#FBEAE5" : "#fff",
        color: resetArmed ? "#8F2F1B" : T.muted, fontWeight: 700, fontSize: 12.5,
        display: "inline-flex", alignItems: "center", gap: 7, fontFamily: T.sans,
      }}><RotateCcw size={13} /> {resetArmed ? "Tap again to erase this build" : "Start a new build"}</button>
    </div>
  );

  /* --- Nav --- */
  const Nav = () => (
    <nav style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      {navItems.map((n, i) => {
        const isActive = active === n.id;
        const sec = sections.find(s => s.id === n.id);
        const p = sec ? sectionProgress(sec) : null;
        const complete = p && p.total > 0 && p.done === p.total;
        return (
          <button key={n.id} onClick={() => { setActive(n.id); setNavOpen(false); }} style={{
            display: "flex", alignItems: "center", gap: 9, textAlign: "left",
            padding: "9px 12px", borderRadius: 9, border: "none", cursor: "pointer",
            background: isActive ? "rgba(255,255,255,.10)" : "transparent",
            color: isActive ? "#fff" : T.sidebarText, fontFamily: T.sans,
          }}>
            <span style={{
              width: 18, height: 18, borderRadius: 9, flexShrink: 0, fontFamily: T.mono,
              fontSize: 9.5, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center",
              background: complete ? T.accent : "rgba(255,255,255,.10)",
              color: complete ? "#fff" : T.sidebarText,
            }}>{complete ? <Check size={10} strokeWidth={3.5} /> : (n.id === "setup" ? "◈" : n.id === "special" ? "!" : n.id === "export" ? "»" : i)}</span>
            <span style={{ fontSize: 13, fontWeight: isActive ? 750 : 550, flex: 1 }}>{n.title}</span>
            {p && <span style={{ fontFamily: T.mono, fontSize: 10, opacity: .65 }}>{p.done}/{p.total}</span>}
          </button>
        );
      })}
    </nav>
  );

  return (
    <CodesCtx.Provider value={{ codes, setCode }}>
    <div style={{ fontFamily: T.sans, background: T.paper, minHeight: "100vh", color: T.ink }}>
      <style>{`
        @media (prefers-reduced-motion: reduce) { * { transition: none !important; } }
        button:focus-visible, input:focus-visible, a:focus-visible { outline: 2px solid ${T.accent}; outline-offset: 2px; }
        input::placeholder { color: #A9B4B8; }
        details summary::-webkit-details-marker { display: none; }
        @media (min-width: 1180px) { .vault-shift { padding-right: 356px; } }
      `}</style>

      {/* Top bar (mobile) */}
      <div style={{
        position: "sticky", top: 0, zIndex: 30, background: T.sidebar, color: "#fff",
        padding: "10px 14px", display: "flex", alignItems: "center", gap: 10,
      }}>
        <button onClick={() => openDrawer("nav")} style={{ background: "none", border: "none", color: "#fff", cursor: "pointer", display: "flex" }} aria-label="Toggle navigation">
          {navOpen ? <X size={18} /> : <Menu size={18} />}
        </button>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontFamily: T.mono, fontSize: 9.5, letterSpacing: 1.6, textTransform: "uppercase", color: "#8FB4D9", fontWeight: 700 }}>Tracking Environment Build</div>
          <div style={{ fontSize: 14, fontWeight: 800, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {client.m || client.name ? `${M} — ${bizName}` : "New build"}
          </div>
        </div>
        <div style={{ fontFamily: T.mono, fontSize: 11, color: "#8FB4D9", fontWeight: 700 }}>{doneCount}/{allSteps.length || "—"}</div>
        <button onClick={() => openDrawer("clip")} style={{
          background: clipOpen ? T.accent : "rgba(255,255,255,.10)", border: "none", color: "#fff",
          cursor: "pointer", display: "flex", alignItems: "center", gap: 5, padding: "6px 10px",
          borderRadius: 8, fontSize: 11.5, fontWeight: 700, fontFamily: T.sans,
        }} aria-label="Toggle quick-copy clipboard"><Clipboard size={13} /></button>
        <button onClick={() => (vaultOpen ? closeVault() : setVaultOpen(true))} style={{
          background: vaultOpen ? T.accent : "rgba(255,255,255,.10)", border: "none", color: "#fff",
          cursor: "pointer", display: "flex", alignItems: "center", gap: 5, padding: "6px 10px",
          borderRadius: 8, fontSize: 11.5, fontWeight: 700, fontFamily: T.sans,
        }} aria-label="Toggle code vault"><Vault size={13} /> {filled}/{fields.length || "—"}</button>
      </div>

      {/* Mobile drawers */}
      {navOpen && (
        <div style={{ background: T.sidebar, padding: "6px 10px 14px", position: "sticky", top: 46, zIndex: 29 }}>
          {Nav()}
          <button onClick={resetAll} style={{ marginTop: 8, background: resetArmed ? "#7A2E1D" : "none", border: `1px solid rgba(255,255,255,.18)`, color: resetArmed ? "#fff" : T.sidebarText, borderRadius: 8, padding: "7px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6, fontFamily: T.sans }}><RotateCcw size={12} /> {resetArmed ? "Tap again to erase this build" : "Reset build"}</button>
        </div>
      )}
      {clipOpen && (
        <div style={{
          background: "#fff", borderBottom: `1px solid ${T.line}`, padding: "12px 14px",
          position: "sticky", top: 46, zIndex: 28, boxShadow: "0 8px 24px rgba(0,44,84,.12)",
          maxHeight: "60vh", overflowY: "auto",
        }}>
          <div style={{ fontFamily: T.mono, fontSize: 10.5, letterSpacing: 1.4, textTransform: "uppercase", color: T.muted, fontWeight: 700, marginBottom: 8 }}>
            Quick copy — auto-filled from your setup
          </div>
          {!client.m && !client.name ? (
            <div style={{ fontSize: 12.5, color: T.muted }}>Enter the M# and business name in Setup and this drawer fills with ready-to-paste names, emails, and exact values.</div>
          ) : quickCopies.map(grp => (
            <div key={grp.title} style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: T.ink, textTransform: "uppercase", letterSpacing: .6, margin: "4px 0 5px" }}>{grp.title}</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                {grp.items.map((it, i) => <QuickRow key={grp.title + i} label={it.l} value={it.v} />)}
              </div>
            </div>
          ))}
        </div>
      )}
      {/* Code vault — right-side drawer, slides in as codes get captured */}
      <div aria-hidden={!vaultOpen} style={{
        position: "fixed", top: 0, right: 0, bottom: 0, width: "min(340px, 88vw)",
        background: "#fff", borderLeft: `1px solid ${T.line}`,
        boxShadow: vaultOpen ? "-12px 0 32px rgba(0,44,84,.18)" : "none",
        transform: vaultOpen ? "translateX(0)" : "translateX(105%)",
        transition: "transform .28s ease", zIndex: 40,
        display: "flex", flexDirection: "column",
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 14px", borderBottom: `1px solid ${T.line}`, background: T.sidebar }}>
          <div style={{ fontFamily: T.mono, fontSize: 10.5, letterSpacing: 1.6, textTransform: "uppercase", color: "#8FB4D9", fontWeight: 700 }}>
            <Vault size={12} style={{ verticalAlign: "-2px", marginRight: 6 }} />Code vault
          </div>
          <button onClick={closeVault} aria-label="Close code vault" style={{ background: "rgba(255,255,255,.10)", border: "none", color: "#fff", cursor: "pointer", display: "flex", padding: 5, borderRadius: 7 }}>
            <X size={15} />
          </button>
        </div>
        <div style={{ padding: "12px 14px 20px", overflowY: "auto", flex: 1 }}>
          {VaultPanel({ compact: false })}
        </div>
      </div>

      {/* Main content */}
      <div className={vaultOpen ? "vault-shift" : ""} style={{ transition: "padding-right .28s ease" }}>
      <div style={{ maxWidth: 780, margin: "0 auto", padding: "22px 16px 60px" }}>
        {active === "setup" && SetupScreen()}
        {sections.map((s, i) => active === s.id ? <div key={s.id}>{SectionScreen({ sec: s, index: i })}</div> : null)}
        {active === "special" && SpecialScreen()}
        {active === "export" && ExportScreen()}
        {active !== "setup" && !sections.length && (
          <div style={{ color: T.muted, fontSize: 14 }}>Pick a build type in Setup to generate your steps.</div>
        )}
      </div>
      </div>
    </div>
    </CodesCtx.Provider>
  );
}