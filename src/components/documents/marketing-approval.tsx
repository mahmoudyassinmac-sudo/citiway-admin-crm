/* eslint-disable */
// @ts-nocheck — ported from the original single-file Citiway tool (Project Knowledge/citiway-marketing-approval Update .html)
'use client';
import React, { useState, useMemo, useEffect, useLayoutEffect, useRef, useCallback, Fragment } from 'react';


const LOGO = "/assets/citiway-logo.png";

const COMPANY = {
  name: 'Citiway Real Estate Brokerage L.L.C.',
  license: 'License No. 726153, DED',
};
const FOOTER =
  'Citiway Real Estate Brokerage L.L.C. | License No. 726153, DED | Office No. 205, Bayswater Tower, Business Bay, P.O. Box 34201, Dubai, UAE | Tel: +971 4 277 2373 / +971 4 277 2374 | Mobile: +971 52 771 3111 | info@citiway.com';

/* ---------- Number → words (same logic as Template #1) ---------- */
const ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve',
  'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
function below1000(n) {
  let s = '';
  if (n >= 100) { s += ONES[Math.floor(n / 100)] + ' Hundred'; n %= 100; if (n) s += ' '; }
  if (n >= 20) { s += TENS[Math.floor(n / 10)]; if (n % 10) s += '-' + ONES[n % 10]; }
  else if (n > 0) s += ONES[n];
  return s;
}
function intToWords(n) {
  if (n === 0) return 'Zero';
  const scales = [[1e9, 'Billion'], [1e6, 'Million'], [1e3, 'Thousand']];
  let out = [];
  for (const [v, name] of scales) {
    if (n >= v) { out.push(below1000(Math.floor(n / v)) + ' ' + name); n %= v; }
  }
  if (n > 0) out.push(below1000(n));
  return out.join(' ');
}
function amountInWords(total) {
  if (!total || total <= 0) return '';
  const cents = Math.round(total * 100);
  const dh = Math.floor(cents / 100);
  const fils = cents % 100;
  let s = intToWords(dh) + (dh === 1 ? ' Dirham' : ' Dirhams');
  if (fils) s += ' and ' + intToWords(fils) + (fils === 1 ? ' Fil' : ' Fils');
  return s + ' Only';
}

