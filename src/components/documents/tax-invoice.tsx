/* eslint-disable */
// @ts-nocheck — ported from the original single-file Citiway tool (Project Knowledge/citiway-tax-invoice.html)
'use client';
import { PartyPicker, useIssueDocument } from '@/components/documents/crm-bridge';
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


/* ---------- Invoice helpers ---------- */
// Round half-up to 2 decimals, robust to float noise (2525.985 → 2525.99)
const r2 = (v) => Math.round(Number((v * 100).toPrecision(12))) / 100;
const aed = (n) => (isFinite(n) ? n : 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
const pct = (v) => (v === '' || v == null ? '' : `${Number(v)}%`);
const CLAIM_TYPES = ['FULL', 'PARTIAL', '50% INSTALLMENT', 'FINAL INSTALLMENT'];
const blankRow = () => ({ id: Math.random().toString(36).slice(2), unit: '', price: '', claim: 'FULL', com: '', vat: '5' });
function calcRow(r) {
  const price = parseFloat(r.price) || 0;
  const com = r2(price * (parseFloat(r.com) || 0) / 100);
  const vat = r2(com * (parseFloat(r.vat) || 0) / 100);
  return { price, com, vat, incl: r2(com + vat) };
}

/* ---------- The A4 tax invoice ---------- */
function Invoice({ d, rows, totals }) {
  const Blank = ({ v }) => (v ? <>{v}</> : <span className="text-slate-300">—</span>);
  const th = { padding: '1.8mm 1.4mm', fontSize: '7pt', lineHeight: 1.25, textAlign: 'center', verticalAlign: 'middle' };
  const td = { padding: '1.7mm 1.4mm', fontSize: '8.2pt', textAlign: 'right', verticalAlign: 'middle' };
  const tdc = { ...td, textAlign: 'center' };
  const bankRows = [
    ['Beneficiary Name', d.bank.beneficiary],
    ['Name of Bank', d.bank.bankName],
    ['Branch / Bank Address', d.bank.address],
    ['Type of Account', d.bank.type],
    ['Currency', d.bank.currency],
    ['Account Number', d.bank.account],
    ['IBAN Number', d.bank.iban],
  ];
  const info = (label, v) => (
    <div className="flex" style={{ gap: '2mm' }}>
      <span className="text-slate-500" style={{ width: '13mm', flex: 'none' }}>{label}</span>
      <span className="font-medium">{v}</span>
    </div>
  );

  return (
    <div id="print-root" className="a4 font-body text-ink">
      {/* top accent */}
      <div style={{ height: '1.6mm', margin: '-12mm -14mm 8mm', background: 'linear-gradient(90deg,#1E3553 0%,#1E3553 62%,#7AA3D8 62%,#7AA3D8 100%)' }} />

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <img src={LOGO} alt="Citiway Real Estate" style={{ height: '13mm' }} />
          <div style={{ marginTop: '2.6mm', fontSize: '8pt', lineHeight: 1.5 }}>
            <div className="font-semibold text-navy" style={{ fontSize: '8.8pt' }}>{COMPANY.name}</div>
            <div>Agency TRN: <span className="font-semibold num">{d.agencyTrn || '—'}</span></div>
            <div>205, Bayswater Tower, Business Bay, P.O. Box 34201, Dubai, UAE</div>
            <div className="text-slate-600" style={{ fontSize: '7.6pt' }}>
              Tel: +971 4 277 2373 &nbsp;|&nbsp; Fax: +971 4 277 2374 &nbsp;|&nbsp; info@citiway.com &nbsp;|&nbsp; www.citiway.com
            </div>
          </div>
        </div>
        <div className="text-right" style={{ flex: 'none' }}>
          <div className="font-head font-extrabold text-navy uppercase" style={{ fontSize: '22pt', letterSpacing: '.08em', lineHeight: 1 }}>Tax Invoice</div>
          <table className="ml-auto" style={{ marginTop: '4mm', fontSize: '9pt', borderCollapse: 'collapse' }}>
            <tbody>
              <tr>
                <td className="text-slate-500 font-medium pr-3 py-[1mm] text-right">Invoice Number</td>
                <td className="font-semibold text-navy num text-left border-b border-brand-line px-2 py-[1mm]" style={{ minWidth: '32mm' }}><Blank v={d.invNo} /></td>
              </tr>
              <tr>
                <td className="text-slate-500 font-medium pr-3 py-[1mm] text-right">Invoice Date</td>
                <td className="font-semibold text-navy num text-left border-b border-brand-line px-2 py-[1mm]"><Blank v={fmtDate(d.invDate)} /></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Invoiced To */}
      <div className="sec" style={{ marginTop: '6mm' }}>Invoiced To</div>
      <table className="rt">
        <tbody>
          <tr><td className="lbl">Client / Developer Name</td><td className="font-semibold"><Blank v={d.client} /></td></tr>
          <tr><td className="lbl">Address</td><td style={{ whiteSpace: 'pre-line' }}><Blank v={d.clientAddress} /></td></tr>
          <tr><td className="lbl">Client TRN</td><td className="num"><Blank v={d.clientTrn} /></td></tr>
        </tbody>
      </table>

      {/* Commission table */}
      <div className="sec">Commission Details</div>
      <table className="rt" style={{ tableLayout: 'fixed' }}>
        <colgroup>
          <col style={{ width: '20%' }} /><col style={{ width: '12.5%' }} /><col style={{ width: '12%' }} /><col style={{ width: '7%' }} />
          <col style={{ width: '13.5%' }} /><col style={{ width: '6.5%' }} /><col style={{ width: '12%' }} /><col style={{ width: '16.5%' }} />
        </colgroup>
        <thead>
          <tr>
            <th style={{ ...th, textAlign: 'left' }}>Unit Number</th>
            <th style={th}>Selling Price (AED)</th>
            <th style={th}>Claim Type</th>
            <th style={th}>Com. %</th>
            <th style={th}>Commission Amt (AED)</th>
            <th style={th}>VAT %</th>
            <th style={th}>VAT (AED)</th>
            <th style={th}>Incl. VAT (AED)</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ r, c }) => (
            <tr key={r.id}>
              <td style={{ ...td, textAlign: 'left', fontWeight: 600, wordBreak: 'break-word' }}><Blank v={r.unit} /></td>
              <td className="num" style={td}>{c.price ? aed(c.price) : '—'}</td>
              <td style={{ ...tdc, fontSize: '7.4pt', fontWeight: 600 }}>{r.claim}</td>
              <td className="num" style={tdc}>{pct(r.com) || '—'}</td>
              <td className="num" style={td}>{money(c.com)}</td>
              <td className="num" style={tdc}>{pct(r.vat) || '—'}</td>
              <td className="num" style={td}>{money(c.vat)}</td>
              <td className="num font-semibold" style={td}>{money(c.incl)}</td>
            </tr>
          ))}
          <tr className="total">
            <td style={{ ...td, textAlign: 'left', background: '#1E3553', color: '#fff' }}>Total</td>
            <td className="num" style={td}>{aed(totals.price)}</td>
            <td style={td}></td>
            <td style={td}></td>
            <td className="num" style={td}>{money(totals.com)}</td>
            <td style={td}></td>
            <td className="num" style={td}>{money(totals.vat)}</td>
            <td className="num" style={{ ...td, fontSize: '9.4pt' }}>{money(totals.incl)}</td>
          </tr>
        </tbody>
      </table>
      <div style={{ marginTop: '2.4mm', fontSize: '8.8pt' }} className="flex" >
        <span className="font-semibold text-navy" style={{ width: '33mm', flex: 'none' }}>Amount in Words:</span>
        <span className="italic font-medium text-navy">{totals.words || '—'}</span>
      </div>

      {/* Banking + Summary */}
      <div className="grid" style={{ gridTemplateColumns: '1.15fr 0.85fr', gap: '6mm', marginTop: '1mm' }}>
        <div>
          <div className="sec">Banking Details</div>
          <table className="rt">
            <tbody>
              {bankRows.map(([k, v]) => (
                <tr key={k}><td className="lbl" style={{ width: '38mm', padding: '1.5mm 2.6mm', whiteSpace: 'nowrap' }}>{k}</td><td className="num" style={{ padding: '1.5mm 2.6mm', fontSize: '8.6pt' }}><Blank v={v} /></td></tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex flex-col">
          <div className="sec">Invoice Summary</div>
          <table className="rt">
            <tbody>
              <tr><td className="lbl" style={{ width: 'auto' }}>Total Commission Excl. VAT</td><td className="num" style={{ textAlign: 'right' }}>{money(totals.com)}</td></tr>
              <tr><td className="lbl" style={{ width: 'auto' }}>VAT Amount</td><td className="num" style={{ textAlign: 'right' }}>{money(totals.vat)}</td></tr>
              <tr className="total"><td className="lbl" style={{ width: 'auto' }}>Total Incl. VAT (AED)</td><td className="num" style={{ fontSize: '10.5pt', textAlign: 'right' }}>{money(totals.incl)}</td></tr>
            </tbody>
          </table>

          {/* Signatory */}
          <div className="flex-1 flex flex-col items-center justify-end" style={{ marginTop: '3mm' }}>
            <div style={{ height: '31mm', width: '100%', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
            </div>
            <div style={{ width: '100%', borderTop: '1px solid #7AA3D8', marginTop: '1mm', paddingTop: '1.2mm', textAlign: 'center', fontSize: '7.8pt' }}>
              <div className="font-head font-semibold text-navy uppercase" style={{ letterSpacing: '.06em', fontSize: '7.6pt' }}>Authorized Signatory &amp; Stamp</div>
              <div className="text-slate-500">For {COMPANY.name}</div>
            </div>
          </div>
        </div>
      </div>

      <p className="text-slate-500" style={{ marginTop: '4mm', fontSize: '7.6pt' }}>
        Please quote the invoice number as the payment reference. This is a tax invoice issued in accordance with UAE VAT regulations.
      </p>

      {/* Footer */}
      <div style={{ marginTop: 'auto', paddingTop: '3mm' }}>
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
const DEFAULT_BANK = {
  beneficiary: 'Citiway Real Estate Brokerage L.L.C.',
  bankName: 'Abu Dhabi Islamic Bank (ADIB)',
  address: 'Sheikh Zayed Road, Dubai',
  type: 'Current',
  currency: 'AED',
  account: '19420159',
  iban: 'AE480500000000019420159',
};

function App({ company = {}, clients = [], developers = [], initial = {} }) {
  const [d, setD] = useState({
    invNo: 'CW-S-2611008',
    invDate: today(),
    agencyTrn: company.trn || '100281605400003',
    client: 'Azizi Developments LLC',
    clientAddress: 'Conrad Business Tower\nDubai, UAE',
    clientTrn: '100223654300003',
    rows: [{ id: 'r1', unit: 'AZIZI LEILY - 1306', price: '721710', claim: 'FULL', com: '7', vat: '5' }],
    bank: DEFAULT_BANK,
  });
  const set = (k) => (e) => setD((p) => ({ ...p, [k]: e && e.target ? e.target.value : e }));
  const setBank = (k) => (e) => setD((p) => ({ ...p, bank: { ...p.bank, [k]: e.target.value } }));
  const updRow = (id, k, v) => setD((p) => ({ ...p, rows: p.rows.map((r) => (r.id === id ? { ...r, [k]: v } : r)) }));
  const [printMsg, setPrintMsg] = useState('');

  const rows = useMemo(() => d.rows.map((r) => ({ r, c: calcRow(r) })), [d.rows]);
  const totals = useMemo(() => {
    const t = rows.reduce((a, { c }) => ({ price: a.price + c.price, com: a.com + c.com, vat: a.vat + c.vat, incl: a.incl + c.incl }), { price: 0, com: 0, vat: 0, incl: 0 });
    const out = { price: r2(t.price), com: r2(t.com), vat: r2(t.vat), incl: r2(t.incl) };
    out.words = amountInWords(out.incl);
    return out;
  }, [rows]);

  const ibanOk = /^AE\d{21}$/.test(d.bank.iban.replace(/\s/g, ''));
  const trnOk = /^\d{15}$/.test(d.agencyTrn.replace(/\s/g, ''));

  const [partyIds, setPartyIds] = useState({ clientId: '', developerId: '' });
  const pick = (p) => {
    setPartyIds((x) => ({ ...x, ...(p.kind === 'client' ? { clientId: p.record.id } : { developerId: p.record.id }) }));
    setD((prev) => ({ ...prev, client: p.kind === 'client' ? p.record.full_name : p.record.developer_name }));
  };
  useEffect(() => {
    const c = clients.find((x) => x.id === initial.client); const dv = developers.find((x) => x.id === initial.developer);
    if (c) pick({ kind: 'client', record: c });
    if (dv) pick({ kind: 'developer', record: dv });
    const dl = initial.deal;
    if (dl) setD((prev) => ({ ...prev, rows: [{ ...prev.rows[0], unit: [dl.project_name, dl.unit_no].filter(Boolean).join(' - ').toUpperCase(), price: dl.sale_price_aed != null ? String(dl.sale_price_aed) : prev.rows[0].price, com: dl.commission_pct != null ? String(dl.commission_pct) : prev.rows[0].com }] }));
  }, []);
  const { note: crmNote, issue, canIssue } = useIssueDocument(() => ({ docType: 'tax_invoice', docNo: d.invNo, amount: totals.com, vat: totals.vat, total: totals.incl, ...partyIds }));

  const issueAndPrint = async () => { if (await issue()) doPrint(); };

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
          <div className="bg-white rounded-md px-2 py-1"><img src={LOGO} alt="Citiway" style={{ height: 28, width: 'auto', display: 'block' }} /></div>
          <div>
            <div className="font-head font-bold tracking-wide">Tax Invoice Generator</div>
            <div className="text-[12px] text-blue-100">Template #5 · Developer / Commission Tax Invoice</div>
          </div>
          {canIssue && <button onClick={issueAndPrint} title="Records the document in the CRM, then opens the print / PDF dialog" className="ml-auto bg-emerald-500 hover:bg-emerald-400 transition text-white font-semibold text-sm px-4 py-2 rounded-lg whitespace-nowrap">Save &amp; Issue Document</button>}
          <button onClick={doPrint} title="Print a draft without recording it" className="bg-brand hover:bg-white hover:text-navy transition text-navy font-semibold text-sm px-4 py-2 rounded-lg whitespace-nowrap">
            Print / Save as PDF
          </button>
        </div>
        {printMsg && <div className="max-w-[1500px] mx-auto px-5 pb-3 text-[12px] text-blue-100">{printMsg}</div>}
        {crmNote && <div className="no-print max-w-[1500px] mx-auto px-5 pb-3 text-[12px] text-blue-100">{crmNote}</div>}
      </header>

      <main className="max-w-[1500px] mx-auto p-5 grid gap-5 lg:grid-cols-[460px_1fr] items-start">
        {/* ---- FORM ---- */}
        <div className="no-print space-y-4 lg:max-h-[calc(100vh-110px)] lg:overflow-y-auto lg:pr-1">
          <Card title="Invoice Info">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Invoice Number"><Input value={d.invNo} onChange={set('invNo')} /></Field>
              <Field label="Invoice Date"><Input type="date" value={d.invDate} onChange={set('invDate')} /></Field>
            </div>
            <Field label="Agency TRN" hint={trnOk ? 'UAE TRNs are 15 digits.' : '⚠ UAE TRNs are 15 digits — please check this number.'}>
              <Input value={d.agencyTrn} onChange={set('agencyTrn')} />
            </Field>
          </Card>

          <Card title="Invoiced To">
            <PartyPicker clients={clients} developers={developers} onPick={pick} />
            <Field label="Client / Developer Name"><Input value={d.client} onChange={set('client')} /></Field>
            <Field label="Address"><textarea rows={3} className="field-in" value={d.clientAddress} onChange={set('clientAddress')} /></Field>
            <Field label="Client TRN"><Input value={d.clientTrn} onChange={set('clientTrn')} /></Field>
          </Card>

          <Card title="Units & Commission">
            <datalist id="claims">{CLAIM_TYPES.map((x) => <option key={x} value={x} />)}</datalist>
            {rows.map(({ r, c }, i) => (
              <div key={r.id} className="rounded-lg border border-slate-200 p-3 space-y-2 bg-slate-50/60">
                <div className="flex items-center justify-between">
                  <span className="text-[12px] font-bold text-navy">Unit #{i + 1}</span>
                  {d.rows.length > 1 && (
                    <button type="button" onClick={() => setD((p) => ({ ...p, rows: p.rows.filter((x) => x.id !== r.id) }))}
                      className="text-[12px] text-red-600 hover:underline">Remove</button>
                  )}
                </div>
                <Field label="Unit Number"><Input value={r.unit} onChange={(e) => updRow(r.id, 'unit', e.target.value)} placeholder="e.g. AZIZI LEILY - 1306" /></Field>
                <div className="grid grid-cols-2 gap-2">
                  <Field label="Selling Price (AED)"><Input type="number" min="0" step="0.01" value={r.price} onChange={(e) => updRow(r.id, 'price', e.target.value)} /></Field>
                  <Field label="Claim Type">
                    <input list="claims" className="field-in" value={r.claim} onChange={(e) => updRow(r.id, 'claim', e.target.value.toUpperCase())} />
                  </Field>
                  <Field label="Com. %"><Input type="number" min="0" step="0.01" value={r.com} onChange={(e) => updRow(r.id, 'com', e.target.value)} /></Field>
                  <Field label="VAT %"><Input type="number" min="0" step="0.01" value={r.vat} onChange={(e) => updRow(r.id, 'vat', e.target.value)} /></Field>
                </div>
                <div className="grid grid-cols-3 gap-2 text-[12px] rounded-md bg-brand-soft p-2 text-navy">
                  <div><div className="text-slate-500">Commission</div><div className="font-bold num">{money(c.com)}</div></div>
                  <div><div className="text-slate-500">VAT</div><div className="font-bold num">{money(c.vat)}</div></div>
                  <div><div className="text-slate-500">Incl. VAT</div><div className="font-bold num">{money(c.incl)}</div></div>
                </div>
              </div>
            ))}
            <button type="button" onClick={() => setD((p) => ({ ...p, rows: [...p.rows, blankRow()] }))}
              className="w-full border-2 border-dashed border-brand text-navy font-semibold text-sm py-2 rounded-lg hover:bg-brand-soft transition">
              + Add Unit Row
            </button>
            {d.rows.length > 6 && (
              <div className="text-[12px] rounded-md bg-amber-50 border border-amber-200 text-amber-800 p-2">More than 6 units may push content past one A4 page — check the preview.</div>
            )}
            <div className="rounded-lg bg-navy text-white p-3 text-sm">
              <div className="flex justify-between"><span>Total Incl. VAT</span><span className="font-bold num">AED {money(totals.incl)}</span></div>
              <div className="text-[12px] italic text-blue-100 pt-1">{totals.words || '—'}</div>
            </div>
          </Card>

          <section className="bg-white rounded-xl border border-slate-200 shadow-sm">
            <details className="group">
              <summary className="cursor-pointer list-none p-4 flex items-center justify-between">
                <h3 className="font-head font-bold text-[13px] uppercase tracking-wider text-navy flex items-center gap-2">
                  <span className="w-1 h-4 rounded bg-brand inline-block" />Banking Details
                </h3>
                <span className="text-[12px] text-slate-500 group-open:hidden">ADIB · edit ▾</span>
                <span className="text-[12px] text-slate-500 hidden group-open:inline">collapse ▴</span>
              </summary>
              <div className="px-4 pb-4 space-y-3">
                <Field label="Beneficiary Name"><Input value={d.bank.beneficiary} onChange={setBank('beneficiary')} /></Field>
                <Field label="Name of Bank"><Input value={d.bank.bankName} onChange={setBank('bankName')} /></Field>
                <Field label="Branch / Bank Address"><Input value={d.bank.address} onChange={setBank('address')} /></Field>
                <div className="grid grid-cols-2 gap-2">
                  <Field label="Type of Account"><Input value={d.bank.type} onChange={setBank('type')} /></Field>
                  <Field label="Currency"><Input value={d.bank.currency} onChange={setBank('currency')} /></Field>
                </div>
                <Field label="Account Number"><Input value={d.bank.account} onChange={setBank('account')} /></Field>
                <Field label="IBAN Number" hint={ibanOk ? 'Valid UAE IBAN format (AE + 21 digits).' : '⚠ UAE IBANs are AE followed by 21 digits.'}>
                  <Input value={d.bank.iban} onChange={setBank('iban')} />
                </Field>
                <button type="button" onClick={() => setD((p) => ({ ...p, bank: DEFAULT_BANK }))} className="text-[12px] text-navy underline">Reset to ADIB defaults</button>
              </div>
            </details>
          </section>

        </div>

        {/* ---- PREVIEW ---- */}
        <div className="lg:sticky lg:top-5">
          <div className="no-print flex items-center justify-between mb-3 px-1">
            <span className="text-[12px] font-semibold uppercase tracking-wider text-slate-500">Live A4 Preview</span>
            <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-navy text-white">TAX INVOICE</span>
          </div>
          <ScaledA4><Invoice d={d} rows={rows} totals={totals} /></ScaledA4>
        </div>
      </main>
    </div>
  );
}


export default App as React.ComponentType<any>;
