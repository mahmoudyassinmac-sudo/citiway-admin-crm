/* eslint-disable */
// @ts-nocheck — ported from the original single-file Citiway tool (Project Knowledge/citiway-unit-handover.html)
'use client';
import React, { useState, useMemo, useEffect, useLayoutEffect, useRef, useCallback, Fragment } from 'react';


const LOGO = "/assets/citiway-logo.png";
const COMPANY = { name: 'Citiway Real Estate Brokerage L.L.C.', license: 'License No. 726153, DED' };
const FOOTER =
  'Citiway Real Estate Brokerage L.L.C. | License No. 726153, DED | Office No. 205, Bayswater Tower, Business Bay, P.O. Box 34201, Dubai, UAE | Tel: +971 4 277 2373 / +971 4 277 2374 | Mobile: +971 52 771 3111 | info@citiway.com';

const MM = 96 / 25.4;               // px per mm at 96 dpi
const PAGE_H = 297 * MM;
const BODY_TOP = 11 * MM;
const FOOT_BOTTOM = 7 * MM;
const FOOT_GAP = 4 * MM;            // breathing room above footer

const fmtDate = (iso) => { if (!iso) return ''; const [y, m, d] = iso.split('-'); return `${d}/${m}/${y}`; };
const today = () => new Date().toISOString().slice(0, 10);
const uid = () => Math.random().toString(36).slice(2, 9);

/* ---------------- Checklist model ---------------- */
const LAYOUTS = ['Studio', '1 BR', '2 BR', '3 BR', '4+ BR / Villa'];
const ITEMS = {
  entrance: ['Entrance door, lock & peephole', 'Walls & paint', 'Ceiling & lights', 'Flooring', 'Switches & sockets'],
  kitchen: ['Cabinets & countertop', 'Sink & taps', 'Cooker / hob & hood', 'Appliances (if any)'],
  bed: ['Doors & wardrobes', 'Walls, ceiling & flooring', 'Lights, switches & sockets'],
  bath: ['Toilet & flush', 'Sink, taps & mirror', 'Shower / bathtub', 'Water heater & ventilation'],
  balcony: ['Door, flooring & railing'],
  maid: ['Door & lock', 'Walls, ceiling & flooring', 'Lights & ventilation'],
  general: ['Air-conditioning & thermostat', 'Windows, curtains / blinds', 'Electrical board & fittings', 'Plumbing & drainage', 'Smoke detector & intercom', 'Overall cleanliness'],
};
function bedroomCount(d) {
  if (d.layout === 'Studio') return 0;
  if (d.layout === '4+ BR / Villa') return Math.max(4, Math.min(10, parseInt(d.villaBeds, 10) || 4));
  return parseInt(d.layout, 10);
}
function bathroomCount(d) {
  if (d.layout === 'Studio') return 1;
  const n = parseInt(d.baths, 10);
  return n > 0 ? Math.min(10, n) : bedroomCount(d);
}
function buildSections(d) {
  const s = [];
  const studio = d.layout === 'Studio';
  s.push({ key: 'entrance', title: studio ? 'Entrance & Studio Living / Sleeping Area' : 'Entrance & Living / Dining Area', items: ITEMS.entrance });
  s.push({ key: 'kitchen', title: 'Kitchen', items: ITEMS.kitchen });
  for (let i = 1; i <= bedroomCount(d); i++) s.push({ key: 'bed' + i, title: i === 1 ? 'Master Bedroom' : `Bedroom ${i}`, items: ITEMS.bed });
  const nb = bathroomCount(d);
  for (let i = 1; i <= nb; i++) s.push({ key: 'bath' + i, title: studio ? 'Bathroom' : i === 1 ? 'Main Bathroom' : i === 2 ? 'En-suite / Bathroom 2' : `Bathroom ${i}`, items: ITEMS.bath });
  if (d.balcony) s.push({ key: 'balcony', title: 'Balcony / Terrace', items: ITEMS.balcony });
  if (d.maid) s.push({ key: 'maid', title: "Maid's / Storage Room", items: ITEMS.maid });
  s.push({ key: 'general', title: 'General & Systems', items: ITEMS.general });
  return s.map((sec) => ({ ...sec, items: [...sec.items.map((label) => ({ id: sec.key + '|' + label, label })), ...((d.custom[sec.key] || []).map((c) => ({ id: sec.key + '|c|' + c.id, label: c.label, customId: c.id })))] }));
}

const PRESETS = ['Sofa Set', 'Dining Table & Chairs', 'Bed & Mattress', 'Wardrobe', 'Refrigerator', 'Washing Machine', 'Cooker / Oven', 'Microwave', 'TV', 'Curtains / Blinds'];
const DEFAULT_ITEMS = [
  'Original key(s) of the unit',
  'Access card(s) for the unit and facilities',
  'Car parking access card(s)',
  'Remote control(s) (A/C, gate, other)',
].map((item) => ({ id: uid(), item, qty: '', serial: '' }));

