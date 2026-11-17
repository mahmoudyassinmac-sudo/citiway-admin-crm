/* eslint-disable */
// @ts-nocheck — ported from the original single-file Citiway tool (Project Knowledge/citiway-payment-voucher.html)
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

const PURPOSES = [
  'Agent Commission Payout',
  'Landlord Rent Remittance',
  'Security Deposit Refund',
  'Vendor / Maintenance Payment',
  'Marketing / Portal Expense',
  'Office / Admin Expense',
  'Other',
];

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
const blankCheque = () => ({ id: Math.random().toString(36).slice(2), no: '', date: '', bank: '', amount: '' });

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

/* ---------- The A4 voucher ---------- */
function Voucher({ d, calc }) {
  const chequeHasAmounts = d.cheques.some((c) => c.amount !== '' && Number(c.amount) > 0);
  const Blank = ({ v }) => (v ? <>{v}</> : <span className="text-slate-300">—</span>);
  const sigLabel = { fontSize: '8.6pt', letterSpacing: '.06em' };
  const sigBox = { marginTop: '2mm', height: '26mm', border: '1px dashed #9DB8DE', borderRadius: '6px', background: '#FAFCFE' };
  const sigLine = { marginTop: '2.5mm', borderBottom: '1px solid #7AA3D8', paddingBottom: '1.2mm', fontSize: '9.4pt', minHeight: '5mm' };

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
            Payment Voucher
          </div>
          <table className="ml-auto" style={{ marginTop: '4mm', fontSize: '9pt', borderCollapse: 'collapse' }}>
            <tbody>
              <tr>
                <td className="text-slate-500 font-medium pr-3 py-[1mm] text-right">Voucher No.</td>
                <td className="font-semibold text-navy num text-left border-b border-brand-line px-2 py-[1mm]" style={{ minWidth: '34mm' }}><Blank v={d.voucherNo} /></td>
              </tr>
              <tr>
                <td className="text-slate-500 font-medium pr-3 py-[1mm] text-right">Date</td>
                <td className="font-semibold text-navy num text-left border-b border-brand-line px-2 py-[1mm]"><Blank v={fmtDate(d.date)} /></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Paid To */}
      <div className="sec" style={{ marginTop: '7mm' }}>Paid To</div>
      <table className="rt">
        <tbody>
          <tr><td className="lbl">Name</td><td className="font-semibold"><Blank v={d.payee} /></td></tr>
          <tr><td className="lbl">Contact (Phone / Email)</td><td><Blank v={d.contact} /></td></tr>
        </tbody>
      </table>

      {/* Payment details */}
      <div className="sec">Payment Details</div>
      <table className="rt">
        <tbody>
          <tr><td className="lbl">Being Payment For</td><td className="font-semibold"><Blank v={d.purpose === 'Other' ? d.purposeOther : d.purpose} /></td></tr>
          <tr><td className="lbl">Property / Unit No.</td><td><Blank v={d.unit} /></td></tr>
          <tr className="total"><td className="lbl">Amount (AED)</td><td className="num" style={{ fontSize: '11pt' }}>{money(calc.amount)}</td></tr>
          <tr><td className="lbl">Amount in Words</td><td className="italic font-medium text-navy"><Blank v={calc.words} /></td></tr>
        </tbody>
      </table>

      {/* Payment method */}
      <div className="sec">Payment Method</div>
      <table className="rt">
        <tbody>
          <tr><td className="lbl">Payment Method</td><td className="font-semibold">{d.method}</td></tr>
          {d.method === 'Bank Transfer' && (<>
            <tr><td className="lbl">Transfer Reference No.</td><td className="num"><Blank v={d.trRef} /></td></tr>
            <tr><td className="lbl">Transfer Date</td><td className="num"><Blank v={fmtDate(d.trDate)} /></td></tr>
            <tr><td className="lbl">Bank Name</td><td><Blank v={d.trBank} /></td></tr>
          </>)}
        </tbody>
      </table>
      {d.method === 'Cheque' && (
        <table className="rt" style={{ marginTop: '2.5mm' }}>
          <thead>
            <tr>
              <th style={{ width: '9mm' }}>#</th>
              <th>Cheque No.</th>
              <th>Cheque Date</th>
              <th>Bank Name</th>
              {chequeHasAmounts && <th style={{ textAlign: 'right' }}>Amount (AED)</th>}
            </tr>
          </thead>
          <tbody>
            {d.cheques.map((c, i) => (
              <tr key={c.id}>
                <td className="num text-slate-500">{i + 1}</td>
                <td className="num font-medium"><Blank v={c.no} /></td>
                <td className="num"><Blank v={fmtDate(c.date)} /></td>
                <td><Blank v={c.bank} /></td>
                {chequeHasAmounts && <td className="num text-right">{c.amount ? money(Number(c.amount)) : '—'}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* Confirmation */}
      <p style={{ marginTop: '6mm', fontSize: '9.6pt', lineHeight: 1.6 }}>
        We, <span className="font-semibold text-navy">{COMPANY.name}</span>, hereby confirm disbursement of the above payment.
      </p>

      {/* Dual signatures */}
      <div className="flex justify-between" style={{ marginTop: '5mm', gap: '12mm' }}>
        <div style={{ flex: 1 }}>
          <div className="font-head font-semibold text-navy uppercase" style={sigLabel}>Prepared / Approved By</div>
          <div style={{ ...sigBox, position: 'relative' }} className="flex items-end justify-end p-[2mm]">
            <StampSlot align="center" style={{ inset: '1mm' }} />
            <span style={{ fontSize: '7pt', color: '#9DB8DE' }}>Signature &amp; Company Stamp</span>
          </div>
          <div style={sigLine} className="font-medium">
            <span className="text-slate-500 font-normal" style={{ fontSize: '8pt' }}>Name: </span>{d.preparedBy}
          </div>
        </div>
        <div style={{ flex: 1 }}>
          <div className="font-head font-semibold text-navy uppercase" style={sigLabel}>Received By (Payee Signature)</div>
          <div style={sigBox} className="flex items-end justify-end p-[2mm]">
            <span style={{ fontSize: '7pt', color: '#9DB8DE' }}>Payee Signature</span>
          </div>
          <div style={sigLine} className="font-medium">
            <span className="text-slate-500 font-normal" style={{ fontSize: '8pt' }}>Name: </span>{d.payeeOnSig ? d.payee : ''}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div style={{ marginTop: 'auto' }}>
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
    voucherNo: 'CW-PV-2026-0001',
    date: today(),
    payee: 'Sara Khalid',
    contact: '+971 50 123 4567 / sara.k@email.com',
    purpose: 'Agent Commission Payout',
    purposeOther: '',
    unit: 'Unit 1204, Bayswater Tower, Business Bay',
    amount: '7500',
    method: 'Bank Transfer',
    cheques: [blankCheque()],
    trRef: '', trDate: '', trBank: '',
    preparedBy: '',
    payeeOnSig: true,
  });
  const set = (k) => (e) => setD((p) => ({ ...p, [k]: e && e.target ? e.target.value : e }));
  const [printMsg, setPrintMsg] = useState('');

  const calc = useMemo(() => {
    const amount = Math.round((parseFloat(d.amount) || 0) * 100) / 100;
    return { amount, words: amountInWords(amount) };
  }, [d.amount]);

  const chequeSum = d.cheques.reduce((s, c) => s + (parseFloat(c.amount) || 0), 0);
  const showChequeWarn = d.method === 'Cheque' && chequeSum > 0 && Math.abs(chequeSum - calc.amount) > 0.005;
  const updCheque = (id, k, v) => setD((p) => ({ ...p, cheques: p.cheques.map((c) => (c.id === id ? { ...c, [k]: v } : c)) }));

  const { note: crmNote, issue, canIssue } = useIssueDocument(() => ({ docType: 'payment_voucher', docNo: d.voucherNo, amount: calc.amount, vat: 0, total: calc.amount }));
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
      <header className="no-print cw-topbar text-white">
        <div className="max-w-[1500px] mx-auto px-5 py-3 flex items-center gap-4">
          <div>
            <div className="font-head font-bold tracking-wide">Payment Voucher Generator</div>
            <div className="text-[12px] text-blue-100">Template #2 · Dynamic Payment Voucher</div>
          </div>
          {canIssue && <button onClick={issueAndPrint} title="Records the document in the CRM, then opens the print / PDF dialog" className="ml-auto btn-success text-white font-semibold text-sm px-4 py-2 rounded-lg whitespace-nowrap">Save &amp; Issue Document</button>}
          <button onClick={doPrint} title="Print a draft without recording it" className="btn-brand text-navy font-semibold text-sm px-4 py-2 rounded-lg">
            Print / Save as PDF
          </button>
        </div>
        {printMsg && <div className="max-w-[1500px] mx-auto px-5 pb-3 text-[12px] text-blue-100">{printMsg}</div>}
        {crmNote && <div className="no-print max-w-[1500px] mx-auto px-5 pb-3 text-[12px] text-blue-100">{crmNote}</div>}
      </header>

      <main className="max-w-[1500px] mx-auto p-5 grid gap-5 lg:grid-cols-[440px_1fr] items-start">
        {/* ---- FORM ---- */}
        <div className="no-print space-y-4 lg:max-h-[calc(100vh-110px)] lg:overflow-y-auto lg:pr-1">
          <Card title="Voucher Info">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Voucher No."><Input value={d.voucherNo} onChange={set('voucherNo')} /></Field>
              <Field label="Date"><Input type="date" value={d.date} onChange={set('date')} /></Field>
            </div>
          </Card>

          <Card title="Paid To (Payee)">
            <Field label="Name (Payee / Beneficiary)"><Input value={d.payee} onChange={set('payee')} /></Field>
            <Field label="Contact (Phone / Email)"><Input value={d.contact} onChange={set('contact')} /></Field>
          </Card>

          <Card title="Payment Details">
            <Field label="Being Payment For">
              <select className="field-in" value={d.purpose} onChange={set('purpose')}>
                {PURPOSES.map((p) => <option key={p}>{p}</option>)}
              </select>
            </Field>
            {d.purpose === 'Other' && <Field label="Specify Purpose"><Input value={d.purposeOther} onChange={set('purposeOther')} /></Field>}
            <Field label="Property / Unit No."><Input value={d.unit} onChange={set('unit')} placeholder="e.g. Unit 1204, Bayswater Tower, Business Bay" /></Field>
            <Field label="Amount (AED)"><Input type="number" min="0" step="0.01" value={d.amount} onChange={set('amount')} /></Field>
            <div className="rounded-lg bg-brand-soft p-3 text-sm space-y-1">
              <div className="flex justify-between font-bold text-navy"><span>Amount (AED)</span><span className="num">{money(calc.amount)}</span></div>
              <div className="text-[12px] italic text-navy pt-1">{calc.words || '—'}</div>
            </div>
          </Card>

          <Card title="Payment Method">
            <div className="grid grid-cols-3 gap-1 p-1 bg-slate-100 rounded-lg">
              {['Cash', 'Cheque', 'Bank Transfer'].map((m) => (
                <button key={m} type="button" onClick={() => setD((p) => ({ ...p, method: m }))}
                  className={`py-2 rounded-md text-sm font-semibold transition ${d.method === m ? 'bg-navy text-white shadow' : 'text-slate-600 hover:bg-white'}`}>{m}</button>
              ))}
            </div>

            {d.method === 'Cheque' && (
              <div className="space-y-3">
                {d.cheques.map((c, i) => (
                  <div key={c.id} className="rounded-lg border border-slate-200 p-3 space-y-2 bg-slate-50/60">
                    <div className="flex items-center justify-between">
                      <span className="text-[12px] font-bold text-navy">Cheque #{i + 1}</span>
                      {d.cheques.length > 1 && (
                        <button type="button" onClick={() => setD((p) => ({ ...p, cheques: p.cheques.filter((x) => x.id !== c.id) }))}
                          className="text-[12px] text-red-600 hover:underline">Remove</button>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <Field label="Cheque No."><Input value={c.no} onChange={(e) => updCheque(c.id, 'no', e.target.value)} /></Field>
                      <Field label="Cheque Date"><Input type="date" value={c.date} onChange={(e) => updCheque(c.id, 'date', e.target.value)} /></Field>
                      <Field label="Bank Name"><Input value={c.bank} onChange={(e) => updCheque(c.id, 'bank', e.target.value)} /></Field>
                      <Field label="Amount (optional)"><Input type="number" min="0" step="0.01" value={c.amount} onChange={(e) => updCheque(c.id, 'amount', e.target.value)} /></Field>
                    </div>
                  </div>
                ))}
                <button type="button" onClick={() => setD((p) => ({ ...p, cheques: [...p.cheques, blankCheque()] }))}
                  className="w-full border-2 border-dashed border-brand text-navy font-semibold text-sm py-2 rounded-lg hover:bg-brand-soft transition">
                  + Add Another Cheque
                </button>
                {showChequeWarn && (
                  <div className="text-[12px] rounded-md bg-amber-50 border border-amber-200 text-amber-800 p-2">
                    Cheque amounts add up to AED {money(chequeSum)}, but the voucher amount is AED {money(calc.amount)}. (This note isn't printed.)
                  </div>
                )}
                {d.cheques.length > 5 && (
                  <div className="text-[12px] rounded-md bg-amber-50 border border-amber-200 text-amber-800 p-2">
                    More than 5 cheques may push content past one A4 page — check the preview.
                  </div>
                )}
              </div>
            )}

            {d.method === 'Bank Transfer' && (
              <div className="grid grid-cols-2 gap-2">
                <div className="col-span-2"><Field label="Transfer Reference No."><Input value={d.trRef} onChange={set('trRef')} /></Field></div>
                <Field label="Transfer Date"><Input type="date" value={d.trDate} onChange={set('trDate')} /></Field>
                <Field label="Bank Name"><Input value={d.trBank} onChange={set('trBank')} /></Field>
              </div>
            )}

            {d.method === 'Cash' && <p className="text-[12px] text-slate-500">Cash selected — no cheque or transfer fields will appear on the voucher.</p>}
          </Card>

          <Card title="Signatures">
            <Field label="Prepared / Approved By (optional)" hint="Leave blank to write by hand."><Input value={d.preparedBy} onChange={set('preparedBy')} /></Field>
            <label className="flex items-center gap-2 text-sm text-ink cursor-pointer">
              <input type="checkbox" checked={d.payeeOnSig} onChange={(e) => setD((p) => ({ ...p, payeeOnSig: e.target.checked }))} className="w-4 h-4 accent-[#1E3553]" />
              Print payee name under "Received By"
            </label>
          </Card>
        </div>

        {/* ---- PREVIEW ---- */}
        <div className="lg:sticky lg:top-5">
          <div className="no-print flex items-center justify-between mb-3 px-1">
            <span className="text-[12px] font-semibold uppercase tracking-wider text-slate-500">Live A4 Preview</span>
            <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-navy text-white">PAYMENT VOUCHER</span>
          </div>
          <ScaledA4><Voucher d={d} calc={calc} /></ScaledA4>
        </div>
      </main>
    </div>
  );
}


export default App as React.ComponentType<any>;
