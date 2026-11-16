/* eslint-disable */
// @ts-nocheck — ported from the original single-file Citiway tool (Project Knowledge/citiway-deal-proposal.html)
'use client';
import React, { useState, useMemo, useEffect, useLayoutEffect, useRef, useCallback, Fragment } from 'react';
import qrcode from 'qrcode-generator';


const LOGO = "/assets/citiway-logo.png";
const COMPANY = { name: 'Citiway Real Estate Brokerage L.L.C.', license: 'License No. 726153, DED' };
const FOOTER =
  'Citiway Real Estate Brokerage L.L.C. | License No. 726153, DED | Office No. 205, Bayswater Tower, Business Bay, P.O. Box 34201, Dubai, UAE | Tel: +971 4 277 2373 / +971 4 277 2374 | Mobile: +971 52 771 3111 | info@citiway.com';
const MM = 96 / 25.4;

/* ---------------- helpers ---------------- */
const fmtDate = (iso) => { if (!iso) return ''; const [y, m, d] = iso.split('-'); return `${d}/${m}/${y}`; };
const isoPlus = (days) => { const t = new Date(); t.setDate(t.getDate() + days); return t.toISOString().slice(0, 10); };
const num = (v) => { const n = parseFloat(String(v).replace(/,/g, '')); return isFinite(n) ? n : 0; };
const r2 = (v) => Math.round(Number((v * 100).toPrecision(12))) / 100;
const aed = (n, dp = 0) => (isFinite(n) ? n : 0).toLocaleString('en-US', { minimumFractionDigits: dp, maximumFractionDigits: dp });
const AED = (n, dp = 0) => 'AED ' + aed(n, dp);
const pct = (n, dp = 2) => (isFinite(n) ? n : 0).toFixed(dp) + '%';
const uid = () => Math.random().toString(36).slice(2, 9);

const SALE_CHIPS = ['4% DLD Waiver', 'Post-Handover Plan', 'High Floor', 'Corner Unit', 'High ROI Potential', 'Close to Metro'];
const RENT_CHIPS = ['Grace Period Included', 'Chiller Free', 'Direct from Landlord', 'Newly Renovated', '2 Covered Parkings', 'Vacant & Ready'];
const PTYPES = ['Apartment', 'Villa', 'Townhouse', 'Penthouse', 'Office', 'Retail'];

/* ---------------- QR (vector SVG, generated locally) ---------------- */
function QR({ text, size = '22mm' }) {
  const svg = useMemo(() => {
    if (!text || typeof qrcode === 'undefined') return '';
    try { const q = qrcode(0, 'M'); q.addData(text); q.make(); return q.createSvgTag({ cellSize: 4, margin: 0, scalable: true }); }
    catch (e) { return ''; }
  }, [text]);
  if (!svg) return null;
  return <div style={{ width: size, height: size }} className="qr" dangerouslySetInnerHTML={{ __html: svg }} />;
}

/* ---------------- calculations ---------------- */
function useCalc(d) {
  return useMemo(() => {
    const area = num(d.area);
    if (d.mode === 'sale') {
      const P = num(d.price);
      const dld = r2(P * num(d.dldPct) / 100);
      const trustee = d.trusteeTouched ? num(d.trustee) : (P >= 500000 ? 4200 : P > 0 ? 2100 : 0);
      const com = r2(P * num(d.comPct) / 100);
      const vat = r2(com * num(d.vatPct) / 100);
      const noc = num(d.noc);
      const total = r2(P + dld + trustee + com + vat + noc);
      const fees = r2(total - P);
      const perSqft = area ? P / area : 0;
      // payment plan
      const plan = d.plan.map((m) => ({ ...m, amt: r2(P * num(m.pct) / 100) }));
      const planSum = d.plan.reduce((a, m) => a + num(m.pct), 0);
      // ROI
      const rent = num(d.roiRent);
      const svc = r2(area * num(d.svcRate));
      const net = r2(rent - svc);
      const roi = { gross: P ? rent / P * 100 : 0, svc, net, netRoi: total ? net / total * 100 : 0 };
      // mortgage
      const dp = r2(P * num(d.mDown) / 100);
      const loan = r2(P - dp);
      const rate = num(d.mRate) / 100 / 12, n = Math.round(num(d.mYears) * 12);
      const emi = loan > 0 && n > 0 ? (rate > 0 ? loan * rate / (1 - Math.pow(1 + rate, -n)) : loan / n) : 0;
      const mreg = loan > 0 ? r2(loan * 0.0025 + 290) : 0;
      const mort = { dp, loan, emi, mreg, cashUpfront: r2(dp + fees + mreg) };
      return { P, dld, trustee, com, vat, noc, total, fees, perSqft, plan, planSum, roi, mort, area };
    }
    const R = num(d.rent);
    const cheques = Math.max(1, parseInt(d.cheques, 10) || 1);
    const perCheque = r2(R / cheques);
    const deposit = r2(R * num(d.depPct) / 100);
    const com = r2(R * num(d.rComPct) / 100);
    const vat = r2(com * num(d.rVatPct) / 100);
    const ejari = num(d.ejari);
    const dewa = d.dewaTouched ? num(d.dewa) : (['Villa', 'Townhouse'].includes(d.ptype) ? 4000 : 2000);
    const moveIn = r2(perCheque + deposit + com + vat + ejari + dewa);
    return { R, cheques, perCheque, deposit, com, vat, ejari, dewa, moveIn, perSqft: area ? R / area : 0, area };
  }, [d]);
}

