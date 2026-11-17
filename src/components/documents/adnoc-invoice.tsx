/* eslint-disable */
// @ts-nocheck — ported from the original single-file Citiway tool (Project Knowledge/citiway-adnoc-invoice updated .html)
'use client';
import { useIssueDocument } from '@/components/documents/crm-bridge';
import { StampSlot } from '@/components/documents/signoff';
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
    <section className="glass rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-head font-bold text-[13px] uppercase tracking-wider text-navy flex items-center gap-2">
          <span className="w-1 h-4 rounded bg-brand inline-block" />{title}
        </h3>
      </div>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

/* ---------- Template #6 — 1:1 replica of CW-AD-S-2610006 (all units in pt) ---------- */
const PDF_LOGO = "/assets/asset-c0491aae.jpg";
const PDF_FOOTER = "/assets/asset-2b589ab0.jpg";

const r2 = (v) => Math.round(Number((v * 100).toPrecision(12))) / 100;
const sar = (n) => 'SAR ' + (isFinite(n) ? n : 0).toLocaleString('en-US', { minimumFractionDigits: Number.isInteger(n) ? 0 : 2, maximumFractionDigits: 2 });
function wordsFor(total, withCurrency) {
  if (!total || total <= 0) return '';
  const cents = Math.round(total * 100);
  const whole = Math.floor(cents / 100);
  const halalas = cents % 100;
  const w = (n) => intToWords(n).replace(/-/g, ' ');
  let s = w(whole);
  if (withCurrency) s += whole === 1 ? ' Saudi Riyal' : ' Saudi Riyals';
  if (halalas) s += ' and ' + w(halalas) + (halalas === 1 ? ' Halala' : ' Halalas');
  return s + (withCurrency ? ' Only' : ' only');
}