/* ---------------- Sheet atoms ---------------- */
const Tick = () => (
  <svg viewBox="0 0 12 12" style={{ width: '3.4mm', height: '3.4mm', display: 'inline-block', verticalAlign: 'middle' }}>
    <path d="M2 6.4 4.8 9.1 10 3.2" fill="none" stroke="#1E3553" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const Box = ({ on }) => (
  <span style={{ width: '3.4mm', height: '3.4mm', borderRadius: '0.7mm', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', border: on ? '1.3px solid #1E3553' : '1.3px solid #9DB8DE', background: on ? '#1E3553' : '#fff', verticalAlign: 'middle' }}>
    {on && <svg viewBox="0 0 12 12" style={{ width: '2.5mm', height: '2.5mm' }}><path d="M2.2 6.3 4.8 8.8 9.8 3.4" fill="none" stroke="#fff" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" /></svg>}
  </span>
);
const Sec = ({ n, children, note }) => (
  <div className="flex items-center" style={{ gap: '2.5mm', fontFamily: 'Montserrat, sans-serif', fontWeight: 700, color: '#1E3553', fontSize: '10pt', letterSpacing: '.04em', textTransform: 'uppercase', paddingBottom: '2mm' }}>
    <span style={{ width: '1.2mm', height: '4.2mm', background: '#7AA3D8', borderRadius: '1mm' }} />
    <span>{n}. {children}</span>
    {note && <span style={{ textTransform: 'none', fontFamily: 'Inter, sans-serif', fontWeight: 500, fontSize: '7.6pt', color: '#6B7A90', letterSpacing: 0 }}>{note}</span>}
  </div>
);
const CK_COLS = <colgroup><col style={{ width: '40%' }} /><col style={{ width: '9%' }} /><col style={{ width: '11%' }} /><col style={{ width: '8%' }} /><col style={{ width: '32%' }} /></colgroup>;
const INV_COLS = <colgroup><col style={{ width: '29%' }} /><col style={{ width: '19%' }} /><col style={{ width: '7%' }} /><col style={{ width: '9%' }} /><col style={{ width: '11%' }} /><col style={{ width: '25%' }} /></colgroup>;
const Blank = ({ v }) => (v ? <>{v}</> : <span style={{ color: '#CBD5E1' }}>—</span>);

function FullHeader({ d }) {
  const moveIn = d.mode === 'in';
  return (
    <div style={{ paddingBottom: '1mm' }}>
      <div className="flex items-start justify-between">
        <div>
          <img src={LOGO} alt="Citiway Real Estate" style={{ height: '13mm' }} />
          <div style={{ marginTop: '2.6mm', fontSize: '8.4pt', lineHeight: 1.5 }}>
            <div style={{ fontWeight: 600, color: '#1E3553' }}>{COMPANY.name}</div>
            <div>{COMPANY.license}</div>
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 800, color: '#1E3553', textTransform: 'uppercase', fontSize: '15.5pt', letterSpacing: '.05em', lineHeight: 1.15 }}>
            Unit Handover &amp;<br />Inspection Form
          </div>
          <div style={{ marginTop: '1.4mm', display: 'inline-block', fontSize: '8pt', fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: '#fff', background: moveIn ? '#1E3553' : '#7AA3D8', borderRadius: '1mm', padding: '0.8mm 2.4mm' }}>
            {moveIn ? 'Move-In Handover' : 'Move-Out Inspection'}
          </div>
          <table style={{ marginLeft: 'auto', marginTop: '2.4mm', fontSize: '9pt', borderCollapse: 'collapse' }}>
            <tbody>
              <tr><td style={{ color: '#64748B', paddingRight: '3mm', textAlign: 'right', padding: '0.8mm 3mm 0.8mm 0' }}>Ref. No.</td><td style={{ fontWeight: 600, color: '#1E3553', borderBottom: '1px solid #C9D9EE', padding: '0.8mm 2mm', minWidth: '34mm', textAlign: 'left' }}><Blank v={d.refNo} /></td></tr>
              <tr><td style={{ color: '#64748B', textAlign: 'right', padding: '0.8mm 3mm 0.8mm 0' }}>Date</td><td style={{ fontWeight: 600, color: '#1E3553', borderBottom: '1px solid #C9D9EE', padding: '0.8mm 2mm', textAlign: 'left' }}><Blank v={fmtDate(d.date)} /></td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
function MiniHeader({ d }) {
  return (
    <div className="flex items-center justify-between" style={{ paddingBottom: '3mm', marginBottom: '1mm', borderBottom: '1px solid #C9D9EE' }}>
      <img src={LOGO} alt="Citiway" style={{ height: '8mm' }} />
      <div style={{ textAlign: 'right', fontSize: '8pt', lineHeight: 1.4 }}>
        <div style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 700, color: '#1E3553', letterSpacing: '.05em', textTransform: 'uppercase' }}>Unit Handover &amp; Inspection Form <span style={{ color: '#7AA3D8' }}>· continued</span></div>
        <div style={{ color: '#64748B' }}>Ref. No. {d.refNo || '—'} · {fmtDate(d.date)} · {d.mode === 'in' ? 'Move-In Handover' : 'Move-Out Inspection'}</div>
      </div>
    </div>
  );
}
function Footer({ page, total, d }) {
  return (
    <div>
      <div style={{ height: '0.6mm', background: 'linear-gradient(90deg,#1E3553,#7AA3D8)', borderRadius: '1mm', marginBottom: '2.4mm' }} />
      <p style={{ textAlign: 'center', fontSize: '7.2pt', lineHeight: 1.55, color: '#555', margin: 0 }}>{FOOTER}</p>
      <div className="flex justify-between" style={{ fontSize: '6.8pt', color: '#94A3B8', marginTop: '1mm' }}>
        <span>Ref. No. {d.refNo}</span><span>Page {page} of {total}</span>
      </div>
    </div>
  );
}

/* ---------------- Build printable blocks ---------------- */
function buildBlocks(d, sections) {
  const B = [];
  const moveIn = d.mode === 'in';
  const pad = (mm, el) => <div style={{ paddingTop: mm + 'mm' }}>{el}</div>;
  B.push({ id: 'hdr', node: <FullHeader d={d} /> });

  // Section 1
  const pairs = [['Tenant Name', d.tenantName, 'Emirates ID No.', d.eid], ['Nationality', d.nationality, 'Mobile No.', d.mobile], ['Unit / Property No.', d.unit, 'Floor No.', d.floor], ['Building', d.building, 'Community', d.community], ['Owner', d.owner, 'Parking No.', d.parking]];
  B.push({ id: 's1', node: pad(4.5, <>
    <Sec n={1}>Tenant &amp; Unit Details</Sec>
    <table className="ct">
      <colgroup><col style={{ width: '20%' }} /><col style={{ width: '30%' }} /><col style={{ width: '18%' }} /><col style={{ width: '32%' }} /></colgroup>
      <tbody>{pairs.map(([a, av, b, bv]) => (
        <tr key={a}><td style={{ background: '#F4F8FC', color: '#1E3553', fontWeight: 600, fontSize: '8pt' }}>{a}</td><td style={{ fontWeight: 600 }}><Blank v={av} /></td>
          <td style={{ background: '#F4F8FC', color: '#1E3553', fontWeight: 600, fontSize: '8pt' }}>{b}</td><td style={{ fontWeight: 600 }}><Blank v={bv} /></td></tr>))}
      </tbody>
    </table></>) });

  // Section 2
  B.push({ id: 's2', node: pad(4.5, <>
    <Sec n={2}>{moveIn ? 'Items Handed Over' : 'Items Returned'}</Sec>
    <table className="ct">
      <colgroup><col style={{ width: '52%' }} /><col style={{ width: '10%' }} /><col style={{ width: '38%' }} /></colgroup>
      <thead><tr><th>Item</th><th className="c">Qty</th><th>Card / Serial No(s).</th></tr></thead>
      <tbody>{d.items.map((it) => (
        <tr key={it.id}><td>{it.item}</td><td className="c" style={{ fontWeight: 600 }}>{it.qty}</td><td>{it.serial}</td></tr>))}
      </tbody>
    </table></>) });

  // Section 3 — Furniture & Appliances (only if furnished)
  let n = 3;
  if (d.furnishing !== 'Unfurnished') {
    B.push({ id: 'inv-title', keepNext: true, node: pad(4.5, <Sec n={n} note={`(${d.furnishing})`}>Furniture &amp; Appliances Inventory</Sec>) });
    if (d.inventory.length === 0) {
      B.push({ id: 'inv-empty', group: 'inv', node: <table className="ct cont">{INV_COLS}<tbody>{[0, 1, 2].map((i) => <tr key={i}><td>&nbsp;</td><td></td><td></td><td></td><td></td><td></td></tr>)}</tbody></table> });
    }
    d.inventory.forEach((r) => B.push({ id: 'inv-' + r.id, group: 'inv', node: (
      <table className="ct cont">{INV_COLS}<tbody><tr>
        <td style={{ fontWeight: 600 }}>{r.item}</td><td>{r.location}</td><td className="c">{r.qty}</td>
        <td className="c">{r.cond === 'good' ? <Tick /> : ''}</td><td className="c">{r.cond === 'repair' ? <Tick /> : ''}</td><td style={{ fontSize: '8pt' }}>{r.notes}</td>
      </tr></tbody></table>) }));
    n++;
  }

  // Condition checklist
  B.push({ id: 'ck-title', keepNext: true, node: pad(4.5, <Sec n={n} note="(tick the applicable column)">Condition Checklist</Sec>) });
  sections.forEach((sec) => {
    B.push({ id: 'ck-' + sec.key, group: 'ck', node: (
      <table className="ct cont">{CK_COLS}<tbody>
        <tr className="grp"><td colSpan={5}>{sec.title}</td></tr>
        {sec.items.map((it) => {
          const st = d.checks[it.id] || {};
          return (
            <tr key={it.id}>
              <td>{it.label}</td>
              <td className="c">{st.s === 'good' ? <Tick /> : ''}</td>
              <td className="c">{st.s === 'repair' ? <Tick /> : ''}</td>
              <td className="c">{st.s === 'na' ? <Tick /> : ''}</td>
              <td style={{ fontSize: '8pt' }}>{st.note}</td>
            </tr>);
        })}
      </tbody></table>) });
  });
  n++;

  // Remarks
  B.push({ id: 'rem', node: pad(4.5, <>
    <Sec n={n}>Remarks / Defects Noted</Sec>
    <div>{d.remarks.map((r, i) => (
      <div key={i} className="flex" style={{ gap: '2.4mm', borderBottom: '1px dotted #9DB8DE', padding: '1.4mm 0', minHeight: '6.4mm', fontSize: '8.8pt', alignItems: 'flex-end' }}>
        <span style={{ fontWeight: 700, color: '#1E3553', width: '5mm' }}>{i + 1}-</span><span style={{ flex: 1 }}>{r}</span>
      </div>))}
    </div></>) });

  // Declaration + signatures (kept together)
  const decl = moveIn
    ? 'I, the tenant, confirm that I have inspected the unit with the Citiway Real Estate representative and received it, together with the items listed above, in the condition recorded in this form. I undertake to maintain the unit in good condition during the tenancy and to return it in the same condition at the end of the tenancy, fair wear and tear excepted.'
    : 'I, the tenant, confirm that I have inspected the unit with the Citiway Real Estate representative at the end of the tenancy and returned it, together with the items listed above, in the condition recorded in this form. I acknowledge that any defects recorded above, fair wear and tear excepted, will be settled in accordance with the tenancy contract.';
  const sigBox = { marginTop: '2mm', height: '20mm', border: '1px dashed #9DB8DE', borderRadius: '6px', background: '#FAFCFE' };
  const line = (label, v) => (
    <div className="flex" style={{ marginTop: '2.2mm', fontSize: '8.8pt', borderBottom: '1px solid #7AA3D8', paddingBottom: '1mm', minHeight: '5mm' }}>
      <span style={{ color: '#64748B', fontSize: '8pt', width: '11mm' }}>{label}</span><span style={{ fontWeight: 600 }}>{v}</span>
    </div>);
  const sigLabel = { fontFamily: 'Montserrat, sans-serif', fontWeight: 600, color: '#1E3553', textTransform: 'uppercase', fontSize: '8.2pt', letterSpacing: '.05em' };
  B.push({ id: 'sig', node: pad(5, <>
    <div style={{ background: '#EAF1FA', borderLeft: '1.2mm solid #7AA3D8', borderRadius: '0 6px 6px 0', padding: '3mm 4.5mm', fontSize: '8.8pt', lineHeight: 1.6, textAlign: 'justify', color: '#2F3B4A' }}>{decl}</div>
    <div className="flex" style={{ gap: '12mm', marginTop: '5mm' }}>
      <div style={{ flex: 1 }}>
        <div style={sigLabel}>{moveIn ? 'Received by (Tenant)' : 'Returned by (Tenant)'}</div>
        <div style={sigBox} className="flex items-end justify-end"><span style={{ fontSize: '6.8pt', color: '#9DB8DE', padding: '1.6mm' }}>Signature</span></div>
        {line('Name:', d.tenantName)}{line('Date:', fmtDate(d.signDate))}
      </div>
      <div style={{ flex: 1 }}>
        <div style={sigLabel}>{moveIn ? 'Handed over by (Citiway Real Estate)' : 'Inspected by (Citiway Real Estate)'}</div>
        <div style={sigBox} className="flex items-end justify-end"><span style={{ fontSize: '6.8pt', color: '#9DB8DE', padding: '1.6mm' }}>Signature &amp; Stamp</span></div>
        {line('Name:', d.agentName)}{line('Date:', fmtDate(d.signDate))}
      </div>
    </div></>) });
  return B;
}
const GROUP_HEADERS = {
  ck: <table className="ct">{CK_COLS}<thead><tr><th>Area / Item</th><th className="c">Good</th><th className="c">Needs Repair</th><th className="c">N/A</th><th>Notes</th></tr></thead></table>,
  inv: <table className="ct">{INV_COLS}<thead><tr><th>Item Description</th><th>Location / Room</th><th className="c">Qty</th><th className="c">Good</th><th className="c">Needs Repair</th><th>Notes</th></tr></thead></table>,
};

/* ---------------- Pagination ---------------- */
function paginate(blocks, h) {
  const avail = (first) => PAGE_H - BODY_TOP - FOOT_BOTTOM - h.footer - FOOT_GAP;
  const pages = [];
  let page = null, used = 0, lastGroup = null;
  const newPage = () => { page = []; pages.push(page); lastGroup = null; used = 0; if (pages.length > 1) { page.push({ kind: 'mini' }); used = h.mini; } };
  const needFor = (b, lg) => (h['b:' + b.id] || 0) + (b.group && lg !== b.group ? (h['g:' + b.group] || 0) : 0);
  newPage();
  blocks.forEach((b, i) => {
    let need = needFor(b, lastGroup);
    if (b.keepNext && blocks[i + 1]) need += needFor(blocks[i + 1], b.group || null);
    const empty = page.length === (pages.length > 1 ? 1 : 0);
    if (used + need > avail() && !empty) newPage();
    if (b.group && lastGroup !== b.group) { page.push({ kind: 'gh', group: b.group }); used += h['g:' + b.group] || 0; }
    page.push({ kind: 'b', block: b });
    used += h['b:' + b.id] || 0;
    lastGroup = b.group || null;
  });
  return pages;
}

function Measure({ blocks, d, onHeights }) {
  const ref = useRef(null);
  useLayoutEffect(() => {
    const el = ref.current; if (!el) return;
    const h = {};
    el.querySelectorAll('[data-m]').forEach((n) => { h[n.getAttribute('data-m')] = n.getBoundingClientRect().height; });
    onHeights(h);
  });
  return (
    <div ref={ref} className="measure" aria-hidden="true">
      <div data-m="mini"><MiniHeader d={d} /></div>
      <div data-m="footer"><Footer page={1} total={1} d={d} /></div>
      {Object.entries(GROUP_HEADERS).map(([g, node]) => <div key={g} data-m={'g:' + g}>{node}</div>)}
      {blocks.map((b) => <div key={b.id} data-m={'b:' + b.id}>{b.node}</div>)}
    </div>
  );
}

function Page({ items, num, total, d }) {
  return (
    <div className="pg">
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '1.6mm', background: 'linear-gradient(90deg,#1E3553 0%,#1E3553 62%,#7AA3D8 62%,#7AA3D8 100%)' }} />
      <div className="pg-body">
        {items.map((it, i) => it.kind === 'mini' ? <MiniHeader key="mini" d={d} />
          : it.kind === 'gh' ? <div key={'gh' + i}>{GROUP_HEADERS[it.group]}</div>
          : <div key={it.block.id}>{it.block.node}</div>)}
      </div>
      <div className="pg-foot"><Footer page={num} total={total} d={d} /></div>
    </div>
  );
}