/* ---------------- Sheet atoms ---------------- */
const Sec = ({ children, right }) => (
  <div className="flex items-center justify-between" style={{ margin: '3.4mm 0 1.6mm' }}>
    <div className="flex items-center" style={{ gap: '2.4mm', fontFamily: 'Montserrat, sans-serif', fontWeight: 700, color: '#1E3553', fontSize: '9.6pt', letterSpacing: '.04em', textTransform: 'uppercase' }}>
      <span style={{ width: '1.2mm', height: '4mm', background: '#7AA3D8', borderRadius: '1mm' }} />{children}
    </div>
    {right}
  </div>
);
const tbl = { width: '100%', borderCollapse: 'separate', borderSpacing: 0, border: '1px solid #C9D9EE', borderRadius: '6px', overflow: 'hidden', fontSize: '8.6pt', tableLayout: 'fixed' };
const lblTd = { background: '#F4F8FC', color: '#1E3553', fontWeight: 600, fontSize: '7.7pt', padding: '1.25mm 2.2mm', borderBottom: '1px solid #E1E9F4', borderRight: '1px solid #E1E9F4', verticalAlign: 'top' };
const valTd = { padding: '1.25mm 2.2mm', borderBottom: '1px solid #E1E9F4', fontWeight: 600, color: '#1F2937', verticalAlign: 'top' };
const Blank = ({ v }) => (v ? <>{v}</> : <span style={{ color: '#CBD5E1' }}>—</span>);
function CostTable({ rows, total }) {
  return (
    <table style={tbl}>
      <colgroup><col style={{ width: '62%' }} /><col style={{ width: '38%' }} /></colgroup>
      <tbody>
        {rows.map(([k, v, sub], i) => (
          <tr key={i}>
            <td style={{ ...lblTd, fontWeight: 500, color: '#334155', background: '#fff' }}>{k}{sub && <span style={{ color: '#94A3B8', fontWeight: 400 }}> {sub}</span>}</td>
            <td style={{ ...valTd, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{v}</td>
          </tr>
        ))}
        <tr>
          <td style={{ background: '#1E3553', color: '#fff', fontWeight: 700, padding: '2.2mm 2.4mm', fontSize: '8.4pt' }}>{total[0]}</td>
          <td style={{ background: '#EAF1FA', color: '#1E3553', fontWeight: 800, padding: '2.2mm 2.4mm', textAlign: 'right', fontSize: '10.5pt', fontVariantNumeric: 'tabular-nums', borderTop: '1.5px solid #7AA3D8' }}>{total[1]}</td>
        </tr>
      </tbody>
    </table>
  );
}
function MiniCard({ title, rows, accent }) {
  return (
    <div style={{ background: '#EAF1FA', border: '1px solid #C9D9EE', borderRadius: '6px', padding: '2.2mm 3mm', marginBottom: '2.6mm' }}>
      <div style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 700, color: '#1E3553', fontSize: '7.8pt', letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: '1.4mm' }}>{title}</div>
      {rows.map(([k, v, strong], i) => (
        <div key={i} className="flex justify-between" style={{ fontSize: '8.2pt', padding: '0.7mm 0', borderTop: i ? '1px dashed #C9D9EE' : 'none' }}>
          <span style={{ color: '#475569' }}>{k}</span>
          <span style={{ fontWeight: strong ? 800 : 600, color: strong ? '#1E3553' : '#1F2937', fontVariantNumeric: 'tabular-nums' }}>{v}</span>
        </div>
      ))}
    </div>
  );
}