function Toggle({ on, onChange, label }) {
  return (
    <button type="button" onClick={() => onChange(!on)}
      className="flex items-center gap-3 w-full rounded-lg border border-slate-200 px-3 py-2.5 hover:bg-slate-50 transition">
      <span className={`relative w-11 h-6 rounded-full transition flex-none ${on ? 'bg-navy' : 'bg-slate-300'}`}>
        <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${on ? 'left-[22px]' : 'left-0.5'}`} />
      </span>
      <span className="text-sm font-semibold text-ink text-left">{label}</span>
      <span className={`ml-auto text-[11px] font-bold px-2 py-0.5 rounded ${on ? 'bg-brand-soft text-navy' : 'bg-slate-100 text-slate-500'}`}>{on ? 'ON' : 'OFF'}</span>
    </button>
  );
}

function AdnocSheet({ d, calc }) {
  const CAL = "'Carlito', 'Calibri', sans-serif";
  const TNR = "'Tinos', 'Times New Roman', serif";
  const U = { textDecoration: 'underline', textDecorationThickness: '0.7pt', textUnderlineOffset: '1.6pt' };
  // absolute single-line text helper
  const T = ({ x, y, size = 11.1, bold, font = CAL, u, children, style }) => (
    <div style={{ position: 'absolute', left: x + 'pt', top: y + 'pt', fontSize: size + 'pt', lineHeight: 1, fontWeight: bold ? 700 : 400, fontFamily: font, whiteSpace: 'nowrap', ...(u ? U : {}), ...style }}>{children}</div>
  );
  const B = '1.8pt solid #000';
  const tbl = { borderCollapse: 'collapse', tableLayout: 'fixed', width: '499.2pt', fontFamily: CAL, color: '#000' };
  const th = (size = 9.3, extra = {}) => ({ border: B, background: '#A6A6A6', fontWeight: 700, fontSize: size + 'pt', lineHeight: 1.18, textAlign: 'center', verticalAlign: 'middle', padding: '1pt 2pt', ...extra });
  const td = (size = 8.4, extra = {}) => ({ border: B, fontSize: size + 'pt', lineHeight: 1.3, textAlign: 'center', verticalAlign: 'top', padding: '1.5pt 2pt', whiteSpace: 'pre-line', ...extra });

  return (
    <div id="print-root" className="a4" style={{ padding: 0, display: 'block', position: 'relative', color: '#000', fontFamily: CAL }}>
      {/* ---------- Header (absolute, exact coordinates) ---------- */}
      <div style={{ position: 'relative', height: '289.7pt' }}>
        <img src={PDF_LOGO} alt="Citiway Real Estate" style={{ position: 'absolute', left: '60pt', top: '9.2pt', width: '173.4pt', height: '50.9pt' }} />
        <T x={0} y={65.6} size={16.8} bold style={{ width: '100%', textAlign: 'center', left: 0 }}>TAX Invoice</T>
        <T x={49} y={91.1} bold>CITIWAY REAL ESTATE BROKERAGE L.L.C., PO BOX 34201, DUBAI, UAE</T>

        <T x={49} y={105.7} u>Invoice Date:</T>      <T x={154.7} y={105.7}>{fmtDate(d.invDate)}</T>
        <T x={49} y={119.9} u>Invoice Number:</T>    <T x={154.7} y={119.9}>{d.invNo}</T>
        <T x={49} y={134.0} u>TRN:</T>               <T x={154.7} y={133.8}>{d.trn}</T>
        <T x={49} y={148.2} u>Address:</T>           <T x={154.7} y={148.2}>{d.address}</T>

        <T x={49} y={175.9} font={TNR} u>Invoice Issued to:</T>
        <T x={154.7} y={176.2} font={TNR} bold>{d.client}</T>
        <T x={49} y={190.1} font={TNR} u>TRN:</T>
        <T x={154.7} y={190.4}>{d.clientTrn}</T>
        <T x={49} y={204.3} font={TNR} u>Address:</T>
        <T x={154.7} y={204.4}>{d.clientAddress}</T>

        <T x={49} y={232.6} font={TNR} u>Transaction Type:</T> <T x={154.7} y={232.6} font={TNR}>{d.contractType}</T>
        <T x={49} y={247.8} font={TNR} u>Property Type:</T>    <T x={154.7} y={247.8} font={TNR}>{d.propertyType}</T>
        <T x={49} y={262.9} font={TNR} u>Contract No.</T>      <T x={154.7} y={263.4}>{d.contractNo}</T>
      </div>

      {/* ---------- Flow section (tables) ---------- */}
      <div style={{ marginLeft: '46.4pt', width: '499.2pt' }}>
        <div style={{ fontSize: '8.4pt', lineHeight: 1, fontWeight: 700, paddingLeft: '2.2pt' }}>Landlord Information:</div>
        <table style={{ ...tbl, marginTop: '2.1pt' }}>
          <colgroup><col style={{ width: '163.2pt' }} /><col style={{ width: '224.9pt' }} /><col style={{ width: '111.1pt' }} /></colgroup>
          <thead>
            <tr style={{ height: '31.5pt' }}>
              <th style={th()}>Franchisee Name</th>
              <th style={th()}>Address</th>
              <th style={th()}>Establishment Unified Number</th>
            </tr>
          </thead>
          <tbody>
            <tr style={{ height: '43.2pt' }}>
              <td style={td(11.1, { textAlign: 'left', verticalAlign: 'middle', paddingLeft: '1pt' })}>{d.llName}</td>
              <td style={td(11.1, { verticalAlign: 'middle' })}>{d.llAddress}</td>
              <td style={td(10.2, { verticalAlign: 'middle' })}>{d.llNumber}</td>
            </tr>
          </tbody>
        </table>

        <table style={{ ...tbl, marginTop: '14.4pt' }}>
          <colgroup>
            <col style={{ width: '105.5pt' }} /><col style={{ width: '57.7pt' }} /><col style={{ width: '51pt' }} /><col style={{ width: '57.8pt' }} />
            <col style={{ width: '59.8pt' }} /><col style={{ width: '56.3pt' }} /><col style={{ width: '48.6pt' }} /><col style={{ width: '62.5pt' }} />
          </colgroup>
          <thead>
            <tr style={{ height: '27.9pt' }}>
              <th style={th()}>Station Name</th>
              <th style={th()}>ADGC PP#</th>
              <th style={th()}>Transaction Type</th>
              <th style={th()}>Sales Volume</th>
              <th style={th()}>Tier</th>
              <th style={th()}>Success Fee</th>
              <th style={th()}>VAT</th>
              <th style={th(8.4, { textAlign: 'left', paddingLeft: '1.6pt' })}>TOTAL Payable Commission</th>
            </tr>
          </thead>
          <tbody>
            <tr style={{ height: '81.9pt' }}>
              <td style={td(11.1, { verticalAlign: 'middle' })}>{d.station}</td>
              <td style={td(8.4, { paddingTop: '8pt' })}>{d.pp}</td>
              <td style={td(10.2, { paddingTop: '7.4pt' })}>{d.txType}</td>
              <td style={td(8.4, { paddingTop: '0.5pt', lineHeight: 1.31 })}>{d.volume}</td>
              <td style={td(8.4, { paddingTop: '8pt', lineHeight: 2.4 })}>{d.tier}</td>
              <td style={td(8.4, { paddingTop: '8pt', fontWeight: 700 })}>{sar(calc.fee)}</td>
              <td style={td(10.2, { paddingTop: '0.6pt', lineHeight: 1.33 })}>
                {d.outsideUae ? <>0 SAR{'\n'}As service was provided outside the UAE</> : sar(calc.vat)}
              </td>
              <td style={td(8.4, { paddingTop: '8pt', fontWeight: 700 })}>{sar(calc.total)}</td>
            </tr>
          </tbody>
        </table>

        {/* Amount in words strip */}
        <div style={{ marginTop: '15pt', display: 'flex', alignItems: 'baseline', whiteSpace: 'nowrap' }}>
          <span style={{ width: '152.3pt', flex: 'none', paddingLeft: '2.4pt', fontSize: '10.2pt', fontWeight: 700 }}>
            <span style={U}>Amount in Words</span>:
          </span>
          <span style={{ minWidth: '153.6pt', fontSize: '11.1pt', borderBottom: '0.75pt solid #000', lineHeight: 1.05, paddingRight: '4pt' }}>{calc.words}</span>
          <span style={{ fontSize: '11.1pt', fontWeight: 700, borderBottom: '0.75pt solid #000', lineHeight: 1.05, paddingRight: '0.3pt' }}>Total Amount Due: {sar(calc.total)}</span>
        </div>

        <div style={{ marginTop: '18pt', fontSize: '8.4pt', lineHeight: 1, fontWeight: 700, paddingLeft: '2.2pt' }}>Payment Details:</div>
        <table style={{ ...tbl, marginTop: '1.1pt' }}>
          <colgroup><col style={{ width: '163.2pt' }} /><col style={{ width: '51pt' }} /><col style={{ width: '117.6pt' }} /><col style={{ width: '104.9pt' }} /><col style={{ width: '62.5pt' }} /></colgroup>
          <thead>
            <tr style={{ height: '16pt' }}>
              <th style={th(8.4)}>Account Name</th><th style={th(8.4)}>Bank</th><th style={th(8.4)}>Account Number</th><th style={th(8.4)}>IBAN Number</th><th style={th(8.4)}>Swift Code</th>
            </tr>
          </thead>
          <tbody>
            <tr style={{ height: '43.8pt' }}>
              {[d.bank.name, d.bank.bank, d.bank.account, d.bank.iban, d.bank.swift].map((v, i) => (
                <td key={i} style={td(8.4, { verticalAlign: 'middle', lineHeight: 1.31, ...(i === 3 ? { fontSize: '8pt', letterSpacing: '-0.1pt' } : {}) })}>{v}</td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>

      {/* ---------- Company stamp & signature (empty unless stamped by the Super Admin) ---------- */}
      <StampSlot align="right" style={{ right: '49pt', bottom: '145pt', width: '210pt', height: '75pt' }} />

      {/* ---------- Letterhead footer graphic ---------- */}
      <img src={PDF_FOOTER} alt="" style={{ position: 'absolute', left: '46.4pt', bottom: '16.3pt', width: '526.7pt', height: '124pt' }} />
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
  name: 'CITIWAY REAL ESTATE BROKERAGE L.L.C',
  bank: 'Abu Dhabi Islamic Bank (ADIB)',
  account: '19420159',
  iban: 'AE480500000000019420159',
  swift: 'ABDIAEADXXX',
};

function App({ company = {} }) {
  const [d, setD] = useState({
    invDate: today(),
    invNo: 'CW-AD-S-2610006',
    trn: company.trn || '100281605400003',
    address: '205, Bayswater Tower, Business Bay, Dubai, UAE',
    client: 'ADNOC Distribution Gulf L.L.C',
    clientTrn: '310268913400003',
    clientAddress: 'King Fahad Branch Road, 12212 Al Olaya District, Riyadh, KSA',
    contractType: 'DOCO',
    propertyType: 'Fuel Station',
    contractNo: '49826',
    llName: 'Sumco',
    llAddress: 'Eastern Region',
    llNumber: '7051652696',
    station: 'Sumco Uqair Road',
    pp: 'KBD1394',
    volume: '12877 L/D Benzene 35890 L/D Diesel',
    txType: 'DOCO',
    tier: 'Tier 1\n> 30,000 L/D',
    wordsCurrency: false,
    wordsOverride: '',
    fee: '97000',
    outsideUae: true,
    bank: DEFAULT_BANK,
  });
  const set = (k) => (e) => setD((p) => ({ ...p, [k]: e && e.target ? e.target.value : e }));
  const setBank = (k) => (e) => setD((p) => ({ ...p, bank: { ...p.bank, [k]: e.target.value } }));
  const [printMsg, setPrintMsg] = useState('');

  const calc = useMemo(() => {
    const fee = r2(parseFloat(d.fee) || 0);
    const vat = d.outsideUae ? 0 : r2(fee * 0.05);
    const total = r2(fee + vat);
    return { fee, vat, total, autoWords: wordsFor(total, d.wordsCurrency), words: d.wordsOverride.trim() || wordsFor(total, d.wordsCurrency) };
  }, [d.fee, d.outsideUae, d.wordsCurrency, d.wordsOverride]);

  const { note: crmNote, issue, canIssue } = useIssueDocument(() => ({ docType: 'tax_invoice', docNo: d.invNo, amount: calc.fee, vat: calc.vat, total: calc.total }));
  const issueAndPrint = async () => { if (await issue()) doPrint(); };

  const doPrint = () => {
    try {
      window.print();
      setPrintMsg('If no print dialog appeared, this viewer blocks printing — open the .html file in Chrome/Edge and press Ctrl/Cmd + P.');
    } catch (e) {
      setPrintMsg('Printing is blocked in this viewer — open the .html file in your browser and press Ctrl/Cmd + P.');
    }
  };
  const ta = (k, rows = 2) => <textarea rows={rows} className="field-in" value={d[k]} onChange={set(k)} />;

  return (
    <div className="min-h-screen">
      <header className="no-print cw-topbar text-white">
        <div className="max-w-[1500px] mx-auto px-5 py-3 flex items-center gap-4">
          <div>
            <div className="font-head font-bold tracking-wide">ADNOC Distribution Tax Invoice</div>
            <div className="text-[12px] text-blue-100">Template #6 · ADNOC format (CW-AD-S-2610006) · SAR billing</div>
          </div>
          {canIssue && <button onClick={issueAndPrint} title="Records the document in the CRM, then opens the print / PDF dialog" className="ml-auto btn-success text-white font-semibold text-sm px-4 py-2 rounded-lg whitespace-nowrap">Save &amp; Issue Document</button>}
          <button onClick={doPrint} title="Print a draft without recording it" className="btn-brand text-navy font-semibold text-sm px-4 py-2 rounded-lg whitespace-nowrap">
            Print / Save as PDF
          </button>
        </div>
        {printMsg && <div className="max-w-[1500px] mx-auto px-5 pb-3 text-[12px] text-blue-100">{printMsg}</div>}
        {crmNote && <div className="no-print max-w-[1500px] mx-auto px-5 pb-3 text-[12px] text-blue-100">{crmNote}</div>}
      </header>

      <main className="max-w-[1500px] mx-auto p-5 grid gap-5 lg:grid-cols-[460px_1fr] items-start">
        {/* ---- FORM ---- */}
        <div className="no-print space-y-4 lg:max-h-[calc(100vh-110px)] lg:overflow-y-auto lg:pr-1">
          <Card title="Invoice Details">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Invoice Date"><Input type="date" value={d.invDate} onChange={set('invDate')} /></Field>
              <Field label="Invoice Number"><Input value={d.invNo} onChange={set('invNo')} /></Field>
            </div>
            <Field label="Citiway TRN"><Input value={d.trn} onChange={set('trn')} /></Field>
            <Field label="Address"><Input value={d.address} onChange={set('address')} /></Field>
          </Card>

          <Card title="Invoice Issued To">
            <Field label="Client Name"><Input value={d.client} onChange={set('client')} /></Field>
            <Field label="Client TRN"><Input value={d.clientTrn} onChange={set('clientTrn')} /></Field>
            <Field label="Address">{ta('clientAddress')}</Field>
          </Card>

          <Card title="Contract Details">
            <datalist id="ctypes">{['DOCO', 'COCO', 'CODO'].map((x) => <option key={x} value={x} />)}</datalist>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Transaction Type (header)"><input list="ctypes" className="field-in" value={d.contractType} onChange={(e) => setD((p) => ({ ...p, contractType: e.target.value.toUpperCase(), txType: p.txType === p.contractType ? e.target.value.toUpperCase() : p.txType }))} /></Field>
              <Field label="Property Type"><Input value={d.propertyType} onChange={set('propertyType')} /></Field>
            </div>
            <Field label="Contract No."><Input value={d.contractNo} onChange={set('contractNo')} /></Field>
          </Card>

          <Card title="Landlord Information">
            <Field label="Franchisee Name"><Input value={d.llName} onChange={set('llName')} /></Field>
            <Field label="Address"><Input value={d.llAddress} onChange={set('llAddress')} /></Field>
            <Field label="Establishment Unified Number"><Input value={d.llNumber} onChange={set('llNumber')} /></Field>
          </Card>

          <Card title="Station & Commission">
            <Field label="Station Name"><Input value={d.station} onChange={set('station')} /></Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label="ADGC PP#"><Input value={d.pp} onChange={set('pp')} /></Field>
              <Field label="Sales Volume">{ta('volume')}</Field>
              <Field label="Transaction Type"><input list="ctypes" className="field-in" value={d.txType} onChange={(e) => setD((p) => ({ ...p, txType: e.target.value.toUpperCase() }))} /></Field>
              <Field label="Tier">{ta('tier')}</Field>
            </div>
            <Field label="Success Fee (SAR)"><Input type="number" min="0" step="0.01" value={d.fee} onChange={set('fee')} /></Field>
            <Toggle on={d.outsideUae} onChange={(v) => setD((p) => ({ ...p, outsideUae: v }))} label="Service Outside UAE (0 SAR VAT)" />
            <div className="rounded-lg bg-brand-soft p-3 text-sm space-y-1 text-navy">
              <div className="flex justify-between"><span>Success Fee</span><span className="num">{sar(calc.fee)}</span></div>
              <div className="flex justify-between"><span>VAT</span><span className="num">{d.outsideUae ? '0 SAR (outside UAE)' : sar(calc.vat)}</span></div>
              <div className="flex justify-between font-bold border-t border-brand-line pt-1"><span>Total Amount Due</span><span className="num">{sar(calc.total)}</span></div>
            </div>
          </Card>

          <Card title="Amount in Words">
            <Toggle on={d.wordsCurrency} onChange={(v) => setD((p) => ({ ...p, wordsCurrency: v }))} label='Include "Saudi Riyals" in words' />
            <Field label="Auto text"><div className="field-in bg-slate-50 text-slate-600 italic">{calc.autoWords || '—'}</div></Field>
            <Field label="Override (optional)" hint="Leave blank to use the auto text above.">
              <Input value={d.wordsOverride} onChange={set('wordsOverride')} placeholder="Custom amount-in-words text" />
            </Field>
          </Card>

          <section className="bg-white rounded-xl border border-slate-200 shadow-sm">
            <details className="group">
              <summary className="cursor-pointer list-none p-4 flex items-center justify-between">
                <h3 className="font-head font-bold text-[13px] uppercase tracking-wider text-navy flex items-center gap-2">
                  <span className="w-1 h-4 rounded bg-brand inline-block" />Bank Details
                </h3>
                <span className="text-[12px] text-slate-500">ADIB · edit ▾</span>
              </summary>
              <div className="px-4 pb-4 space-y-3">
                <Field label="Account Name"><Input value={d.bank.name} onChange={setBank('name')} /></Field>
                <Field label="Bank"><Input value={d.bank.bank} onChange={setBank('bank')} /></Field>
                <div className="grid grid-cols-2 gap-2">
                  <Field label="Account Number"><Input value={d.bank.account} onChange={setBank('account')} /></Field>
                  <Field label="Swift Code"><Input value={d.bank.swift} onChange={setBank('swift')} /></Field>
                </div>
                <Field label="IBAN Number"><Input value={d.bank.iban} onChange={setBank('iban')} /></Field>
                <button type="button" onClick={() => setD((p) => ({ ...p, bank: DEFAULT_BANK }))} className="text-[12px] text-navy underline">Reset to ADIB defaults</button>
              </div>
            </details>
          </section>
        </div>

        {/* ---- PREVIEW ---- */}
        <div className="lg:sticky lg:top-5">
          <div className="no-print flex items-center justify-between mb-3 px-1">
            <span className="text-[12px] font-semibold uppercase tracking-wider text-slate-500">Live A4 Preview</span>
            <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-navy text-white">{d.outsideUae ? '0 SAR VAT · OUTSIDE UAE' : '5% VAT'}</span>
          </div>
          <ScaledA4><AdnocSheet d={d} calc={calc} /></ScaledA4>
        </div>
      </main>
    </div>
  );
}


export default App as React.ComponentType<any>;