function ScaledPages({ pages }) {
  const ref = useRef(null);
  const [scale, setScale] = useState(0.7);
  useEffect(() => {
    const el = ref.current;
    const ro = new ResizeObserver(() => setScale(Math.min(1.1, Math.max(0.3, (el.clientWidth - 32) / 794))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return (
    <div ref={ref} className="w-full">
      {pages.map((p, i) => (
        <div key={i} className="sheet" style={{ marginBottom: i < pages.length - 1 ? 24 : 0 }}>
          <div className="scaler" style={{ width: 794 * scale, height: 1123 * scale, margin: '0 auto' }}>
            <div className="scaler" style={{ transform: `scale(${scale})`, transformOrigin: 'top left', width: 794, boxShadow: '0 12px 40px rgba(30,53,83,.18)', borderRadius: 4, overflow: 'hidden' }}>{p}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ---------------- Form atoms ---------------- */
function Field({ label, children, hint }) {
  return (
    <label className="block">
      <span className="block text-[12px] font-semibold text-navy mb-1 tracking-wide">{label}</span>
      {children}
      {hint && <span className="block text-[11px] text-slate-500 mt-1">{hint}</span>}
    </label>
  );
}
function Input(props) { return <input {...props} className={'field-in ' + (props.className || '')} />; }
function Card({ title, right, children }) {
  return (
    <section className="glass rounded-xl p-4">
      <div className="flex items-center justify-between mb-3 gap-2">
        <h3 className="font-head font-bold text-[13px] uppercase tracking-wider text-navy flex items-center gap-2"><span className="w-1 h-4 rounded bg-brand inline-block" />{title}</h3>
        {right}
      </div>
      <div className="space-y-3">{children}</div>
    </section>
  );
}
function Seg({ options, value, onChange, cols }) {
  return (
    <div className="grid gap-1 p-1 bg-slate-100 rounded-lg" style={{ gridTemplateColumns: `repeat(${cols || options.length},minmax(0,1fr))` }}>
      {options.map((o) => {
        const [v, l] = Array.isArray(o) ? o : [o, o];
        return <button key={v} type="button" onClick={() => onChange(v)} className={`py-2 px-1 rounded-md text-[13px] font-semibold transition ${value === v ? 'bg-navy text-white shadow' : 'text-slate-600 hover:bg-white'}`}>{l}</button>;
      })}
    </div>
  );
}
function Switch({ on, onChange, label }) {
  return (
    <button type="button" onClick={() => onChange(!on)} className="flex items-center gap-2.5 w-full rounded-lg border border-slate-200 px-3 py-2 hover:bg-slate-50 transition">
      <span className={`relative w-10 h-[22px] rounded-full transition flex-none ${on ? 'bg-navy' : 'bg-slate-300'}`}><span className={`absolute top-[3px] w-4 h-4 rounded-full bg-white shadow transition-all ${on ? 'left-[21px]' : 'left-[3px]'}`} /></span>
      <span className="text-[13px] font-semibold text-ink text-left">{label}</span>
    </button>
  );
}
const STATES = [['good', 'Good', 'bg-emerald-600'], ['repair', 'Repair', 'bg-amber-500'], ['na', 'N/A', 'bg-slate-500']];

/* ---------------- App ---------------- */
function App() {
  const [d, setD] = useState({
    mode: 'in', refNo: 'CW-HO-2026-0001', date: today(),
    layout: '2 BR', villaBeds: '4', baths: '', balcony: true, maid: false,
    furnishing: 'Unfurnished',
    tenantName: '', nationality: '', unit: '', building: '', owner: '',
    eid: '', mobile: '', floor: '', community: '', parking: '',
    items: DEFAULT_ITEMS,
    checks: {}, custom: {},
    inventory: [],
    remarks: ['', '', ''],
    agentName: '', signDate: '',
  });
  const upd = (patch) => setD((p) => ({ ...p, ...(typeof patch === 'function' ? patch(p) : patch) }));
  const set = (k) => (e) => upd({ [k]: e.target.value });

  const sections = useMemo(() => buildSections(d), [d.layout, d.villaBeds, d.baths, d.balcony, d.maid, d.custom]);
  const blocks = useMemo(() => buildBlocks(d, sections), [d, sections]);

  // measurement → pagination
  const [heights, setHeights] = useState(null);
  const onHeights = (h) => setHeights((prev) => {
    if (prev && Object.keys(h).length === Object.keys(prev).length && Object.keys(h).every((k) => Math.abs((prev[k] || 0) - h[k]) < 0.5)) return prev;
    return h;
  });
  const [fontTick, setFontTick] = useState(0);
  useEffect(() => { document.fonts && document.fonts.ready.then(() => setFontTick((t) => t + 1)); }, []);
  const pages = useMemo(() => (heights ? paginate(blocks, heights) : [[...blocks.map((b) => ({ kind: 'b', block: b }))]]), [blocks, heights, fontTick]);

  // checklist helpers
  const setCheck = (id, patch) => upd((p) => ({ checks: { ...p.checks, [id]: { ...(p.checks[id] || {}), ...patch } } }));
  const markAllGood = () => upd((p) => {
    const c = { ...p.checks };
    sections.forEach((s) => s.items.forEach((it) => { c[it.id] = { ...(c[it.id] || {}), s: 'good' }; }));
    return { checks: c };
  });
  const clearChecks = () => upd((p) => {
    const c = { ...p.checks };
    sections.forEach((s) => s.items.forEach((it) => { c[it.id] = { ...(c[it.id] || {}), s: '' }; }));
    return { checks: c };
  });
  const addCustom = (key) => upd((p) => ({ custom: { ...p.custom, [key]: [...(p.custom[key] || []), { id: uid(), label: 'Custom item' }] } }));
  const renameCustom = (key, id, label) => upd((p) => ({ custom: { ...p.custom, [key]: p.custom[key].map((c) => (c.id === id ? { ...c, label } : c)) } }));
  const removeCustom = (key, id) => upd((p) => ({ custom: { ...p.custom, [key]: p.custom[key].filter((c) => c.id !== id) } }));

  const total = sections.reduce((a, s) => a + s.items.length, 0);
  const done = sections.reduce((a, s) => a + s.items.filter((it) => (d.checks[it.id] || {}).s).length, 0);
  const repairs = sections.reduce((a, s) => a + s.items.filter((it) => (d.checks[it.id] || {}).s === 'repair').length, 0);

  // inventory
  const addInv = (item) => upd((p) => ({ inventory: [...p.inventory, { id: uid(), item, location: '', qty: '1', cond: '', notes: '' }] }));
  const updInv = (id, k, v) => upd((p) => ({ inventory: p.inventory.map((r) => (r.id === id ? { ...r, [k]: v } : r)) }));
  const rooms = sections.filter((s) => s.key !== 'general').map((s) => s.title);

  const [printMsg, setPrintMsg] = useState('');
  const doPrint = () => {
    try { window.print(); setPrintMsg('If no print dialog appeared, this viewer blocks printing — open the .html file in Chrome/Edge and press Ctrl/Cmd + P.'); }
    catch (e) { setPrintMsg('Printing is blocked in this viewer — open the .html file in your browser and press Ctrl/Cmd + P.'); }
  };

  return (
    <div className="min-h-screen">
      <header className="no-print cw-topbar text-white">
        <div className="max-w-[1500px] mx-auto px-5 py-3 flex items-center gap-4">
          <div>
            <div className="font-head font-bold tracking-wide">Unit Handover &amp; Inspection Form</div>
            <div className="text-[12px] text-blue-100">Template #7 · adapts to unit layout & furnishing · multi-page A4</div>
          </div>
          <button onClick={doPrint} className="ml-auto btn-brand text-navy font-semibold text-sm px-4 py-2 rounded-lg whitespace-nowrap">Print / Save as PDF</button>
        </div>
        {printMsg && <div className="max-w-[1500px] mx-auto px-5 pb-3 text-[12px] text-blue-100">{printMsg}</div>}
      </header>

      <main className="max-w-[1500px] mx-auto p-5 grid gap-5 lg:grid-cols-[480px_1fr] items-start">
        {/* ---------------- FORM ---------------- */}
        <div className="no-print space-y-4 lg:max-h-[calc(100vh-110px)] lg:overflow-y-auto lg:pr-1">
          <Card title="Handover Setup">
            <Seg options={[['in', 'Move-In Handover'], ['out', 'Move-Out Inspection']]} value={d.mode} onChange={(v) => upd({ mode: v })} />
            <div className="grid grid-cols-2 gap-3">
              <Field label="Ref. No."><Input value={d.refNo} onChange={set('refNo')} /></Field>
              <Field label="Date"><Input type="date" value={d.date} onChange={set('date')} /></Field>
            </div>
            <Field label="Unit Layout"><Seg options={LAYOUTS} value={d.layout} onChange={(v) => upd({ layout: v })} cols={5} /></Field>
            <div className="grid grid-cols-2 gap-3">
              {d.layout === '4+ BR / Villa' && <Field label="Bedrooms"><Input type="number" min="4" max="10" value={d.villaBeds} onChange={set('villaBeds')} /></Field>}
              {d.layout !== 'Studio' && <Field label="Bathrooms" hint={`Blank = ${bedroomCount(d)} (one per bedroom)`}><Input type="number" min="1" max="10" value={d.baths} onChange={set('baths')} placeholder={String(bedroomCount(d))} /></Field>}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Switch on={d.balcony} onChange={(v) => upd({ balcony: v })} label="Balcony / Terrace" />
              <Switch on={d.maid} onChange={(v) => upd({ maid: v })} label="Maid's / Storage Room" />
            </div>
            <Field label="Furnishing Status"><Seg options={['Unfurnished', 'Semi-Furnished', 'Fully Furnished']} value={d.furnishing} onChange={(v) => upd({ furnishing: v })} /></Field>
            <div className="text-[12px] rounded-md bg-brand-soft text-navy p-2">Preview: <b>{pages.length} A4 page{pages.length > 1 ? 's' : ''}</b> · {sections.length} checklist areas · {total} items</div>
          </Card>

          <Card title="1 · Tenant & Unit Details">
            <div className="grid grid-cols-2 gap-2">
              <Field label="Tenant Name"><Input value={d.tenantName} onChange={set('tenantName')} /></Field>
              <Field label="Emirates ID No."><Input value={d.eid} onChange={set('eid')} placeholder="784-XXXX-XXXXXXX-X" /></Field>
              <Field label="Nationality"><Input value={d.nationality} onChange={set('nationality')} /></Field>
              <Field label="Mobile No."><Input value={d.mobile} onChange={set('mobile')} /></Field>
              <Field label="Unit / Property No."><Input value={d.unit} onChange={set('unit')} /></Field>
              <Field label="Floor No."><Input value={d.floor} onChange={set('floor')} /></Field>
              <Field label="Building"><Input value={d.building} onChange={set('building')} /></Field>
              <Field label="Community"><Input value={d.community} onChange={set('community')} /></Field>
              <Field label="Owner"><Input value={d.owner} onChange={set('owner')} /></Field>
              <Field label="Parking No."><Input value={d.parking} onChange={set('parking')} /></Field>
            </div>
          </Card>

          <Card title={d.mode === 'in' ? '2 · Items Handed Over' : '2 · Items Returned'}>
            {d.items.map((it) => (
              <div key={it.id} className="grid gap-2 items-end" style={{ gridTemplateColumns: '1fr 60px 1fr 24px' }}>
                <Input value={it.item} onChange={(e) => upd((p) => ({ items: p.items.map((x) => (x.id === it.id ? { ...x, item: e.target.value } : x)) }))} />
                <Input value={it.qty} placeholder="Qty" onChange={(e) => upd((p) => ({ items: p.items.map((x) => (x.id === it.id ? { ...x, qty: e.target.value } : x)) }))} />
                <Input value={it.serial} placeholder="Card / Serial No(s)." onChange={(e) => upd((p) => ({ items: p.items.map((x) => (x.id === it.id ? { ...x, serial: e.target.value } : x)) }))} />
                <button type="button" title="Remove" onClick={() => upd((p) => ({ items: p.items.filter((x) => x.id !== it.id) }))} className="text-red-500 hover:text-red-700 text-lg leading-none pb-2">×</button>
              </div>
            ))}
            <button type="button" onClick={() => upd((p) => ({ items: [...p.items, { id: uid(), item: '', qty: '', serial: '' }] }))} className="w-full border-2 border-dashed border-brand text-navy font-semibold text-sm py-2 rounded-lg hover:bg-brand-soft transition">+ Add Handover Item</button>
          </Card>

          {d.furnishing !== 'Unfurnished' && (
            <Card title="Furniture & Appliances" right={<span className="text-[11px] text-slate-500">{d.inventory.length} items</span>}>
              <div className="flex flex-wrap gap-1.5">
                {PRESETS.map((p) => <button key={p} type="button" onClick={() => addInv(p)} className="text-[12px] font-semibold px-2.5 py-1 rounded-full bg-brand-soft text-navy hover:bg-brand hover:text-white transition">+ {p}</button>)}
                <button type="button" onClick={() => addInv('')} className="text-[12px] font-semibold px-2.5 py-1 rounded-full border border-dashed border-navy text-navy hover:bg-slate-50">+ Custom Item</button>
              </div>
              <datalist id="rooms">{rooms.map((r) => <option key={r} value={r} />)}</datalist>
              {d.inventory.map((r) => (
                <div key={r.id} className="rounded-lg border border-slate-200 p-2.5 space-y-2 bg-slate-50/60">
                  <div className="grid gap-2" style={{ gridTemplateColumns: '1fr 1fr 56px 24px' }}>
                    <Input value={r.item} placeholder="Item description" onChange={(e) => updInv(r.id, 'item', e.target.value)} />
                    <input list="rooms" className="field-in" value={r.location} placeholder="Location / Room" onChange={(e) => updInv(r.id, 'location', e.target.value)} />
                    <Input value={r.qty} placeholder="Qty" onChange={(e) => updInv(r.id, 'qty', e.target.value)} />
                    <button type="button" title="Remove" onClick={() => upd((p) => ({ inventory: p.inventory.filter((x) => x.id !== r.id) }))} className="text-red-500 hover:text-red-700 text-lg leading-none">×</button>
                  </div>
                  <div className="grid gap-2 items-center" style={{ gridTemplateColumns: '150px 1fr' }}>
                    <div className="grid grid-cols-2 gap-1">
                      {[['good', 'Good', 'bg-emerald-600'], ['repair', 'Repair', 'bg-amber-500']].map(([v, l, c]) => (
                        <button key={v} type="button" onClick={() => updInv(r.id, 'cond', r.cond === v ? '' : v)} className={`text-[12px] font-semibold py-1.5 rounded-md border transition ${r.cond === v ? c + ' text-white border-transparent' : 'border-slate-200 text-slate-600 bg-white'}`}>{l}</button>
                      ))}
                    </div>
                    <Input value={r.notes} placeholder="Notes" onChange={(e) => updInv(r.id, 'notes', e.target.value)} />
                  </div>
                </div>
              ))}
            </Card>
          )}

          <Card title="Condition Checklist" right={<span className="text-[11px] text-slate-500">{done}/{total} done{repairs ? ` · ${repairs} repair` : ''}</span>}>
            <div className="grid grid-cols-[1fr_auto] gap-2">
              <button type="button" onClick={markAllGood} className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm py-2.5 rounded-lg transition">✓ Mark All Visible Items as Good</button>
              <button type="button" onClick={clearChecks} className="border border-slate-300 text-slate-600 font-semibold text-sm px-3 rounded-lg hover:bg-slate-50">Clear</button>
            </div>
            {sections.map((sec) => (
              <details key={sec.key} className="rounded-lg glass group" open={sec.items.some((it) => (d.checks[it.id] || {}).s === 'repair')}>
                <summary className="cursor-pointer list-none px-3 py-2 flex items-center justify-between bg-slate-50 rounded-lg">
                  <span className="text-[13px] font-bold text-navy">{sec.title}</span>
                  <span className="text-[11px] text-slate-500">{sec.items.filter((it) => (d.checks[it.id] || {}).s).length}/{sec.items.length} ▾</span>
                </summary>
                <div className="p-2 space-y-1.5">
                  {sec.items.map((it) => {
                    const st = d.checks[it.id] || {};
                    return (
                      <div key={it.id} className="space-y-1">
                        <div className="flex items-center gap-2">
                          {it.customId
                            ? <input className="field-in !py-1 !text-[13px] flex-1" value={it.label} onChange={(e) => renameCustom(sec.key, it.customId, e.target.value)} />
                            : <span className="text-[13px] flex-1">{it.label}</span>}
                          <div className="flex gap-1 flex-none">
                            {STATES.map(([v, l, c]) => (
                              <button key={v} type="button" onClick={() => setCheck(it.id, { s: st.s === v ? '' : v })}
                                className={`text-[11px] font-semibold w-[50px] py-1 rounded-md border transition ${st.s === v ? c + ' text-white border-transparent' : 'border-slate-200 text-slate-500 bg-white hover:bg-slate-50'}`}>{l}</button>
                            ))}
                          </div>
                          {it.customId && <button type="button" onClick={() => removeCustom(sec.key, it.customId)} className="text-red-500 text-lg leading-none">×</button>}
                        </div>
                        {(st.s === 'repair' || st.note) && <input className="field-in !py-1 !text-[12px]" placeholder="Notes" value={st.note || ''} onChange={(e) => setCheck(it.id, { note: e.target.value })} />}
                      </div>
                    );
                  })}
                  <button type="button" onClick={() => addCustom(sec.key)} className="text-[12px] text-navy font-semibold hover:underline">+ Add Custom Check Item</button>
                </div>
              </details>
            ))}
            <p className="text-[11px] text-slate-500">A notes box appears when an item is marked "Repair". Sections with repairs open automatically.</p>
          </Card>

          <Card title="Remarks / Defects Noted">
            {d.remarks.map((r, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="text-[12px] font-bold text-navy w-5">{i + 1}-</span>
                <Input value={r} placeholder="Leave blank for a handwritten line" onChange={(e) => upd((p) => ({ remarks: p.remarks.map((x, j) => (j === i ? e.target.value : x)) }))} />
                {d.remarks.length > 1 && <button type="button" onClick={() => upd((p) => ({ remarks: p.remarks.filter((_, j) => j !== i) }))} className="text-red-500 text-lg leading-none">×</button>}
              </div>
            ))}
            <button type="button" onClick={() => upd((p) => ({ remarks: [...p.remarks, ''] }))} className="text-[12px] text-navy font-semibold hover:underline">+ Add Line</button>
          </Card>

          <Card title="Signatures">
            <div className="grid grid-cols-2 gap-2">
              <Field label="Citiway Agent Name (optional)"><Input value={d.agentName} onChange={set('agentName')} /></Field>
              <Field label="Signing Date (optional)"><Input type="date" value={d.signDate} onChange={set('signDate')} /></Field>
            </div>
            <p className="text-[11px] text-slate-500">The tenant's name prints automatically under "{d.mode === 'in' ? 'Received by' : 'Returned by'} (Tenant)".</p>
          </Card>
        </div>

        {/* ---------------- PREVIEW ---------------- */}
        <div className="preview-col lg:sticky lg:top-5 lg:max-h-[calc(100vh-110px)] lg:overflow-y-auto">
          <div className="no-print flex items-center justify-between mb-3 px-1">
            <span className="text-[12px] font-semibold uppercase tracking-wider text-slate-500">Live A4 Preview · {pages.length} page{pages.length > 1 ? 's' : ''}</span>
            <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-navy text-white">{d.layout.toUpperCase()} · {d.furnishing.toUpperCase()}</span>
          </div>
          <ScaledPages pages={pages.map((items, i) => <Page key={i} items={items} num={i + 1} total={pages.length} d={d} />)} />
        </div>
      </main>
      <Measure blocks={blocks} d={d} onHeights={onHeights} />
    </div>
  );
}


export default App as React.ComponentType<any>;