const money = (n) => (isFinite(n) ? n : 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtDate = (iso) => { if (!iso) return ''; const [y, m, d] = iso.split('-'); return `${d}/${m}/${y}`; };
const today = () => new Date().toISOString().slice(0, 10);

/* ---------- Form atoms (same as Template #1) ---------- */
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
function Card({ title, children }) {
  return (
    <section className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-head font-bold text-[13px] uppercase tracking-wider text-navy flex items-center gap-2">
          <span className="w-1 h-4 rounded bg-brand inline-block" />{title}
        </h3>
      </div>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

/* ---------- Helpers specific to Template #3 ---------- */
const aed = (n) => (isFinite(n) ? n : 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
const VALIDITY = ['3 Months', '6 Months', '12 Months', 'Until Sold / Leased'];
function validUntil(iso, v) {
  const m = parseInt(v, 10);
  if (!iso || !m) return '';
  const [y, mo, d] = iso.split('-').map(Number);
  const dt = new Date(Date.UTC(y, mo - 1 + m, d));
  dt.setUTCDate(dt.getUTCDate() - 1);
  return fmtDate(dt.toISOString().slice(0, 10));
}
const CLAUSE =
  'I, the undersigned, being the legal Landlord/Owner (or duly authorized representative) of the subject property detailed above, hereby authorize Citiway Real Estate Brokerage L.L.C. to advertise and market the property across its marketing portals and channels in accordance with Dubai Land Department (DLD) and RERA regulations at the agreed price/rent stated above. I undertake to notify Citiway Real Estate Brokerage L.L.C. in writing of any changes to the price, availability, or property status.';

/* Crisp checkbox for the A4 sheet */
function Check({ on, label }) {
  return (
    <span className="inline-flex items-center" style={{ gap: '2mm', marginRight: '8mm' }}>
      <span style={{
        width: '3.8mm', height: '3.8mm', borderRadius: '0.8mm', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        border: on ? '1.5px solid #1E3553' : '1.5px solid #9DB8DE', background: on ? '#1E3553' : '#fff',
      }}>
        {on && (
          <svg viewBox="0 0 12 12" style={{ width: '2.8mm', height: '2.8mm' }}>
            <path d="M2.2 6.3 4.8 8.8 9.8 3.4" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </span>
      <span className={on ? 'font-semibold text-navy' : 'text-slate-500'}>{label}</span>
    </span>
  );
}

/* Segmented toggle for the form */
function Segmented({ options, value, onChange }) {
  return (
    <div className="grid gap-1 p-1 bg-slate-100 rounded-lg" style={{ gridTemplateColumns: `repeat(${options.length},1fr)` }}>
      {options.map((o) => (
        <button key={o} type="button" onClick={() => onChange(o)}
          className={`py-2 rounded-md text-sm font-semibold transition ${value === o ? 'bg-navy text-white shadow' : 'text-slate-600 hover:bg-white'}`}>{o}</button>
      ))}
    </div>
  );
}

/* ---------- The A4 approval form ---------- */
function Approval({ d, calc }) {
  const Blank = ({ v }) => (v ? <>{v}</> : <span className="text-slate-300">—</span>);
  const priceLabel = d.availableFor === 'Sale' ? 'Agreed Sale Price (AED)' : 'Agreed Annual Rent (AED)';
  const until = validUntil(d.date, d.validity);
  const area = d.area && isFinite(Number(d.area.replace(/,/g, ''))) ? aed(Number(d.area.replace(/,/g, ''))) : d.area;
  const sigLabel = { fontSize: '8.6pt', letterSpacing: '.06em' };
  const sigBox = { marginTop: '2mm', height: '19mm', border: '1px dashed #9DB8DE', borderRadius: '6px', background: '#FAFCFE' };
  const sigLine = { marginTop: '2.5mm', borderBottom: '1px solid #7AA3D8', paddingBottom: '1.2mm', fontSize: '9.4pt', minHeight: '5mm' };
  const pd = { width: '33mm' };
  const wide = { width: '54mm' };
  const vline = { borderRight: '1px solid #E1E9F4' };

  return (
    <div id="print-root" className="a4 font-body text-ink">
      {/* top accent */}
      <div style={{ height: '1.6mm', margin: '-12mm -14mm 9mm', background: 'linear-gradient(90deg,#1E3553 0%,#1E3553 62%,#7AA3D8 62%,#7AA3D8 100%)' }} />

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <img src={LOGO} alt="Citiway Real Estate" style={{ height: '14mm' }} />
          <div style={{ marginTop: '3mm', fontSize: '8.6pt', lineHeight: 1.55 }}>
            <div className="font-semibold text-navy">{COMPANY.name}</div>
            <div>{COMPANY.license}</div>
          </div>
        </div>
        <div className="text-right">
          <div className="font-head font-extrabold text-navy uppercase" style={{ fontSize: '22pt', letterSpacing: '.08em', lineHeight: 1 }}>
            Marketing Approval
          </div>
          <div className="font-medium" style={{ fontSize: '9pt', color: '#5E7FA8', marginTop: '1.6mm', letterSpacing: '.02em' }}>
            Owner Authorization to Market Property
          </div>
          <table className="ml-auto" style={{ marginTop: '3mm', fontSize: '9pt', borderCollapse: 'collapse' }}>
            <tbody>
              <tr>
                <td className="text-slate-500 font-medium pr-3 py-[1mm] text-right">Ref. No.</td>
                <td className="font-semibold text-navy num text-left border-b border-brand-line px-2 py-[1mm]" style={{ minWidth: '34mm' }}><Blank v={d.refNo} /></td>
              </tr>
              <tr>
                <td className="text-slate-500 font-medium pr-3 py-[1mm] text-right">Date</td>
                <td className="font-semibold text-navy num text-left border-b border-brand-line px-2 py-[1mm]"><Blank v={fmtDate(d.date)} /></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Landlord / Seller */}
      <div className="sec" style={{ marginTop: '6mm' }}>Landlord / Seller Details</div>
      <table className="rt">
        <tbody>
          <tr><td className="lbl" style={wide}>Landlord / Seller Full Name</td><td className="font-semibold"><Blank v={d.ownerName} /></td></tr>
          <tr><td className="lbl">Emirates ID / Passport No.</td><td className="num"><Blank v={d.ownerId} /></td></tr>
          <tr><td className="lbl">Contact (Mobile / Email)</td><td><Blank v={d.ownerContact} /></td></tr>
        </tbody>
      </table>

      {/* Property & Marketing Terms */}
      <div className="sec">Property &amp; Marketing Terms</div>
      <table className="rt">
        <tbody>
          <tr>
            <td className="lbl">Property Category</td>
            <td><Check on={d.category === 'Residential'} label="Residential" /><Check on={d.category === 'Commercial'} label="Commercial" /></td>
          </tr>
          <tr>
            <td className="lbl">Available For</td>
            <td><Check on={d.availableFor === 'Sale'} label="Sale" /><Check on={d.availableFor === 'Rent'} label="Rent" /></td>
          </tr>
          <tr className="total">
            <td className="lbl">{priceLabel}</td>
            <td className="num" style={{ fontSize: '11pt' }}>AED {aed(calc.amount)}</td>
          </tr>
          <tr><td className="lbl">Amount in Words</td><td className="italic font-medium text-navy"><Blank v={calc.words} /></td></tr>
          <tr>
            <td className="lbl">Authorization Validity</td>
            <td className="font-semibold">{d.validity}{until && <span className="font-normal text-slate-500" style={{ fontSize: '8.8pt' }}> &nbsp;(valid until {until})</span>}</td>
          </tr>
        </tbody>
      </table>

      {/* Property details — two-pair grid */}
      <div className="sec">Property Details</div>
      <table className="rt">
        <tbody>
          <tr>
            <td className="lbl" style={pd}>Title Deed No.</td><td className="num" style={vline}><Blank v={d.titleDeed} /></td>
            <td className="lbl" style={pd}>Land / Plot No.</td><td className="num"><Blank v={d.plot} /></td>
          </tr>
          <tr>
            <td className="lbl" style={pd}>Unit / Villa No.</td><td style={vline}><Blank v={d.unit} /></td>
            <td className="lbl" style={pd}>Building / Project</td><td><Blank v={d.building} /></td>
          </tr>
          <tr>
            <td className="lbl" style={pd}>Community</td><td style={vline}><Blank v={d.community} /></td>
            <td className="lbl" style={pd}>Area (Sq. Ft.)</td><td className="num"><Blank v={area} /></td>
          </tr>
        </tbody>
      </table>

      {/* Authorization clause */}
      <div style={{ marginTop: '5mm', background: '#EAF1FA', borderLeft: '1.2mm solid #7AA3D8', borderRadius: '0 6px 6px 0', padding: '3.5mm 4.5mm' }}>
        <div className="font-head font-bold text-navy uppercase" style={{ fontSize: '8.4pt', letterSpacing: '.06em', marginBottom: '1.5mm' }}>Owner Authorization</div>
        <p style={{ fontSize: '9pt', lineHeight: 1.6, textAlign: 'justify', color: '#2F3B4A' }}>{CLAUSE}</p>
      </div>

      {/* Signatures */}
      <div className="flex justify-between" style={{ marginTop: '5mm', gap: '12mm' }}>
        <div style={{ flex: 1 }}>
          <div className="font-head font-semibold text-navy uppercase" style={sigLabel}>Landlord / Seller Signature</div>
          <div style={sigBox} />
          <div style={sigLine} className="font-medium">
            <span className="text-slate-500 font-normal" style={{ fontSize: '8pt' }}>Name: </span>{d.ownerName}
          </div>
        </div>
        <div style={{ flex: 1 }} />
      </div>

      {/* Footer */}
      <div style={{ marginTop: 'auto', paddingTop: '4mm' }}>
        <div style={{ height: '0.6mm', background: 'linear-gradient(90deg,#1E3553,#7AA3D8)', borderRadius: '1mm', marginBottom: '2.6mm' }} />
        <p className="text-center" style={{ fontSize: '7.4pt', lineHeight: 1.6, color: '#555' }}>{FOOTER}</p>
      </div>
    </div>
  );
}

/* ---------- Scaled preview wrapper (same as Template #1) ---------- */
function ScaledA4({ children }) {
  const ref = useRef(null);
  const [scale, setScale] = useState(0.7);
  useEffect(() => {
    const el = ref.current;
    const ro = new ResizeObserver(() => {
      const w = el.clientWidth - 32;
      setScale(Math.min(1.1, Math.max(0.3, w / 794)));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return (
    <div ref={ref} className="w-full">
      <div className="scaler" style={{ width: 794 * scale, height: 1123 * scale, margin: '0 auto' }}>
        <div className="scaler" style={{ transform: `scale(${scale})`, transformOrigin: 'top left', width: 794, boxShadow: '0 12px 40px rgba(30,53,83,.18)', borderRadius: 4, overflow: 'hidden' }}>
          {children}
        </div>
      </div>
    </div>
  );
}

/* ---------- App ---------- */
function App() {
  const [d, setD] = useState({
    refNo: 'CW-MA-2026-0001',
    date: today(),
    ownerName: 'Omar Hassan Al Suwaidi',
    ownerId: '',
    ownerContact: '+971 55 987 6543 / omar.h@email.com',
    category: 'Residential',
    availableFor: 'Sale',
    price: '1850000',
    validity: '6 Months',
    titleDeed: '', plot: '',
    unit: 'Unit 1204',
    building: 'Bayswater Tower',
    community: 'Business Bay',
    area: '1250',
  });
  const set = (k) => (e) => setD((p) => ({ ...p, [k]: e && e.target ? e.target.value : e }));
  const [printMsg, setPrintMsg] = useState('');

  const calc = useMemo(() => {
    const amount = Math.round((parseFloat(d.price) || 0) * 100) / 100;
    return { amount, words: amountInWords(amount) };
  }, [d.price]);
  const priceLabel = d.availableFor === 'Sale' ? 'Agreed Sale Price (AED)' : 'Agreed Annual Rent (AED)';

  const doPrint = () => {
    try {
      window.print();
      setPrintMsg('If no print dialog appeared, this viewer blocks printing — open the .html file in Chrome/Edge and press Ctrl/Cmd + P.');
    } catch (e) {
      setPrintMsg('Printing is blocked in this viewer — open the .html file in your browser and press Ctrl/Cmd + P.');
    }
  };

  return (
    <div className="min-h-screen">
      <header className="no-print bg-navy text-white">
        <div className="max-w-[1500px] mx-auto px-5 py-3 flex items-center gap-4">
          <div className="bg-white rounded-md px-2 py-1"><img src={LOGO} alt="Citiway" className="h-7" /></div>
          <div>
            <div className="font-head font-bold tracking-wide">Marketing Approval Generator</div>
            <div className="text-[12px] text-blue-100">Template #3 · Owner Authorization to Market Property</div>
          </div>
          <button onClick={doPrint} className="ml-auto bg-brand hover:bg-white hover:text-navy transition text-navy font-semibold text-sm px-4 py-2 rounded-lg">
            Print / Save as PDF
          </button>
        </div>
        {printMsg && <div className="max-w-[1500px] mx-auto px-5 pb-3 text-[12px] text-blue-100">{printMsg}</div>}
      </header>

      <main className="max-w-[1500px] mx-auto p-5 grid gap-5 lg:grid-cols-[440px_1fr] items-start">
        {/* ---- FORM ---- */}
        <div className="no-print space-y-4 lg:max-h-[calc(100vh-110px)] lg:overflow-y-auto lg:pr-1">
          <Card title="Document Info">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Ref. No."><Input value={d.refNo} onChange={set('refNo')} /></Field>
              <Field label="Date"><Input type="date" value={d.date} onChange={set('date')} /></Field>
            </div>
          </Card>

          <Card title="Landlord / Seller">
            <Field label="Landlord / Seller Full Name"><Input value={d.ownerName} onChange={set('ownerName')} /></Field>
            <Field label="Emirates ID / Passport No."><Input value={d.ownerId} onChange={set('ownerId')} placeholder="784-XXXX-XXXXXXX-X" /></Field>
            <Field label="Contact (Mobile / Email)"><Input value={d.ownerContact} onChange={set('ownerContact')} /></Field>
          </Card>

          <Card title="Property & Marketing Terms">
            <Field label="Property Category"><Segmented options={['Residential', 'Commercial']} value={d.category} onChange={(v) => setD((p) => ({ ...p, category: v }))} /></Field>
            <Field label="Available For"><Segmented options={['Sale', 'Rent']} value={d.availableFor} onChange={(v) => setD((p) => ({ ...p, availableFor: v }))} /></Field>
            <Field label={priceLabel}><Input type="number" min="0" step="0.01" value={d.price} onChange={set('price')} /></Field>
            <div className="rounded-lg bg-brand-soft p-3 text-sm space-y-1">
              <div className="flex justify-between font-bold text-navy"><span>{priceLabel.replace(' (AED)', '')}</span><span className="num">AED {aed(calc.amount)}</span></div>
              <div className="text-[12px] italic text-navy pt-1">{calc.words || '—'}</div>
            </div>
            <Field label="Authorization Validity Period" hint="For fixed periods, the expiry date is calculated from the document date.">
              <select className="field-in" value={d.validity} onChange={set('validity')}>
                {VALIDITY.map((v) => <option key={v}>{v}</option>)}
              </select>
            </Field>
          </Card>

          <Card title="Property Details">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Title Deed No."><Input value={d.titleDeed} onChange={set('titleDeed')} /></Field>
              <Field label="Land / Plot No."><Input value={d.plot} onChange={set('plot')} /></Field>
              <Field label="Unit / Villa No."><Input value={d.unit} onChange={set('unit')} /></Field>
              <Field label="Building / Project Name"><Input value={d.building} onChange={set('building')} /></Field>
              <Field label="Community"><Input value={d.community} onChange={set('community')} /></Field>
              <Field label="Area (Sq. Ft.)"><Input value={d.area} onChange={set('area')} inputMode="decimal" /></Field>
            </div>
          </Card>

          <Card title="Signature">
            <p className="text-[12px] text-slate-500">The landlord's name prints automatically under their signature box.</p>
          </Card>
        </div>

        {/* ---- PREVIEW ---- */}
        <div className="lg:sticky lg:top-5">
          <div className="no-print flex items-center justify-between mb-3 px-1">
            <span className="text-[12px] font-semibold uppercase tracking-wider text-slate-500">Live A4 Preview</span>
            <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-navy text-white">FOR {d.availableFor.toUpperCase()}</span>
          </div>
          <ScaledA4><Approval d={d} calc={calc} /></ScaledA4>
        </div>
      </main>
    </div>
  );
}


export default App as React.ComponentType<any>;