/* ---------------- The proposal body (measured + rendered) ---------------- */
function ProposalBody({ d, c }) {
  const sale = d.mode === 'sale';
  const offplan = sale && d.saleType === 'offplan';
  const ready = sale && !offplan;
  const badge = sale ? (offplan ? 'For Sale · Off-Plan' : 'For Sale · Ready') : 'For Rent';
  const perks = [...(sale ? d.perksSale : d.perksRent), ...(sale ? d.customSale : d.customRent)];
  const areaTxt = c.area ? `${aed(c.area)} sq ft` : '';
  const psf = c.perSqft ? ` · ${AED(c.perSqft)} ${sale ? '/ sq ft' : '/ sq ft / yr'}` : '';

  let condRows = [];
  if (ready) condRows = d.occupancy === 'rented'
    ? [['Occupancy Status', 'Rented'], ['Rent / Lease Expiry', `${num(d.curRent) ? AED(num(d.curRent)) + ' / yr' : '—'}  ·  ${d.leaseExp ? fmtDate(d.leaseExp) : '—'}`]]
    : [['Occupancy Status', 'Vacant on Transfer'], null];
  if (offplan) condRows = [['Developer', d.developer], ['Expected Handover', d.handover]];
  if (!sale) condRows = [['Chiller / AC', d.chiller], ['Available From', fmtDate(d.availFrom)]];

  const specPairs = [
    [['Project / Building', d.project], ['Community / Location', d.community]],
    [['Property Type', d.ptype], ['Unit / Plot No.', d.unitNo]],
    [['Layout', d.layout], ['Total Area', areaTxt ? <>{areaTxt}<span style={{ color: '#5E7FA8', fontWeight: 600 }}>{psf}</span></> : '']],
    [['View / Facing', d.view], ['Furnishing & Parking', d.furnParking]],
    condRows,
  ];

  const sideCards = [];
  if (sale && offplan) {
    sideCards.push(
      <div key="plan" style={{ marginBottom: '3mm' }}>
        <table style={tbl}>
          <colgroup><col style={{ width: '50%' }} /><col style={{ width: '16%' }} /><col style={{ width: '34%' }} /></colgroup>
          <thead><tr>{['Payment Plan', '%', 'AED'].map((h, i) => <th key={h} style={{ background: '#1E3553', color: '#fff', fontFamily: 'Montserrat, sans-serif', fontWeight: 600, fontSize: '7.2pt', letterSpacing: '.05em', textTransform: 'uppercase', padding: '1.6mm 2.4mm', textAlign: i ? 'right' : 'left' }}>{h}</th>)}</tr></thead>
          <tbody>{c.plan.map((m) => (
            <tr key={m.id}><td style={{ ...valTd, fontWeight: 500, fontSize: '8pt' }}>{m.label}</td><td style={{ ...valTd, textAlign: 'right', fontSize: '8pt' }}>{num(m.pct)}%</td><td style={{ ...valTd, textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontSize: '8pt' }}>{aed(m.amt)}</td></tr>))}
          </tbody>
        </table>
      </div>);
  }
  if (sale && d.roiOn) sideCards.push(<MiniCard key="roi" title="Investor Yield" rows={[
    ['Expected Annual Rent', AED(num(d.roiRent))], ['Gross Yield', pct(c.roi.gross)], ['Est. Annual Service Charge', AED(c.roi.svc)], ['Net Annual Income', AED(c.roi.net)], ['Net ROI (on total cost)', pct(c.roi.netRoi), true]]} />);
  if (ready && d.mortOn) sideCards.push(<MiniCard key="mort" title="Mortgage Estimate" rows={[
    [`Down Payment (${num(d.mDown)}%)`, AED(c.mort.dp)], ['Loan Amount', AED(c.mort.loan)], [`Monthly Installment · ${num(d.mRate)}% · ${num(d.mYears)} yrs`, AED(c.mort.emi) + '/mo', true], ['DLD Mortgage Reg. Fee (0.25% + AED 290)', AED(c.mort.mreg)], ['Est. Cash Required Upfront', AED(c.mort.cashUpfront), true]]} />);
  if (!sale) sideCards.push(<MiniCard key="chq" title="Payment Schedule" rows={[
    ['Annual Rent', AED(c.R)], ['Number of Cheques', String(c.cheques)], ['Amount per Cheque', AED(c.perCheque), true]]} />);

  const costRows = sale ? [
    ['Property Price', AED(c.P)],
    ['DLD Transfer Fee', AED(c.dld), `(${num(d.dldPct)}%)`],
    ['Registration Trustee Fee', AED(c.trustee), '(incl. VAT)'],
    ['Agency Commission', AED(c.com), `(${num(d.comPct)}%)`],
    ['VAT on Commission', AED(c.vat), `(${num(d.vatPct)}%)`],
    ...(c.noc ? [['NOC / Admin Fee', AED(c.noc)]] : []),
  ] : [
    ['First Cheque', AED(c.perCheque), `(1 of ${c.cheques})`],
    ['Security Deposit', AED(c.deposit), `(${num(d.depPct)}%, refundable)`],
    ['Agency Commission', AED(c.com), `(${num(d.rComPct)}%)`],
    ['VAT on Commission', AED(c.vat), `(${num(d.rVatPct)}%)`],
    ['Ejari Registration', AED(c.ejari)],
    ['DEWA Deposit', AED(c.dewa), '(refundable)'],
  ];
  const total = sale ? ['Total Estimated Acquisition Cost', AED(c.total)] : ['Total Estimated Move-In Cost', AED(c.moveIn)];

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <img src={LOGO} alt="Citiway Real Estate" style={{ height: '13mm' }} />
          <div style={{ marginTop: '2.6mm', fontSize: '8.4pt', lineHeight: 1.5 }}>
            <div style={{ fontWeight: 600, color: '#1E3553' }}>{COMPANY.name}</div><div>{COMPANY.license}</div>
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 800, color: '#1E3553', textTransform: 'uppercase', fontSize: '16pt', letterSpacing: '.05em', lineHeight: 1.1 }}>Property &amp; Deal Proposal</div>
          <div style={{ fontSize: '8.8pt', color: '#5E7FA8', fontWeight: 500, marginTop: '1.2mm' }}>{sale ? 'Exclusive Sales & Investment Proposal' : 'Exclusive Leasing Proposal'}</div>
          <table style={{ marginLeft: 'auto', marginTop: '2.4mm', fontSize: '8.6pt', borderCollapse: 'collapse' }}>
            <tbody>
              {[['Proposal Ref.', d.ref], ['Date', fmtDate(d.date)], ['Valid Until', fmtDate(d.validUntil)]].map(([k, v]) => (
                <tr key={k}><td style={{ color: '#64748B', textAlign: 'right', padding: '0.6mm 3mm 0.6mm 0' }}>{k}</td><td style={{ fontWeight: 600, color: '#1E3553', borderBottom: '1px solid #C9D9EE', padding: '0.6mm 2mm', minWidth: '33mm', textAlign: 'left' }}><Blank v={v} /></td></tr>))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Client strip */}
      <div className="flex items-center justify-between" style={{ marginTop: '4mm', background: '#EAF1FA', borderLeft: '1.2mm solid #1E3553', borderRadius: '0 6px 6px 0', padding: '2.4mm 4mm' }}>
        <div style={{ fontSize: '9pt' }}>
          <span style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 700, color: '#5E7FA8', fontSize: '7.6pt', letterSpacing: '.08em', textTransform: 'uppercase', marginRight: '3mm' }}>Prepared For</span>
          <span style={{ fontWeight: 700, color: '#1E3553' }}><Blank v={d.client} /></span>
          {d.clientContact && <span style={{ color: '#475569' }}>&nbsp;·&nbsp;{d.clientContact}</span>}
        </div>
        <span style={{ background: '#1E3553', color: '#fff', fontSize: '7.4pt', fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', borderRadius: '1mm', padding: '0.9mm 2.4mm', whiteSpace: 'nowrap' }}>{badge}</span>
      </div>

      {/* Photo */}
      {d.photo && <img src={d.photo} alt="Property" style={{ display: 'block', width: '100%', maxHeight: '36mm', height: '36mm', objectFit: 'cover', borderRadius: '6px', marginTop: '3.5mm' }} />}

      {/* Specs */}
      <Sec>Property Overview</Sec>
      <table style={tbl}>
        <colgroup><col style={{ width: '20%' }} /><col style={{ width: '30%' }} /><col style={{ width: '20%' }} /><col style={{ width: '30%' }} /></colgroup>
        <tbody>
          {specPairs.map((pair, i) => (
            <tr key={i}>
              {pair.map((cell, j) => cell
                ? <React.Fragment key={j}><td style={lblTd}>{cell[0]}</td><td style={{ ...valTd, borderRight: j === 0 ? '1px solid #E1E9F4' : 'none' }}><Blank v={cell[1]} /></td></React.Fragment>
                : <React.Fragment key={j}><td style={{ ...lblTd, background: '#fff' }}></td><td style={valTd}></td></React.Fragment>)}
            </tr>
          ))}
        </tbody>
      </table>
      {perks.length > 0 && (
        <div className="flex flex-wrap" style={{ gap: '1.6mm', marginTop: '2.4mm' }}>
          {perks.map((p, i) => <span key={i} style={{ fontSize: '7.6pt', fontWeight: 600, color: '#1E3553', background: '#EAF1FA', border: '1px solid #C9D9EE', borderRadius: '99px', padding: '0.8mm 2.6mm' }}>✓ {p}</span>)}
        </div>
      )}

      {/* Financials */}
      <Sec>{sale ? 'Acquisition Cost Breakdown' : 'Move-In Cost Breakdown'}</Sec>
      <div className="flex" style={{ gap: '5mm', alignItems: 'flex-start' }}>
        <div style={{ flex: sideCards.length ? 1.12 : 1 }}><CostTable rows={costRows} total={total} /></div>
        {sideCards.length > 0 && <div style={{ flex: 0.88 }}>{sideCards}</div>}
      </div>

      {/* Agent + QR + disclaimer */}
      <div className="flex" style={{ gap: '5mm', marginTop: '4mm', alignItems: 'stretch' }}>
        <div style={{ flex: 1, border: '1px solid #C9D9EE', borderRadius: '6px', padding: '2.6mm 3.5mm' }}>
          <div style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 700, color: '#1E3553', fontSize: '7.8pt', letterSpacing: '.06em', textTransform: 'uppercase' }}>Your Citiway Advisor</div>
          <div style={{ fontWeight: 700, fontSize: '9.6pt', color: '#1F2937', marginTop: '1mm' }}><Blank v={d.agent} /></div>
          <div style={{ fontSize: '8.2pt', color: '#475569', marginTop: '0.4mm' }}>{[d.agentMobile, d.agentEmail].filter(Boolean).join('  ·  ') || '—'}</div>
          <p style={{ fontSize: '6.8pt', color: '#64748B', lineHeight: 1.45, marginTop: '1.8mm', textAlign: 'justify' }}>
            This proposal is for information only and does not constitute an offer or a binding agreement. All figures are estimates in AED based on information available on the date above and are subject to change, final verification{sale ? ', lender approval' : ''} and the applicable DLD / RERA requirements. Valid until {fmtDate(d.validUntil) || '—'}.
          </p>
        </div>
        {d.qrUrl && (
          <div style={{ width: '32mm', border: '1px solid #C9D9EE', borderRadius: '6px', padding: '2.4mm', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <QR text={d.qrUrl} />
            <div style={{ fontSize: '7pt', fontWeight: 700, color: '#1E3553', marginTop: '1.2mm', letterSpacing: '.04em', textTransform: 'uppercase' }}>Scan for {d.qrLabel}</div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------------- Page with fit-to-one-A4 ---------------- */
const BODY_TOP = 11 * MM, FOOT_BOTTOM = 7 * MM, GAP = 4 * MM;
function Sheet({ d, c, fit }) {
  return (
    <div id="print-root" className="a4" style={{ padding: 0, display: 'block', position: 'relative' }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '1.6mm', background: 'linear-gradient(90deg,#1E3553 0%,#1E3553 62%,#7AA3D8 62%,#7AA3D8 100%)' }} />
      <div style={{ position: 'absolute', top: '11mm', left: '14mm', width: '182mm' }}>
        <div style={{ zoom: fit }}><ProposalBody d={d} c={c} /></div>
      </div>
      <div style={{ position: 'absolute', left: '14mm', right: '14mm', bottom: '7mm' }}>
        <div style={{ height: '0.6mm', background: 'linear-gradient(90deg,#1E3553,#7AA3D8)', borderRadius: '1mm', marginBottom: '2.4mm' }} />
        <p style={{ textAlign: 'center', fontSize: '7.2pt', lineHeight: 1.55, color: '#555', margin: 0 }}>{FOOTER}</p>
      </div>
    </div>
  );
}
function ScaledA4({ children }) {
  const ref = useRef(null);
  const [scale, setScale] = useState(0.7);
  useEffect(() => {
    const el = ref.current;
    const ro = new ResizeObserver(() => setScale(Math.min(1.1, Math.max(0.3, (el.clientWidth - 32) / 794))));
    ro.observe(el); return () => ro.disconnect();
  }, []);
  return (
    <div ref={ref} className="w-full">
      <div className="scaler" style={{ width: 794 * scale, height: 1123 * scale, margin: '0 auto' }}>
        <div className="scaler" style={{ transform: `scale(${scale})`, transformOrigin: 'top left', width: 794, boxShadow: '0 12px 40px rgba(30,53,83,.18)', borderRadius: 4, overflow: 'hidden' }}>{children}</div>
      </div>
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
function Input(props) { return <input {...props} className="field-in" />; }
function Card({ title, right, children }) {
  return (
    <section className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
      <div className="flex items-center justify-between mb-3 gap-2">
        <h3 className="font-head font-bold text-[13px] uppercase tracking-wider text-navy flex items-center gap-2"><span className="w-1 h-4 rounded bg-brand inline-block" />{title}</h3>{right}
      </div>
      <div className="space-y-3">{children}</div>
    </section>
  );
}
function Seg({ options, value, onChange }) {
  return (
    <div className="grid gap-1 p-1 bg-slate-100 rounded-lg" style={{ gridTemplateColumns: `repeat(${options.length},minmax(0,1fr))` }}>
      {options.map(([v, l]) => <button key={v} type="button" onClick={() => onChange(v)} className={`py-2 px-1 rounded-md text-[13px] font-semibold transition ${value === v ? 'bg-navy text-white shadow' : 'text-slate-600 hover:bg-white'}`}>{l}</button>)}
    </div>
  );
}
function Switch({ on, onChange, label }) {
  return (
    <button type="button" onClick={() => onChange(!on)} className="flex items-center gap-2.5 w-full rounded-lg border border-slate-200 px-3 py-2.5 hover:bg-slate-50 transition">
      <span className={`relative w-10 h-[22px] rounded-full transition flex-none ${on ? 'bg-navy' : 'bg-slate-300'}`}><span className={`absolute top-[3px] w-4 h-4 rounded-full bg-white shadow transition-all ${on ? 'left-[21px]' : 'left-[3px]'}`} /></span>
      <span className="text-[13px] font-semibold text-ink text-left">{label}</span>
      <span className={`ml-auto text-[11px] font-bold px-2 py-0.5 rounded ${on ? 'bg-brand-soft text-navy' : 'bg-slate-100 text-slate-500'}`}>{on ? 'ON' : 'OFF'}</span>
    </button>
  );
}

/* ---------------- App ---------------- */
function App() {
  const [d, setD] = useState({
    mode: 'sale', saleType: 'ready',
    ref: 'CW-PRP-2026-0001', date: isoPlus(0), validUntil: isoPlus(7),
    client: 'Mr. Ahmed Al Mansoori', clientContact: '+971 50 123 4567',
    photo: '',
    project: 'Peninsula Four', community: 'Business Bay, Dubai', ptype: 'Apartment', unitNo: 'Unit 2304',
    layout: '2 BR + Maid', area: '1450', view: 'Canal & Burj Khalifa View', furnParking: 'Fully Furnished · 1 Parking',
    occupancy: 'vacant', curRent: '', leaseExp: '',
    developer: 'Select Group', handover: 'Q2 2029',
    chiller: 'Chiller Free', availFrom: isoPlus(14),
    perksSale: ['High Floor', 'Close to Metro'], perksRent: ['Chiller Free', 'Vacant & Ready'], customSale: [], customRent: [],
    price: '3200000', dldPct: '4', trustee: '4200', trusteeTouched: false, comPct: '2', vatPct: '5', noc: '0',
    plan: [{ id: uid(), label: 'Down Payment', pct: '20' }, { id: uid(), label: 'During Construction', pct: '30' }, { id: uid(), label: 'On Handover', pct: '50' }],
    roiOn: false, roiRent: '190000', svcRate: '18',
    mortOn: false, mDown: '20', mRate: '4.25', mYears: '25',
    rent: '165000', cheques: '4', depPct: '5', rComPct: '5', rVatPct: '5', ejari: '220', dewa: '2000', dewaTouched: false,
    agent: '', agentMobile: '', agentEmail: '',
    qrUrl: '', qrLabel: 'Location',
  });
  const upd = (patch) => setD((p) => ({ ...p, ...(typeof patch === 'function' ? patch(p) : patch) }));
  const set = (k) => (e) => upd({ [k]: e.target.value });
  const c = useCalc(d);
  const sale = d.mode === 'sale', offplan = sale && d.saleType === 'offplan', ready = sale && !offplan;
  const [custom, setCustom] = useState('');

  // fit-to-one-page measurement
  const measRef = useRef(null);
  const [natural, setNatural] = useState(0);
  const [fontTick, setFontTick] = useState(0);
  useEffect(() => { document.fonts && document.fonts.ready.then(() => setFontTick((t) => t + 1)); }, []);
  useLayoutEffect(() => {
    const el = measRef.current; if (!el) return;
    const h = el.getBoundingClientRect().height;
    if (Math.abs(h - natural) > 0.5) setNatural(h);
  });
  // footer ≈ 13mm; body starts at 11mm; footer bottom at 7mm
  const avail = 297 * MM - BODY_TOP - FOOT_BOTTOM - 13 * MM - GAP;
  const fit = natural > avail ? Math.max(0.6, avail / natural) : 1;

  const onPhoto = (e) => {
    const f = e.target.files && e.target.files[0]; if (!f) return;
    const r = new FileReader(); r.onload = () => upd({ photo: r.result }); r.readAsDataURL(f);
  };
  const chips = sale ? SALE_CHIPS : RENT_CHIPS;
  const perkKey = sale ? 'perksSale' : 'perksRent', customKey = sale ? 'customSale' : 'customRent';
  const togglePerk = (p) => upd((s) => ({ [perkKey]: s[perkKey].includes(p) ? s[perkKey].filter((x) => x !== p) : [...s[perkKey], p] }));
  const planOk = Math.abs(c.planSum - 100) < 0.01;

  const [printMsg, setPrintMsg] = useState('');
  const doPrint = () => {
    try { window.print(); setPrintMsg('If no print dialog appeared, this viewer blocks printing — open the .html file in Chrome/Edge and press Ctrl/Cmd + P.'); }
    catch (e) { setPrintMsg('Printing is blocked in this viewer — open the .html file in your browser and press Ctrl/Cmd + P.'); }
  };

  return (
    <div className="min-h-screen">
      <header className="no-print bg-navy text-white">
        <div className="max-w-[1500px] mx-auto px-5 py-3 flex items-center gap-4">
          <div className="bg-white rounded-md px-2 py-1"><img src={LOGO} alt="Citiway" style={{ height: 28, width: 'auto', display: 'block' }} /></div>
          <div>
            <div className="font-head font-bold tracking-wide">Property &amp; Deal Proposal</div>
            <div className="text-[12px] text-blue-100">Template #9 · Sale / Off-Plan / Rental · 1-page A4</div>
          </div>
          <button onClick={doPrint} className="ml-auto bg-brand hover:bg-white transition text-navy font-semibold text-sm px-4 py-2 rounded-lg whitespace-nowrap">Print / Save as PDF</button>
        </div>
        {printMsg && <div className="max-w-[1500px] mx-auto px-5 pb-3 text-[12px] text-blue-100">{printMsg}</div>}
      </header>

      <main className="max-w-[1500px] mx-auto p-5 grid gap-5 lg:grid-cols-[470px_1fr] items-start">
        {/* ---------------- FORM ---------------- */}
        <div className="no-print space-y-4 lg:max-h-[calc(100vh-110px)] lg:overflow-y-auto lg:pr-1">
          <Card title="Transaction">
            <Seg options={[['sale', 'Sale Proposal'], ['rent', 'Rental Proposal']]} value={d.mode} onChange={(v) => upd({ mode: v })} />
            {sale && <Seg options={[['ready', 'Ready / Secondary'], ['offplan', 'Off-Plan']]} value={d.saleType} onChange={(v) => upd({ saleType: v })} />}
            <div className="grid grid-cols-3 gap-2">
              <Field label="Proposal Ref."><Input value={d.ref} onChange={set('ref')} /></Field>
              <Field label="Date"><Input type="date" value={d.date} onChange={set('date')} /></Field>
              <Field label="Valid Until"><Input type="date" value={d.validUntil} onChange={set('validUntil')} /></Field>
            </div>
          </Card>

          <Card title="Prepared For">
            <div className="grid grid-cols-2 gap-2">
              <Field label="Client Name"><Input value={d.client} onChange={set('client')} /></Field>
              <Field label="Client Mobile / Email (optional)"><Input value={d.clientContact} onChange={set('clientContact')} /></Field>
            </div>
          </Card>

          <Card title="Property">
            <Field label="Upload Property / Project Photo — Optional">
              <div className="flex items-center gap-2">
                <input type="file" accept="image/*" onChange={onPhoto} className="text-[12px] flex-1" />
                {d.photo && <button type="button" onClick={() => upd({ photo: '' })} className="text-[12px] text-red-600 hover:underline">Remove</button>}
              </div>
            </Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Project / Building Name"><Input value={d.project} onChange={set('project')} /></Field>
              <Field label="Community / Location"><Input value={d.community} onChange={set('community')} /></Field>
              <Field label="Property Type">
                <select className="field-in" value={d.ptype} onChange={set('ptype')}>{PTYPES.map((p) => <option key={p}>{p}</option>)}</select>
              </Field>
              <Field label="Unit / Plot No."><Input value={d.unitNo} onChange={set('unitNo')} /></Field>
              <Field label="Layout"><Input value={d.layout} onChange={set('layout')} /></Field>
              <Field label="Total Area (Sq. Ft.)" hint={c.perSqft ? `${AED(c.perSqft)} ${sale ? 'per sq ft' : 'per sq ft / yr'}` : ''}><Input type="number" min="0" value={d.area} onChange={set('area')} /></Field>
              <Field label="View / Facing"><Input value={d.view} onChange={set('view')} /></Field>
              <Field label="Furnishing & Parking"><Input value={d.furnParking} onChange={set('furnParking')} /></Field>
            </div>
            {ready && (<>
              <Field label="Occupancy Status"><Seg options={[['vacant', 'Vacant on Transfer'], ['rented', 'Rented']]} value={d.occupancy} onChange={(v) => upd({ occupancy: v })} /></Field>
              {d.occupancy === 'rented' && <div className="grid grid-cols-2 gap-2">
                <Field label="Current Rent (AED/yr)"><Input type="number" min="0" value={d.curRent} onChange={set('curRent')} /></Field>
                <Field label="Lease Expiry"><Input type="date" value={d.leaseExp} onChange={set('leaseExp')} /></Field>
              </div>}
            </>)}
            {offplan && <div className="grid grid-cols-2 gap-2">
              <Field label="Developer Name"><Input value={d.developer} onChange={set('developer')} /></Field>
              <Field label="Expected Handover"><Input value={d.handover} onChange={set('handover')} placeholder="e.g. Q2 2029" /></Field>
            </div>}
            {!sale && <>
              <Field label="Chiller / AC Status"><Seg options={[['Chiller Free', 'Chiller Free'], ['Tenant Pays DEWA / Cooling', 'Tenant Pays DEWA / Cooling']]} value={d.chiller} onChange={(v) => upd({ chiller: v })} /></Field>
              <Field label="Available From"><Input type="date" value={d.availFrom} onChange={set('availFrom')} /></Field>
            </>}
          </Card>

          <Card title="Deal Perks & Highlights">
            <div className="flex flex-wrap gap-1.5">
              {chips.map((p) => {
                const on = d[perkKey].includes(p);
                return <button key={p} type="button" onClick={() => togglePerk(p)} className={`text-[12px] font-semibold px-2.5 py-1 rounded-full border transition ${on ? 'bg-navy text-white border-navy' : 'bg-white text-navy border-brand-line hover:bg-brand-soft'}`}>{on ? '✓ ' : '+ '}{p}</button>;
              })}
            </div>
            <div className="flex gap-2">
              <Input value={custom} placeholder="Custom highlight" onChange={(e) => setCustom(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && custom.trim()) { e.preventDefault(); upd((s) => ({ [customKey]: [...s[customKey], custom.trim()] })); setCustom(''); } }} />
              <button type="button" onClick={() => { if (custom.trim()) { upd((s) => ({ [customKey]: [...s[customKey], custom.trim()] })); setCustom(''); } }} className="px-3 rounded-lg bg-brand-soft text-navy font-semibold text-sm whitespace-nowrap">+ Add</button>
            </div>
            {d[customKey].length > 0 && <div className="flex flex-wrap gap-1.5">{d[customKey].map((p, i) => (
              <span key={i} className="text-[12px] font-semibold px-2.5 py-1 rounded-full bg-navy text-white">{p} <button type="button" onClick={() => upd((s) => ({ [customKey]: s[customKey].filter((_, j) => j !== i) }))} className="ml-1 opacity-70 hover:opacity-100">×</button></span>))}</div>}
          </Card>

          {sale ? (
            <Card title="Acquisition Costs" right={<span className="text-[12px] font-bold text-navy">{AED(c.total)}</span>}>
              <Field label="Property Price (AED)"><Input type="number" min="0" value={d.price} onChange={set('price')} /></Field>
              <div className="grid grid-cols-2 gap-2">
                <Field label="DLD Transfer Fee %">
                  <div className="flex gap-1"><Input type="number" min="0" step="0.01" value={d.dldPct} onChange={set('dldPct')} />
                    <button type="button" onClick={() => upd({ dldPct: d.dldPct === '0' ? '4' : '0' })} className={`text-[11px] font-semibold px-2 rounded-lg whitespace-nowrap ${d.dldPct === '0' ? 'bg-emerald-600 text-white' : 'bg-brand-soft text-navy'}`}>0% Waiver</button></div>
                </Field>
                <Field label="Trustee Fee (AED)" hint={d.trusteeTouched ? <button type="button" className="underline" onClick={() => upd({ trusteeTouched: false })}>Reset to auto</button> : 'Auto: 4,200 if ≥ 500k, else 2,100'}>
                  <Input type="number" min="0" value={d.trusteeTouched ? d.trustee : String(c.trustee)} onChange={(e) => upd({ trustee: e.target.value, trusteeTouched: true })} />
                </Field>
                <Field label="Agency Commission %"><Input type="number" min="0" step="0.01" value={d.comPct} onChange={set('comPct')} /></Field>
                <Field label="VAT on Commission %"><Input type="number" min="0" step="0.01" value={d.vatPct} onChange={set('vatPct')} /></Field>
                <Field label="NOC / Admin Fee (AED)"><Input type="number" min="0" value={d.noc} onChange={set('noc')} /></Field>
              </div>
              {offplan && (
                <div className="rounded-lg border border-slate-200 p-3 space-y-2 bg-slate-50/60">
                  <div className="flex items-center justify-between">
                    <span className="text-[12px] font-bold text-navy">Payment Plan</span>
                    <span className={`text-[11px] font-bold px-2 py-0.5 rounded ${planOk ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-800'}`}>{planOk ? '✓ 100%' : `⚠ ${aed(c.planSum, 2)}% — must total 100%`}</span>
                  </div>
                  {d.plan.map((m, i) => (
                    <div key={m.id} className="grid gap-2 items-center" style={{ gridTemplateColumns: '1fr 70px 100px 20px' }}>
                      <Input value={m.label} onChange={(e) => upd((s) => ({ plan: s.plan.map((x) => (x.id === m.id ? { ...x, label: e.target.value } : x)) }))} />
                      <Input type="number" min="0" step="0.01" value={m.pct} onChange={(e) => upd((s) => ({ plan: s.plan.map((x) => (x.id === m.id ? { ...x, pct: e.target.value } : x)) }))} />
                      <span className="text-[12px] text-right font-semibold text-navy tabular-nums">{aed(c.plan[i].amt)}</span>
                      <button type="button" onClick={() => upd((s) => ({ plan: s.plan.filter((x) => x.id !== m.id) }))} className="text-red-500 text-lg leading-none">×</button>
                    </div>
                  ))}
                  <button type="button" onClick={() => upd((s) => ({ plan: [...s.plan, { id: uid(), label: 'Milestone', pct: '0' }] }))} className="text-[12px] text-navy font-semibold hover:underline">+ Add Milestone</button>
                </div>
              )}
              <Switch on={d.roiOn} onChange={(v) => upd({ roiOn: v })} label="Investor ROI & Net Yield" />
              {d.roiOn && <div className="grid grid-cols-2 gap-2">
                <Field label="Expected Annual Rent (AED)"><Input type="number" min="0" value={d.roiRent} onChange={set('roiRent')} /></Field>
                <Field label="Service Charge (AED / Sq. Ft.)"><Input type="number" min="0" step="0.01" value={d.svcRate} onChange={set('svcRate')} /></Field>
              </div>}
              {ready && <Switch on={d.mortOn} onChange={(v) => upd({ mortOn: v })} label="Mortgage Estimator" />}
              {ready && d.mortOn && <div className="grid grid-cols-3 gap-2">
                <Field label="Down Payment %"><Input type="number" min="0" max="100" value={d.mDown} onChange={set('mDown')} /></Field>
                <Field label="Interest Rate %"><Input type="number" min="0" step="0.01" value={d.mRate} onChange={set('mRate')} /></Field>
                <Field label="Tenure (Years)"><Input type="number" min="1" max="30" value={d.mYears} onChange={set('mYears')} /></Field>
              </div>}
            </Card>
          ) : (
            <Card title="Move-In Costs" right={<span className="text-[12px] font-bold text-navy">{AED(c.moveIn)}</span>}>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Annual Rent (AED)"><Input type="number" min="0" value={d.rent} onChange={set('rent')} /></Field>
                <Field label="Number of Cheques">
                  <select className="field-in" value={d.cheques} onChange={set('cheques')}>{['1', '2', '3', '4', '6', '12'].map((x) => <option key={x}>{x}</option>)}</select>
                </Field>
                <Field label="Security Deposit %" hint="Common: 5% unfurnished · 10% furnished">
                  <div className="flex gap-1"><Input type="number" min="0" step="0.01" value={d.depPct} onChange={set('depPct')} />
                    {['5', '10'].map((v) => <button key={v} type="button" onClick={() => upd({ depPct: v })} className={`text-[11px] font-semibold px-2 rounded-lg ${d.depPct === v ? 'bg-navy text-white' : 'bg-brand-soft text-navy'}`}>{v}%</button>)}</div>
                </Field>
                <Field label="Agency Commission %"><Input type="number" min="0" step="0.01" value={d.rComPct} onChange={set('rComPct')} /></Field>
                <Field label="VAT on Commission %"><Input type="number" min="0" step="0.01" value={d.rVatPct} onChange={set('rVatPct')} /></Field>
                <Field label="Ejari Registration (AED)"><Input type="number" min="0" value={d.ejari} onChange={set('ejari')} /></Field>
                <Field label="DEWA Deposit (AED)" hint={d.dewaTouched ? <button type="button" className="underline" onClick={() => upd({ dewaTouched: false })}>Reset to auto</button> : 'Auto: 2,000 apartment · 4,000 villa/townhouse'}>
                  <Input type="number" min="0" value={d.dewaTouched ? d.dewa : String(c.dewa)} onChange={(e) => upd({ dewa: e.target.value, dewaTouched: true })} />
                </Field>
              </div>
            </Card>
          )}

          <Card title="Advisor & QR Code">
            <div className="grid grid-cols-3 gap-2">
              <Field label="Agent Name"><Input value={d.agent} onChange={set('agent')} /></Field>
              <Field label="Mobile"><Input value={d.agentMobile} onChange={set('agentMobile')} /></Field>
              <Field label="Email"><Input value={d.agentEmail} onChange={set('agentEmail')} /></Field>
            </div>
            <div className="grid gap-2" style={{ gridTemplateColumns: '1fr 140px' }}>
              <Field label="QR Link (optional)" hint="Google Maps pin, YouTube / Matterport tour, or listing URL. Leave blank to hide the QR."><Input value={d.qrUrl} onChange={set('qrUrl')} placeholder="https://…" /></Field>
              <Field label="QR Label"><select className="field-in" value={d.qrLabel} onChange={set('qrLabel')}>{['Location', 'Video Tour', '360° Tour', 'Full Listing'].map((x) => <option key={x}>{x}</option>)}</select></Field>
            </div>
          </Card>
        </div>

        {/* ---------------- PREVIEW ---------------- */}
        <div className="lg:sticky lg:top-5">
          <div className="no-print flex items-center justify-between mb-3 px-1">
            <span className="text-[12px] font-semibold uppercase tracking-wider text-slate-500">Live A4 Preview</span>
            <span className="flex gap-2">
              {fit < 1 && <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-800" title="Content was scaled down to keep the proposal on one A4 page">Fitted to 1 page · {Math.round(fit * 100)}%</span>}
              <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-navy text-white">{sale ? (offplan ? 'SALE · OFF-PLAN' : 'SALE · READY') : 'RENTAL'}</span>
            </span>
          </div>
          <ScaledA4><Sheet d={d} c={c} fit={fit} /></ScaledA4>
        </div>
      </main>

      {/* hidden natural-height measurement */}
      <div className="no-print" aria-hidden="true" style={{ position: 'absolute', left: -20000, top: 0, width: '182mm', visibility: 'hidden' }}>
        <div ref={measRef}><ProposalBody d={d} c={c} /></div>
      </div>
    </div>
  );
}


export default App as React.ComponentType<any>;
