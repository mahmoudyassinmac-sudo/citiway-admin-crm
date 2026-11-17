/* eslint-disable */
// @ts-nocheck — ported from the original single-file Citiway tool (Project Knowledge/citiway-letterhead_1.html)
'use client';
import React, { useState, useMemo, useEffect, useLayoutEffect, useRef, useCallback, Fragment } from 'react';
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client';
import { issueLetter as issueLetterAction } from '@/app/(app)/documents/actions';
import { developerStatus, daysLeft } from '@/lib/developers';
import { StampSlot, SignoffChoice, useSignoff } from '@/components/documents/signoff';
import { archiveOnScreenDocument } from '@/components/documents/archive';


const LOGO = "/assets/citiway-logo.png";
const CO = 'Citiway Real Estate Brokerage L.L.C.';
let TRN = '100281605400003'; // overwritten from company_settings at render time (see App)
const footerText = (orn) =>
  `Citiway Real Estate Brokerage L.L.C. | License No. 726153, DED${orn ? ` | RERA ORN: ${orn}` : ''} | Office No. 205, Bayswater Tower, Business Bay, P.O. Box 34201, Dubai, UAE | Tel: +971 4 277 2373 / +971 4 277 2374 | Mobile: +971 52 771 3111 | info@citiway.com`;

/* ---------------- bilingual labels ---------------- */
const LABELS = {
  en: { to: 'To:', subject: 'Subject:', ref: 'Ref. No.', date: 'Date', attention: 'Attention', co: CO, forCo: `For ${CO}`, lic: 'License No. 726153, DED', orn: 'RERA ORN', trn: 'TRN' },
  ar: { to: 'إلى:', subject: 'الموضوع:', ref: 'الرقم المرجعي:', date: 'التاريخ:', attention: 'عناية:', co: 'سيتي واي للوساطة العقارية ذ.م.م', forCo: 'عن شركة سيتي واي للوساطة العقارية ذ.م.م', lic: 'رخصة رقم 726153، دائرة الاقتصاد والسياحة', orn: 'رقم المكتب لدى ريرا (ORN)', trn: 'الرقم الضريبي' },
};
const AR_FONT = "'IBM Plex Sans Arabic', 'Inter', sans-serif";
function arabicRatio(text) {
  const ar = (text.match(/[\u0600-\u06FF]/g) || []).length;
  const lat = (text.match(/[A-Za-z]/g) || []).length;
  return ar + lat ? ar / (ar + lat) : 0;
}

/* ---------------- unfilled [placeholder] guardrail ---------------- */
const PH_RE = /\[[^\[\]\n]{1,80}\]/g;
function findPlaceholders(d) {
  const parts = [d.ref, d.to, d.address, d.attention, d.subjectOn ? d.subject : '', d.salutation, d.body, d.signoff, d.signName, d.signTitle,
    ...(d.tableOn ? d.rows.flatMap((r) => [r.k, r.v]) : [])];
  const out = [];
  parts.forEach((t) => { (String(t || '').match(PH_RE) || []).forEach((m) => out.push(m)); });
  return out;
}
function hl(text) {
  if (!text) return text;
  const s = String(text); if (!PH_RE.test(s)) return s;
  PH_RE.lastIndex = 0;
  return s.split(/(\[[^\[\]\n]{1,80}\])/g).map((part, i) => (/^\[[^\[\]\n]{1,80}\]$/.test(part) ? <mark key={i} className="ph">{part}</mark> : part));
}
const MM = 96 / 25.4;

const fmtDate = (iso) => { if (!iso) return ''; const [y, m, d] = iso.split('-'); return `${d}/${m}/${y}`; };
const longDate = (iso, lang = 'en') => { if (!iso) return ''; const [y, m, d] = iso.split('-').map(Number); const dt = new Date(Date.UTC(y, m - 1, d)); return lang === 'ar' ? dt.toLocaleDateString('ar-AE-u-nu-latn', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }) : dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric', timeZone: 'UTC' }); };
const today = () => new Date().toISOString().slice(0, 10);
const uid = () => Math.random().toString(36).slice(2, 9);
const store = {
  get(k, f = '') { try { const v = localStorage.getItem(k); return v == null ? f : v; } catch (e) { return f; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} },
};

/* ---------------- number → words (AED) ---------------- */
const ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
function b1000(n) { let s = ''; if (n >= 100) { s += ONES[Math.floor(n / 100)] + ' Hundred'; n %= 100; if (n) s += ' '; } if (n >= 20) { s += TENS[Math.floor(n / 10)]; if (n % 10) s += '-' + ONES[n % 10]; } else if (n) s += ONES[n]; return s; }
function words(n) { if (!n) return 'Zero'; const out = []; for (const [v, w] of [[1e9, 'Billion'], [1e6, 'Million'], [1e3, 'Thousand']]) if (n >= v) { out.push(b1000(Math.floor(n / v)) + ' ' + w); n %= v; } if (n) out.push(b1000(n)); return out.join(' '); }
const aedWords = (amt) => { const c = Math.round(amt * 100), dh = Math.floor(c / 100), f = c % 100; return `UAE Dirhams ${words(dh)}${f ? ' and ' + words(f) + ' Fils' : ''} Only`; };
const aedFmt = (n) => 'AED ' + n.toLocaleString('en-US', { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 });

/* ================= Mode 1 — Built-in Smart Drafter ================= */
const BANKS = [
  [/emirates\s*nbd|enbd|الإمارات دبي الوطني|الامارات دبي الوطني/i, 'Emirates NBD'],
  [/\bfab\b|first abu dhabi|أبوظبي الأول|ابوظبي الاول/i, 'First Abu Dhabi Bank (FAB)'],
  [/\badcb\b|abu dhabi commercial|أبوظبي التجاري|ابوظبي التجاري/i, 'Abu Dhabi Commercial Bank (ADCB)'],
  [/\badib\b|abu dhabi islamic|أبوظبي الإسلامي|ابوظبي الاسلامي/i, 'Abu Dhabi Islamic Bank (ADIB)'],
  [/\bdib\b|dubai islamic|دبي الإسلامي|دبي الاسلامي/i, 'Dubai Islamic Bank (DIB)'],
  [/emirates islamic|الإمارات الإسلامي|الامارات الاسلامي/i, 'Emirates Islamic'],
  [/mashreq|المشرق/i, 'Mashreq Bank'],
  [/rak\s*bank|rakbank|رأس الخيمة|راس الخيمة/i, 'RAKBANK'],
  [/\bcbd\b|commercial bank of dubai|بنك دبي التجاري/i, 'Commercial Bank of Dubai (CBD)'],
  [/hsbc|إتش إس بي سي/i, 'HSBC Bank Middle East'],
  [/standard chartered|ستاندرد تشارترد/i, 'Standard Chartered Bank'],
];
const TITLES = [
  [/property consultant|مستشار عقاري|مستشارة عقارية/i, 'Property Consultant'],
  [/senior property consultant/i, 'Senior Property Consultant'],
  [/sales manager|مدير مبيعات|مديرة مبيعات/i, 'Sales Manager'],
  [/sales director|مدير المبيعات/i, 'Sales Director'],
  [/leasing (agent|consultant)|وكيل تأجير|مستشار تأجير/i, 'Leasing Consultant'],
  [/(real estate )?broker|وسيط عقاري/i, 'Real Estate Broker'],
  [/marketing manager|مدير تسويق|مديرة تسويق/i, 'Marketing Manager'],
  [/marketing executive|marketing specialist|أخصائي تسويق/i, 'Marketing Executive'],
  [/accountant|محاسب|محاسبة/i, 'Accountant'],
  [/admin(istrator|istrative)?( assistant| officer)?|إداري|ادارية/i, 'Administrative Officer'],
  [/office manager|مدير مكتب/i, 'Office Manager'],
  [/hr manager|human resources|موارد بشرية/i, 'HR Manager'],
  [/receptionist|موظف استقبال|موظفة استقبال/i, 'Receptionist'],
  [/driver|سائق/i, 'Driver'],
];
const NATS = [
  [/egyptian|مصري|مصرية/i, 'Egyptian'], [/indian|هندي|هندية/i, 'Indian'], [/pakistani|باكستاني/i, 'Pakistani'], [/filipino|filipina|فلبيني|فلبينية/i, 'Filipino'],
  [/jordanian|أردني|اردني/i, 'Jordanian'], [/syrian|سوري|سورية/i, 'Syrian'], [/lebanese|لبناني|لبنانية/i, 'Lebanese'], [/sudanese|سوداني/i, 'Sudanese'],
  [/moroccan|مغربي|مغربية/i, 'Moroccan'], [/tunisian|تونسي/i, 'Tunisian'], [/emirati|إماراتي|اماراتي/i, 'Emirati'], [/british|بريطاني/i, 'British'],
  [/russian|روسي/i, 'Russian'], [/bangladeshi|بنغالي/i, 'Bangladeshi'], [/nepali|نيبالي/i, 'Nepalese'], [/sri lankan|سريلانكي/i, 'Sri Lankan'],
];
const DEVS = ['Emaar', 'DAMAC', 'Sobha', 'Nakheel', 'Meraas', 'Azizi', 'Binghatti', 'Danube', 'Ellington', 'Select Group', 'Aldar', 'Omniyat', 'Dubai Properties', 'Deyaar', 'Samana', 'AIG'];
const pick = (text, list) => { for (const [re, v] of list) if (re.test(text)) return v; return ''; };

function parsePrompt(p) {
  const t = ' ' + p + ' ';
  let type = 'general';
  if (/salary|راتب|رواتب/i.test(t)) type = 'salary';
  else if (/commission|protection|عمولة|حماية/i.test(t)) type = 'commission';
  else if (/(developer|property|transfer|unit).{0,20}noc|noc.{0,30}(developer|transfer|unit|property)|نقل ملكية|مطور/i.test(t)) type = 'propnoc';
  else if (/\bnoc\b|no objection|عدم ممانعة|لا مانع/i.test(t)) type = 'noc';
  else if (/experience|employment cert|service cert|خبرة|شهادة عمل/i.test(t)) type = 'experience';

  let purpose = '';
  if (/driving|licen[cs]e|rta|رخصة|قيادة/i.test(t)) purpose = 'driving';
  else if (/visa|residen|تأشيرة|تاشيرة|إقامة|اقامة/i.test(t)) purpose = 'visa';
  else if (/travel|سفر/i.test(t)) purpose = 'travel';
  else if (/bank|account|حساب|بنك|مصرف/i.test(t)) purpose = 'bank';

  // amount
  let amt = 0;
  const am = t.match(/(?:aed|dhs?\.?|درهم)\s*([\d,]+(?:\.\d+)?)\s*(k)?/i) || t.match(/([\d,]+(?:\.\d+)?)\s*(k)?\s*(?:aed|dhs?|dirhams?|درهم)/i);
  if (am) { amt = parseFloat(am[1].replace(/,/g, '')) * (am[2] ? 1000 : 1); }
  // name (English, then Arabic)
  let name = '';
  const en = t.match(/(?:\bfor|\bof|employee|\bmr\.?|\bms\.?|\bmrs\.?|named|client|buyer|tenant|purchaser)\s+((?:[A-Z][a-zA-Z'\-]+)(?:\s+(?:[A-Z][a-zA-Z'\-]+|bin|bint|al|el|Al|El)){0,4})/);
  if (en && !/^(Emirates|Citiway|Dubai|Abu|The|AED|NOC)$/.test(en[1].split(' ')[0])) name = en[1].replace(/\s+(Property|Sales|Marketing|Leasing|Senior|Real)$/, '').trim();
  if (!name) {
    const ar = t.match(/(?:للموظف|للموظفة|للسيد|للسيدة|باسم|الموظف|الموظفة|للعميل|العميل|للمشتري)\s+([ء-ي]+(?:\s+[ء-ي]+){0,4})/);
    if (ar) {
      const STOP = /^(بنك|مصرف|براتب|راتب|مستشار|مستشارة|مدير|مديرة|بوظيفة|إلى|الى|من|في|على|جنسية|الجنسية|رخصة|تأشيرة|تاشيرة|حساب|وسيط|محاسب|محاسبة|سائق|يعمل|تعمل)$/;
      const out = [];
      for (const w of ar[1].split(/\s+/)) { if (STOP.test(w) || /^(لل|لا|لت|لف|لإ|لأ)/.test(w) || NATS.some(([re]) => re.test(w))) break; out.push(w); }
      name = out.join(' ');
    }
  }
  const title = pick(t, TITLES);
  const nat = pick(t, NATS);
  const bank = pick(t, BANKS);
  const eid = (t.match(/784-?\d{4}-?\d{7}-?\d/) || [''])[0];
  const pass = (t.match(/passport\s*(?:no\.?|number|#)?\s*([A-Z]{1,2}\d{6,8})/i) || ['', ''])[1];
  const doj = (t.match(/(?:join(?:ed|ing)?(?:\s+on|\s+date)?|since|from)\s*:?\s*(\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4}|\d{1,2}\s+[A-Z][a-z]+\s+\d{4}|[A-Z][a-z]+\s+\d{4})/) || ['', ''])[1];
  const dev = DEVS.find((d) => new RegExp('\\b' + d + '\\b', 'i').test(t)) || '';
  const unit = (t.match(/unit\s*(?:no\.?)?\s*([A-Z0-9\-\/]+)/i) || ['', ''])[1];
  const pctM = t.match(/(\d+(?:\.\d+)?)\s*%/); const pct = pctM ? pctM[1] : '';
  // client contact + registering agent (Dubai developer registration fields)
  const phone = ((t.match(/(?:\+?971|00971|\b0)[\s-]?5\d[\s-]?\d{3}[\s-]?\d{4}\b/) || [''])[0]).trim();
  const email = (t.match(/[\w.+-]+@[\w-]+\.[\w.-]+[A-Za-z]/) || [''])[0];
  const agM = t.match(/(?:\bagent|\bbroker)\s*(?:name)?\s*:?\s+((?:[A-Z][a-zA-Z'\-]+)(?:\s+[A-Z][a-zA-Z'\-]+){0,3})/)
    || t.match(/(?:الوكيل|الوسيط|المستشار)\s+([\u0621-\u064A]+(?:\s+[\u0621-\u064A]+){0,2})/);
  const agent = agM && !/^(AED|RERA|BRN|ORN|NOC)\b/.test(agM[1]) ? agM[1].replace(/\s+(RERA|BRN)$/, '').trim() : '';
  const brn = (t.match(/\bBRN\s*(?:no\.?|number|#)?\s*:?\s*(\d{3,7})/i) || ['', ''])[1];
  return { type, purpose, amt, name, title, nat, bank, eid, pass, doj, dev, unit, pct, phone, email, agent, brn, raw: p.trim() };
}

const BLANK = (v, ph) => v || `[${ph}]`;
function draft(type, f = {}) {
  const name = BLANK(f.name, 'Employee Name');
  const title = BLANK(f.title, 'Designation');
  const doj = f.doj || '[Date of Joining]';
  const idTxt = f.eid ? `Emirates ID No. ${f.eid}` : f.pass ? `Passport No. ${f.pass}` : 'Passport No. [Passport Number]';
  const natTxt = f.nat ? `, ${f.nat} national` : '';
  const empRows = (extra = []) => [
    { id: uid(), k: 'Employee Name', v: f.name || '' },
    { id: uid(), k: 'Nationality', v: f.nat || '' },
    { id: uid(), k: 'Passport / Emirates ID', v: f.eid || f.pass || '' },
    { id: uid(), k: 'Designation', v: f.title || '' },
    { id: uid(), k: 'Date of Joining', v: f.doj || '' },
    ...extra,
  ];
  switch (type) {
    case 'blank':
      return { to: '', address: '', attention: '', subjectOn: false, subject: '', salutation: '', body: '', tableOn: false, rows: [] };
    case 'salary': {
      const amtTxt = f.amt ? `${aedFmt(f.amt)} (${aedWords(f.amt)})` : 'AED [Amount] ([Amount in Words])';
      const bank = f.bank || '';
      return {
        to: bank ? `The Manager\n${bank}` : 'To Whom It May Concern', address: 'Dubai, United Arab Emirates', attention: bank ? 'Retail Banking / Loans Department' : '',
        subjectOn: true, subject: 'Salary Certificate', salutation: bank ? 'Dear Sir / Madam,' : '',
        body: [
          `This is to certify that ${name}, holder of ${idTxt}${natTxt}, is employed with ${CO} as ${title} since ${doj}, and is currently in our active employment.`,
          `The employee's current monthly gross salary is ${amtTxt}. The employment and salary details as per our records are summarised below:`,
          `This certificate is issued at the request of the employee${bank ? ` for submission to ${bank}` : ''}, without any financial or legal liability on the part of ${CO} or any of its signatories.`,
        ].join('\n\n'),
        tableOn: true, rows: empRows([{ id: uid(), k: 'Monthly Gross Salary', v: f.amt ? aedFmt(f.amt) : '' }]),
      };
    }
    case 'noc': {
      const P = {
        driving: ['The Roads & Transport Authority (RTA)', 'No Objection Certificate — Driving License', `obtaining a UAE driving license from the Roads & Transport Authority (RTA)`],
        visa: ['To Whom It May Concern', 'No Objection Certificate — Visa Application', `applying for and obtaining the required visa`],
        bank: [f.bank ? `The Manager\n${f.bank}` : 'To Whom It May Concern', 'No Objection Certificate — Bank Account Opening', `opening a personal bank account${f.bank ? ` with ${f.bank}` : ''}`],
        travel: ['To Whom It May Concern', 'No Objection Certificate — Travel', `travelling abroad during the employee's approved annual leave`],
        '': ['To Whom It May Concern', 'No Objection Certificate', `[state purpose, e.g. obtaining a UAE driving license]`],
      }[f.purpose || ''];
      return {
        to: P[0], address: 'Dubai, United Arab Emirates', attention: '', subjectOn: true, subject: P[1], salutation: P[0].startsWith('To Whom') ? '' : 'Dear Sir / Madam,',
        body: [
          `This is to certify that ${name}, holder of ${idTxt}${natTxt}, is employed with ${CO} as ${title} since ${doj}.`,
          `We hereby confirm that we have no objection to ${f.name || 'the above-named employee'} ${P[2]}.`,
          `This certificate is issued at the request of the employee, without any financial or legal liability on the part of ${CO} or any of its signatories.`,
        ].join('\n\n'),
        tableOn: true, rows: empRows(),
      };
    }
    case 'experience':
      return {
        to: 'To Whom It May Concern', address: '', attention: '', subjectOn: true, subject: 'Experience Certificate', salutation: '',
        body: [
          `This is to certify that ${name}, holder of ${idTxt}${natTxt}, has been employed with ${CO} as ${title} from ${doj} to [Last Working Day / till date].`,
          `During this period, ${f.name || 'the employee'} has demonstrated professionalism, integrity and dedication, and has carried out all assigned duties to our full satisfaction.`,
          `This certificate is issued at the request of the employee for whatever purpose it may serve, and we wish ${f.name ? f.name.split(' ')[0] : 'the employee'} every success in future endeavours.`,
        ].join('\n\n'),
        tableOn: true, rows: [
          { id: uid(), k: 'Employee Name', v: f.name || '' }, { id: uid(), k: 'Nationality', v: f.nat || '' }, { id: uid(), k: 'Designation', v: f.title || '' },
          { id: uid(), k: 'Period of Employment', v: f.doj ? `${f.doj} – [End Date]` : '' },
        ],
      };
    case 'commission': {
      const party = f.dev ? `${f.dev}` : '[Developer / Seller Name]';
      const pct = f.pct || '2';
      const ornTxt = f.orn ? `; RERA ORN ${f.orn}` : '';
      const agentTxt = `${f.agent || '[Agent Name]'} (RERA BRN ${f.brn || '[BRN]'})`;
      const clientId = f.eid || f.pass || '';
      return {
        to: f.dev ? `The Sales Manager\n${f.dev}` : '[Developer / Seller / Landlord]', address: 'Dubai, United Arab Emirates', attention: 'Sales / Broker Relations',
        subjectOn: true, subject: `Commission Undertaking & Client Protection${f.unit ? ` — Unit ${f.unit}` : ''}`, salutation: 'Dear Sir / Madam,',
        body: [
          `We, ${CO}, a RERA-registered brokerage (License No. 726153, DED${ornTxt}), hereby confirm that we have introduced the client named below to ${party} in respect of the property detailed in this letter. The client has been registered by our agent ${agentTxt}.`,
          `In consideration of this introduction, ${party} undertakes to pay ${CO} a commission of ${pct}% of the agreed transaction value, plus applicable VAT, upon the successful completion of the transaction, whether concluded directly or indirectly with the introduced client.`,
          `This client protection shall remain valid for six (6) months from the date of this letter. Kindly confirm your acceptance and the client registration by signing and stamping a copy of this letter.`,
        ].join('\n\n'),
        tableOn: true, rows: [
          { id: uid(), k: 'Introduced Client', v: f.name || '' },
          { id: uid(), k: 'Client Mobile / Email', v: [f.phone, f.email].filter(Boolean).join(' / ') },
          { id: uid(), k: 'Client Emirates ID / Passport No.', v: clientId },
          { id: uid(), k: 'Project / Property', v: '' },
          { id: uid(), k: 'Unit No.', v: f.unit || '' },
          { id: uid(), k: 'Agreed Commission', v: `${pct}% + VAT` },
          { id: uid(), k: 'Protection Validity', v: '6 months from the date of this letter' },
          { id: uid(), k: 'Registering Agent', v: f.agent || '' },
          { id: uid(), k: 'Agent RERA BRN', v: f.brn || '' },
        ],
      };
    }
    case 'propnoc':
      return {
        to: f.dev ? `The Customer Relations Department\n${f.dev}` : '[Developer Name]', address: 'Dubai, United Arab Emirates', attention: 'Customer Relations / NOC Department',
        subjectOn: true, subject: `Request for No Objection Certificate (NOC) — Transfer of Ownership${f.unit ? `, Unit ${f.unit}` : ''}`, salutation: 'Dear Sir / Madam,',
        body: [
          `We, ${CO}, acting as the appointed brokerage for the parties named below, kindly request the issuance of a No Objection Certificate (NOC) for the transfer of ownership of the property detailed in this letter.`,
          `Please advise us of any outstanding service charges or fees payable prior to the issuance of the NOC, together with the required documents, so that the transfer can be completed at the Dubai Land Department.`,
          `We thank you for your cooperation and look forward to your prompt response.`,
        ].join('\n\n'),
        tableOn: true, rows: [
          { id: uid(), k: 'Project / Building', v: '' }, { id: uid(), k: 'Unit No.', v: f.unit || '' }, { id: uid(), k: 'Seller (Current Owner)', v: '' },
          { id: uid(), k: 'Buyer', v: f.name || '' }, { id: uid(), k: 'Agreed Sale Price', v: f.amt ? aedFmt(f.amt) : '' },
        ],
      };
    default:
      return {
        to: 'To Whom It May Concern', address: 'Dubai, United Arab Emirates', attention: '', subjectOn: true,
        subject: f.raw ? f.raw.split(/\s+/).slice(0, 9).join(' ').replace(/[.,;:]+$/, '') : 'Subject',
        salutation: 'Dear Sir / Madam,',
        body: [
          `We, ${CO}, are writing in reference to the above subject.`,
          `[Write the main content of your letter here.]`,
          `Should you require any further information, please do not hesitate to contact us.`,
        ].join('\n\n'),
        tableOn: false, rows: [],
      };
  }
}
const PRESETS = [
  ['blank', 'Blank Letterhead'],
  ['salary', 'Salary Certificate (Bank / Loan)'],
  ['noc', 'Employee NOC (Visa / Driving / Bank)'],
  ['experience', 'Employment / Experience Certificate'],
  ['commission', 'Commission Undertaking / Protection Letter'],
  ['propnoc', 'Property / Developer NOC Request'],
];

/* ================= Mode 2 — Server-side AI (claude-sonnet-4-6) ================= */
async function callServerAI({ prompt, orn, trn }) {
  const r = await fetch('/api/letters/ai', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ prompt, orn, trn }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || r.statusText);
  const o = j.draft || {};
  return {
    to: o.to || '', address: o.address || '', attention: o.attention || '', subjectOn: !!o.subject, subject: o.subject || '',
    salutation: o.salutation || '', body: o.body || '', tableOn: !!o.tableOn && Array.isArray(o.rows) && o.rows.length > 0,
    rows: (o.rows || []).map((r) => ({ id: uid(), k: String(r.k || ''), v: String(r.v || '') })),
    ...(o.signoff ? { signoff: o.signoff } : {}), ...(o.signName ? { signName: o.signName } : {}), ...(o.signTitle ? { signTitle: o.signTitle } : {}),
  };
}

/* ================= Letter sheet ================= */
function LetterBody({ d, lang = 'en', orn = '' }) {
  const L = LABELS[lang];
  const rtl = lang === 'ar';
  const font = rtl ? AR_FONT : undefined;
  const TA = rtl ? 'right' : 'left'; // pin alignment to the letter's direction, even for mixed-script values
  const paras = d.body.split(/\n\s*\n/).map((s) => s.trim()).filter(Boolean);
  const insertAt = d.tableOn ? Math.min(paras.length, Math.max(1, paras.length - 1)) : -1; // table before the closing paragraph
  const table = d.tableOn && d.rows.length > 0 && (
    <table style={{ width: '88%', margin: '1mm auto 4mm', borderCollapse: 'separate', borderSpacing: 0, border: '1px solid #C9D9EE', borderRadius: '6px', overflow: 'hidden', fontSize: '9.4pt' }}>
      <colgroup><col style={{ width: '40%' }} /><col style={{ width: '60%' }} /></colgroup>
      <tbody>{d.rows.map((r, i) => (
        <tr key={r.id}>
          <td dir="auto" style={{ background: '#F4F8FC', color: '#1E3553', fontWeight: 600, padding: '1.7mm 3mm', textAlign: TA, borderBottom: i < d.rows.length - 1 ? '1px solid #E1E9F4' : 'none', borderInlineEnd: '1px solid #E1E9F4' }}>{hl(r.k)}</td>
          <td dir="auto" style={{ padding: '1.7mm 3mm', fontWeight: 600, color: '#111827', textAlign: TA, borderBottom: i < d.rows.length - 1 ? '1px solid #E1E9F4' : 'none' }}>{r.v ? hl(r.v) : <span style={{ color: '#CBD5E1' }}>—</span>}</td>
        </tr>))}
      </tbody>
    </table>
  );
  const P = (t, i) => <p key={i} dir="auto" style={{ margin: '0 0 3.4mm', textAlign: 'justify', lineHeight: 1.6, whiteSpace: 'pre-line' }}>{hl(t)}</p>;
  const meta = [[L.ref, d.ref], [L.date, longDate(d.date, lang)], ...(d.attention ? [[L.attention, d.attention]] : [])];

  return (
    <div dir={rtl ? 'rtl' : 'ltr'} lang={lang} style={{ fontSize: '10.4pt', color: '#1F2937', fontFamily: font }}>
      {/* Header — flex mirrors automatically in RTL (logo on the right, metadata on the left) */}
      <div className="flex items-start justify-between">
        <div>
          <img src={LOGO} alt="Citiway Real Estate" style={{ height: '13mm' }} />
          <div style={{ marginTop: '2.6mm', fontSize: '8.4pt', lineHeight: 1.5, color: '#3F3F3F' }}>
            <div style={{ fontWeight: 600, color: '#1E3553' }}>{L.co}</div>
            <div>{L.lic}{orn ? <> &nbsp;|&nbsp; {L.orn}: <span dir="ltr">{orn}</span></> : null}</div>
            <div>{L.trn}: <span dir="ltr">{TRN}</span></div>
          </div>
        </div>
        <table style={{ fontSize: '8.8pt', borderCollapse: 'collapse', marginTop: '1mm' }}>
          <tbody>
            {meta.map(([k, v]) => (
              <tr key={k}><td style={{ color: '#64748B', textAlign: 'end', paddingBlock: '0.7mm', paddingInlineEnd: '3mm', whiteSpace: 'nowrap' }}>{k}</td><td dir="auto" style={{ fontWeight: 600, color: '#1E3553', borderBottom: '1px solid #C9D9EE', padding: '0.7mm 2mm', minWidth: '36mm', maxWidth: '62mm', textAlign: TA }}>{hl(v)}</td></tr>))}
          </tbody>
        </table>
      </div>

      {/* Recipient */}
      {(d.to || d.address) && (
        <div style={{ marginTop: '8mm', lineHeight: 1.5 }}>
          {d.to && <div style={{ fontWeight: 700, color: '#111827', whiteSpace: 'pre-line', textAlign: TA }}><span style={{ color: '#64748B', fontWeight: 500, marginInlineEnd: '2mm' }}>{L.to}</span><span dir="auto">{hl(d.to)}</span></div>}
          {d.address && <div dir="auto" style={{ color: '#475569', textAlign: TA, paddingInlineStart: d.to ? (rtl ? '9mm' : '7.5mm') : 0 }}>{hl(d.address)}</div>}
        </div>
      )}

      {/* Subject bar — accent border on the reading-start side */}
      {d.subjectOn && d.subject && (
        <div style={{
          marginTop: '6mm', background: '#EAF1FA', padding: '2.4mm 4mm', fontWeight: 700, color: '#1E3553', fontSize: '9.6pt',
          ...(rtl
            ? { borderRight: '1.3mm solid #1E3553', borderRadius: '5px 0 0 5px', fontFamily: AR_FONT }
            : { borderLeft: '1.3mm solid #1E3553', borderRadius: '0 5px 5px 0', fontFamily: 'Montserrat, sans-serif', textTransform: 'uppercase', letterSpacing: '.04em' }),
        }}>
          {L.subject} <span dir="auto">{hl(d.subject)}</span>
        </div>
      )}

      {/* Body */}
      <div style={{ marginTop: '6mm' }}>
        {d.salutation && <p dir="auto" style={{ margin: '0 0 3.4mm', textAlign: TA }}>{hl(d.salutation)}</p>}
        {paras.length === 0 && !d.tableOn ? <div style={{ minHeight: '20mm' }} /> : null}
        {paras.map((t, i) => (<React.Fragment key={i}>{i === insertAt && table}{P(t, i)}</React.Fragment>))}
        {insertAt >= paras.length && table}
      </div>

      {/* Signatory — sits on the reading-start side; stamp mirrors with it */}
      <div style={{ marginTop: '6mm' }}>
        {d.signoff && <p dir="auto" style={{ margin: 0, textAlign: TA }}>{hl(d.signoff)}</p>}
        <div style={{ width: '75mm', position: 'relative' }}>
          <div style={{ height: '24mm', position: 'relative' }}>
            <StampSlot align={rtl ? 'right' : 'left'} style={{ [rtl ? 'right' : 'left']: '-2mm', bottom: '-3mm', height: '27mm', width: '75mm' }} />
          </div>
          <div style={{ borderTop: '1px solid #1E3553', paddingTop: '1.4mm', lineHeight: 1.45 }}>
            <div dir="auto" style={{ fontWeight: 700, color: '#111827', textAlign: TA }}>{hl(d.signName)}</div>
            <div dir="auto" style={{ color: '#475569', fontSize: '9.4pt', textAlign: TA }}>{hl(d.signTitle)}</div>
            <div style={{ color: '#1E3553', fontSize: '8.8pt', fontWeight: 600 }}>{L.forCo}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* Body box: 174mm wide. Content is scaled with transform (works the same in Chrome, Safari and Firefox);
   the inner box is widened by 1/fit so that, once scaled, it still spans exactly 174mm. */
const BODY_W_MM = 174;
function Sheet({ d, fit, lang, orn }) {
  return (
    <div id="print-root" className="a4" style={{ padding: 0, display: 'block', position: 'relative' }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '1.6mm', background: 'linear-gradient(90deg,#1E3553 0%,#1E3553 62%,#7AA3D8 62%,#7AA3D8 100%)' }} />
      <div style={{ position: 'absolute', top: '12mm', left: '18mm', width: `${BODY_W_MM}mm`, overflow: 'visible' }}>
        <div style={{ width: `${BODY_W_MM / fit}mm`, transform: `scale(${fit})`, transformOrigin: 'top left' }}>
          <LetterBody d={d} lang={lang} orn={orn} />
        </div>
      </div>
      <div style={{ position: 'absolute', left: '14mm', right: '14mm', bottom: '7mm' }}>
        <div style={{ height: '0.6mm', background: 'linear-gradient(90deg,#1E3553,#7AA3D8)', borderRadius: '1mm', marginBottom: '2.4mm' }} />
        <p style={{ textAlign: 'center', fontSize: '7.2pt', lineHeight: 1.55, color: '#555', margin: 0 }}>{footerText(orn)}</p>
      </div>
    </div>
  );
}
function ScaledA4({ children }) {
  const ref = useRef(null);
  const [scale, setScale] = useState(0.7);
  useEffect(() => { const el = ref.current; const ro = new ResizeObserver(() => setScale(Math.min(1.1, Math.max(0.3, (el.clientWidth - 32) / 794)))); ro.observe(el); return () => ro.disconnect(); }, []);
  return (
    <div ref={ref} className="w-full">
      <div className="scaler" style={{ width: 794 * scale, height: 1123 * scale, margin: '0 auto' }}>
        <div className="scaler" style={{ transform: `scale(${scale})`, transformOrigin: 'top left', width: 794, boxShadow: '0 12px 40px rgba(30,53,83,.18)', borderRadius: 4, overflow: 'hidden' }}>{children}</div>
      </div>
    </div>
  );
}

/* ================= Form atoms ================= */
function Field({ label, children, hint }) {
  return (<label className="block"><span className="block text-[12px] font-semibold text-navy mb-1 tracking-wide">{label}</span>{children}{hint && <span className="block text-[11px] text-slate-500 mt-1">{hint}</span>}</label>);
}
function Input(props) { return <input {...props} className={'field-in ' + (props.className || '')} />; }
function Card({ title, right, children, className = '' }) {
  return (
    <section className={'glass rounded-xl p-4 ' + className}>
      <div className="flex items-center justify-between mb-3 gap-2"><h3 className="font-head font-bold text-[13px] uppercase tracking-wider text-navy flex items-center gap-2"><span className="w-1 h-4 rounded bg-brand inline-block" />{title}</h3>{right}</div>
      <div className="space-y-3">{children}</div>
    </section>
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
function Modal({ title, children, onClose }) {
  return (
    <div className="no-print fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(15,23,42,.55)' }} onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-[460px] p-5 space-y-3">
        <h3 className="font-head font-bold text-[15px] text-navy">{title}</h3>
        {children}
      </div>
    </div>
  );
}

/* ================= Reference counter helpers ================= */
const REF_RE = /^CW-LTR-(\d{4})-(\d{4,})$/;
const fmtRef = (year, n) => `CW-LTR-${year}-${String(n).padStart(4, '0')}`;
const seqKey = (year) => `cw_ltr_seq_${year}`;
const nextSeq = (year) => Math.max(1, parseInt(store.get(seqKey(year), '1'), 10) || 1);
/* ================= App ================= */
function App({ company = {}, developers = [], agents = [], clients = [], initial = {} }) {
  if (company.trn) TRN = company.trn;
  const YEAR = new Date().getFullYear();
  const [d, setD] = useState(() => ({
    ref: company.nextRef || fmtRef(YEAR, nextSeq(YEAR)), date: today(),
    signoff: 'Yours sincerely,', signName: 'Authorized Signatory', signTitle: 'Managing Director',
    ...draft('salary', { name: 'Ahmed Ali', title: 'Property Consultant', amt: 12000, bank: 'Emirates NBD', nat: 'Egyptian', doj: '01/03/2024' }),
  }));
  const upd = (patch) => setD((p) => ({ ...p, ...(typeof patch === 'function' ? patch(p) : patch) }));
  const set = (k) => (e) => upd({ [k]: e.target.value });

  // company settings
  const [orn, setOrn] = useState(() => company.rera_orn || store.get('cw_orn', ''));
  useEffect(() => { store.set('cw_orn', orn.trim()); }, [orn]);

  // language: auto-detect from content, or forced EN / AR
  const [langMode, setLangMode] = useState('auto');
  const ratio = arabicRatio([d.subject, d.to, d.salutation, d.body].join(' '));
  const lang = langMode === 'auto' ? (ratio > 0.3 ? 'ar' : 'en') : langMode;

  // AI box
  const [prompt, setPrompt] = useState('');
  const [aiOpen, setAiOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState(null);

  // ---- CRM links: template type, developer & agent (auto-populate + validation) ----
  const [tpl, setTpl] = useState('salary');
  const [devId, setDevId] = useState('');
  const [agentId, setAgentId] = useState('');
  const [clientId, setClientId] = useState('');
  const fRef = useRef({ name: 'Ahmed Ali', title: 'Property Consultant', amt: 12000, bank: 'Emirates NBD', nat: 'Egyptian', doj: '01/03/2024' });
  const selDev = developers.find((x) => x.id === devId) || null;
  const selAgent = agents.find((x) => x.id === agentId) || null;
  const devIssues = [];
  if (selDev && (tpl === 'commission' || tpl === 'propnoc')) {
    const st = developerStatus(selDev.end_date); const left = daysLeft(selDev.end_date);
    if (st === 'expired') devIssues.push({ level: 'err', text: `The agreement with ${selDev.developer_name} EXPIRED ${Math.abs(left)} day(s) ago (${fmtDate(selDev.end_date)}). Renew it before issuing a commission undertaking.` });
    else if (st === 'expiring') devIssues.push({ level: 'warn', text: `The agreement with ${selDev.developer_name} expires in ${left} day(s) (${fmtDate(selDev.end_date)}).` });
    if (!selDev.has_noc) devIssues.push({ level: 'err', text: `No NOC has been recorded from ${selDev.developer_name}.` });
  }
  const brnIssue = selAgent && selAgent.brn_expiry_date && daysLeft(selAgent.brn_expiry_date) < 0 ? `${selAgent.full_name}'s RERA BRN card expired on ${fmtDate(selAgent.brn_expiry_date)}.` : '';
  const clientFields = (c) => {
    const idn = c.id_passport_no || '';
    return { name: c.full_name, phone: c.phone || '', email: c.email || '', nat: c.nationality || '', eid: /^784/.test(idn) ? idn : '', pass: /^784/.test(idn) ? '' : idn };
  };
  const applyClient = (nextId) => {
    setClientId(nextId);
    const c = clients.find((x) => x.id === nextId); if (!c) return;
    fRef.current = { ...fRef.current, ...clientFields(c) };
    if (tpl !== 'blank' && tpl !== 'general') upd(draft(tpl, { ...fRef.current, orn: orn.trim() }));
  };
  // Deep-links from the Clients / Deals vault (?client=…&developer=…&agent=…&template=commission)
  useEffect(() => {
    const cl = clients.find((x) => x.id === initial.client); const dv = developers.find((x) => x.id === initial.developer);
    const ag = agents.find((x) => x.id === (initial.agent || company.currentAgentId));
    if (!cl && !dv && !ag && !initial.template) return;
    const f = { ...(initial.template ? {} : fRef.current), ...(cl ? clientFields(cl) : {}), ...(dv ? { dev: dv.developer_name } : {}), ...(ag ? { agent: ag.full_name, brn: ag.rera_brn || '' } : {}), ...(initial.unit ? { unit: initial.unit } : {}) };
    fRef.current = f; if (cl) setClientId(cl.id); if (dv) setDevId(dv.id); if (ag) setAgentId(ag.id);
    if (initial.template) { const t = initial.template; setTpl(t); upd(draft(t, { ...f, orn: orn.trim() })); }
  }, []);
  const applyLinks = (nextDevId, nextAgentId) => {
    const dv = developers.find((x) => x.id === nextDevId); const ag = agents.find((x) => x.id === nextAgentId);
    fRef.current = { ...fRef.current, ...(dv ? { dev: dv.developer_name } : {}), ...(ag ? { agent: ag.full_name, brn: ag.rera_brn || '' } : {}) };
    if (tpl === 'commission' || tpl === 'propnoc') upd(draft(tpl, { ...fRef.current, orn: orn.trim() }));
  };

  const smartDraft = () => {
    if (!prompt.trim()) { setNote({ kind: 'warn', text: 'Type a short description first, or pick a preset.' }); return; }
    const f = parsePrompt(prompt);
    const dvMatch = f.dev && developers.find((x) => x.developer_name.toLowerCase().includes(f.dev.toLowerCase()));
    if (dvMatch) setDevId(dvMatch.id);
    const agMatch = f.agent && agents.find((x) => x.full_name.toLowerCase().includes(f.agent.toLowerCase()));
    if (agMatch) setAgentId(agMatch.id);
    const chosenAg = agMatch || selAgent; const chosenDv = dvMatch || selDev;
    if (chosenAg) { f.agent = f.agent || chosenAg.full_name; f.brn = f.brn || chosenAg.rera_brn || ''; }
    if (chosenDv) f.dev = chosenDv.developer_name;
    fRef.current = f; setTpl(f.type);
    upd(draft(f.type, { ...f, orn: orn.trim() }));
    const found = [f.name && `name: ${f.name}`, f.title && `title: ${f.title}`, f.doj && `joined: ${f.doj}`, (f.eid || f.pass) && `ID: ${f.eid || f.pass}`, f.amt && `amount: ${aedFmt(f.amt)}`, f.pct && `commission: ${f.pct}%`, f.bank && `bank: ${f.bank}`, f.nat && `nationality: ${f.nat}`, f.dev && `developer: ${f.dev}`, f.unit && `unit: ${f.unit}`, f.purpose && `purpose: ${f.purpose}`, f.phone && `phone: ${f.phone}`, f.email && `email: ${f.email}`, f.agent && `agent: ${f.agent}`, f.brn && `BRN: ${f.brn}`].filter(Boolean);
    const label = (PRESETS.find((p) => p[0] === f.type) || [, 'General letter'])[1];
    setNote({ kind: 'ok', text: `Drafted: ${label}. ${found.length ? 'Detected ' + found.join(' · ') + '.' : 'No details detected — fill the [placeholders].'} Review every field before exporting.` });
  };
  const aiDraft = async () => {
    if (!prompt.trim()) { setNote({ kind: 'warn', text: 'Type a description of the document first.' }); return; }
    setBusy(true); setNote(null);
    try { const r = await callServerAI({ prompt, orn: orn.trim(), trn: TRN }); setTpl('general'); upd(r); setNote({ kind: 'ok', text: 'AI draft applied. Review every field before exporting.' }); }
    catch (e) { setNote({ kind: 'err', text: `AI request failed: ${e.message}. You can still use "Smart Draft" (offline).` }); }
    finally { setBusy(false); }
  };

  // fit to one A4 (measured unscaled, applied with transform)
  const measRef = useRef(null);
  const [natural, setNatural] = useState(0);
  const [, setTick] = useState(0);
  useEffect(() => { document.fonts && document.fonts.ready.then(() => setTick((t) => t + 1)); }, []);
  useLayoutEffect(() => { const el = measRef.current; if (!el) return; const h = el.getBoundingClientRect().height; if (Math.abs(h - natural) > 0.5) setNatural(h); });
  const avail = 297 * MM - 12 * MM - 7 * MM - 13 * MM - 4 * MM;
  const fit = natural > avail ? Math.max(0.6, avail / natural) : 1;

  // placeholders
  const placeholders = findPlaceholders(d);
  const uniquePh = [...new Set(placeholders)];

  // reference counter — advances after an issued letter is printed / exported.
  // Persisted in Supabase (company_settings.next_letter_seq); falls back to localStorage when offline.
  const dRef = useRef(d); dRef.current = d;
  const signoff = useSignoff(); const signoffRef = useRef(signoff); signoffRef.current = signoff;
  const metaRef = useRef({}); metaRef.current = { tpl, devId, agentId, clientId, lang };
  const [seqInfo, setSeqInfo] = useState(nextSeq(YEAR));
  const [saveNote, setSaveNote] = useState('');
  const issuedRef = useRef(false); // set only by the explicit "Save & Issue" button
  const esc = (t) => String(t || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  // Records the letter in the CRM (letters table). Nothing is saved or advanced unless the user clicks it.
  const issueLetter = async () => {
    const cur = dRef.current; const m = REF_RE.exec(cur.ref || '');
    if (!m || Number(m[1]) !== YEAR) { setSaveNote(`Cannot issue: the reference must look like CW-LTR-${YEAR}-0001.`); return false; }
    if (!isSupabaseConfigured()) { issuedRef.current = true; setSaveNote('CRM not connected — letter will not be recorded.'); return true; }
    try {
      const meta = metaRef.current;
      const html = (cur.salutation ? `<p>${esc(cur.salutation)}</p>` : '') + (cur.body || '').split(/\n\s*\n/).filter(Boolean).map((p) => `<p>${esc(p)}</p>`).join('')
        + (cur.tableOn ? '<table>' + cur.rows.map((r) => `<tr><th>${esc(r.k)}</th><td>${esc(r.v)}</td></tr>`).join('') + '</table>' : '');
      const res = await issueLetterAction({ refNo: cur.ref, templateType: ({ salary: 'salary_certificate', commission: 'commission_undertaking', noc: 'noc', propnoc: 'noc' })[meta.tpl] || 'general', language: meta.lang, recipient: cur.to || null, subject: cur.subject || null, bodyHtml: html, developerId: meta.devId || null, agentId: meta.agentId || null, clientId: meta.clientId || null });
      if (!res.ok && res.duplicate) { setSaveNote(`${cur.ref} was already issued. Click "use next" to get a fresh reference number.`); return false; }
      if (!res.ok) { setSaveNote('Could not save the letter to the CRM: ' + res.error); return false; }
      issuedRef.current = true; setSaveNote(res.message);
      if (res.id) {
        setSaveNote(res.message + ' Archiving the PDF…');
        const arc = await archiveOnScreenDocument({ table: 'letters', id: res.id, title: `Letter ${cur.ref}`, mode: signoffRef.current.mode });
        setSaveNote(res.message + ' ' + arc.message);
      }
      return true;
    } catch (e) { setSaveNote('Could not reach the CRM: ' + e.message); return false; }
  };
  useEffect(() => {
    // After the print dialog closes: only an explicitly issued letter consumes its number.
    const after = async () => {
      if (issuedRef.current) {
        issuedRef.current = false;
        const m = REF_RE.exec(dRef.current.ref || ''); const used = m ? parseInt(m[2], 10) : 0;
        if (isSupabaseConfigured()) {
          const { data: nextRef, error } = await createClient().rpc('advance_letter_seq', { p_year: YEAR, p_seq: used });
          if (!error && nextRef) { const n = REF_RE.exec(nextRef); if (n) setSeqInfo(parseInt(n[2], 10)); upd({ ref: nextRef }); }
        } else {
          const nxt = Math.max(nextSeq(YEAR), used + 1);
          store.set(seqKey(YEAR), String(nxt)); setSeqInfo(nxt); upd({ ref: fmtRef(YEAR, nxt) });
        }
      }
      if (signoffRef.current.mode === 'stamp') signoffRef.current.setMode('none'); // stamp never stays armed after an export
    };
    window.addEventListener('afterprint', after);
    return () => window.removeEventListener('afterprint', after);
  }, []);
  const resetCounter = () => { store.set(seqKey(YEAR), '1'); setSeqInfo(1); upd({ ref: fmtRef(YEAR, 1) }); };

  // print with placeholder guardrail
  const [phModal, setPhModal] = useState(false);
  const [printMsg, setPrintMsg] = useState('');
  const reallyPrint = () => {
    setPhModal(false);
    setTimeout(() => {
      try { window.print(); setPrintMsg('If no print dialog appeared, this viewer blocks printing — open the .html file in Chrome/Edge and press Ctrl/Cmd + P.'); }
      catch (e) { setPrintMsg('Printing is blocked in this viewer — open the .html file in your browser and press Ctrl/Cmd + P.'); }
    }, 50);
  };
  const doPrint = () => {
    if (devIssues.some((i) => i.level === 'err') && !window.confirm('Developer validation failed:\n\n' + devIssues.map((i) => '• ' + i.text).join('\n') + '\n\nPrint anyway?')) return;
    if (uniquePh.length) setPhModal(true); else reallyPrint();
  };

  const issueAndPrint = async () => {
    if (uniquePh.length) { setSaveNote('Fill or remove the highlighted [placeholders] before issuing — a plain Print still works for drafts.'); return; }
    if (devIssues.some((i) => i.level === 'err') && !window.confirm('Developer validation failed:\n\n' + devIssues.map((i) => '• ' + i.text).join('\n') + '\n\nIssue anyway?')) return;
    if (await issueLetter()) reallyPrint();
  };

  // manager hand-off
  const requester = (d.rows.find((r) => /name|client|buyer/i.test(r.k)) || {}).v || '';
  const msg = `Dear Manager,\n\nPlease review, sign and stamp the attached document:\n• Ref. No.: ${d.ref}\n• Date: ${fmtDate(d.date)}\n• Subject: ${d.subject || '—'}\n• Addressed to: ${(d.to || '—').replace(/\n/g, ', ')}${requester ? `\n• Employee / Requester: ${requester}` : ''}\n\nThe exported PDF is attached for your signature.\n\nThank you.`;
  const [mgrPhone, setMgrPhone] = useState(() => store.get('cw_mgr_phone', ''));
  const [mgrEmail, setMgrEmail] = useState(() => store.get('cw_mgr_email', ''));
  useEffect(() => { store.set('cw_mgr_phone', mgrPhone); }, [mgrPhone]);
  useEffect(() => { store.set('cw_mgr_email', mgrEmail); }, [mgrEmail]);
  const waUrl = `https://wa.me/${mgrPhone.replace(/[^\d]/g, '')}?text=${encodeURIComponent(msg)}`;
  const mailUrl = `mailto:${encodeURIComponent(mgrEmail)}?subject=${encodeURIComponent(`For Signature: ${d.subject || 'Letter'} — ${d.ref}`)}&body=${encodeURIComponent(msg)}`;
  const ActionBar = ({ compact }) => (
    <div className={`flex gap-2 ${compact ? '' : 'flex-col'}`}>
      <button type="button" onClick={issueAndPrint} title="Records the letter in the CRM, then opens print / PDF" className={`btn-success text-white font-semibold text-sm px-3 py-2 rounded-lg whitespace-nowrap ${compact ? '' : 'w-full'}`}>① Save &amp; Issue</button>
      <button type="button" onClick={doPrint} className={`btn-brand text-navy font-semibold text-sm px-3 py-2 rounded-lg whitespace-nowrap ${compact ? '' : 'w-full'}`}>Print draft</button>
      <a href={waUrl} target="_blank" rel="noopener" className={`text-center btn-whatsapp text-white font-semibold text-sm px-3 py-2 rounded-lg whitespace-nowrap ${compact ? '' : 'w-full'}`}>② Send via WhatsApp</a>
      <a href={mailUrl} className={`text-center font-semibold text-sm px-3 py-2 rounded-lg whitespace-nowrap ${compact ? 'btn-glass text-white' : 'w-full btn-outline text-navy'}`}>②B Send via Email</a>
    </div>
  );

  return (
    <div className="min-h-screen">
      <header className="no-print cw-topbar text-white">
        <div className="max-w-[1500px] mx-auto px-5 py-3 flex items-center gap-4 flex-wrap">
          <div>
            <div className="font-head font-bold tracking-wide">Letterhead &amp; Document Generator</div>
            <div className="text-[12px] text-blue-100">Template #10 · AI-assisted · EN / AR · 1-page A4</div>
          </div>
          <div className="ml-auto"><ActionBar compact /></div>
        </div>
        {printMsg && <div className="max-w-[1500px] mx-auto px-5 pb-3 text-[12px] text-blue-100">{printMsg}</div>}
      </header>

      <main className="max-w-[1500px] mx-auto p-5 grid gap-5 lg:grid-cols-[480px_1fr] items-start">
        {/* ---------------- LEFT ---------------- */}
        <div className="no-print space-y-4 lg:max-h-[calc(100vh-110px)] lg:overflow-y-auto lg:pr-1">
          {/* AI box */}
          <section className="rounded-xl glass-accent p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-head font-bold text-[14px] uppercase tracking-wider text-navy">✨ AI Document Assistant</h3>
              <span className="text-[11px] text-slate-600">English · العربية</span>
            </div>
            <textarea rows={3} dir="auto" className="field-in" value={prompt} onChange={(e) => setPrompt(e.target.value)}
              placeholder="Describe the document you need in English or Arabic (e.g., 'Salary certificate for Ahmed Ali, Property Consultant, AED 12,000/month, addressed to Emirates NBD' or 'NOC for driving license')..." />
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={smartDraft} className="btn-primary text-white font-semibold text-sm py-2.5 rounded-lg">⚡ Smart Draft <span className="font-normal opacity-75 text-[11px]">(no key)</span></button>
              <button type="button" onClick={aiDraft} disabled={busy} className="btn-outline font-semibold text-sm py-2.5 rounded-lg disabled:opacity-60">{busy ? 'Generating…' : 'Generate with AI ✨'}</button>
            </div>
            {note && <div className={`text-[12px] rounded-md p-2 ${note.kind === 'ok' ? 'bg-emerald-50 border border-emerald-200 text-emerald-800' : note.kind === 'err' ? 'bg-red-50 border border-red-200 text-red-800' : 'bg-amber-50 border border-amber-200 text-amber-800'}`}>{note.text}</div>}
            <div>
              <div className="text-[11px] font-bold text-navy uppercase tracking-wider mb-1.5">Quick presets</div>
              <div className="flex flex-wrap gap-1.5">
                {PRESETS.map(([k, l]) => <button key={k} type="button" onClick={() => { const pf = k === 'blank' ? {} : { ...parsePrompt(prompt), ...(selDev ? { dev: selDev.developer_name } : {}), ...(selAgent ? { agent: selAgent.full_name, brn: selAgent.rera_brn || '' } : {}) }; fRef.current = pf; setTpl(k); upd(draft(k, k === 'blank' ? {} : { ...pf, orn: orn.trim() })); setNote({ kind: 'ok', text: `${l} loaded${prompt.trim() && k !== 'blank' ? ' using details from your description' : ''}. Fill any [placeholders].` }); }}
                  className="text-[12px] font-semibold px-2.5 py-1.5 rounded-full cw-pill">{l}</button>)}
              </div>
            </div>
            <div className="text-[11px] text-slate-600 bg-white border border-slate-200 rounded-lg px-3 py-2">AI Draft runs securely on the Citiway server (Claude Sonnet 4.6) — no API key needed in the browser. Smart Draft works fully offline.</div>
          </section>

          <Card title="CRM Links — Developer & Agent">
            <div className="grid grid-cols-2 gap-2">
              <Field label="Developer">
                <select className="field-in" value={devId} onChange={(e) => { setDevId(e.target.value); applyLinks(e.target.value, agentId); }}>
                  <option value="">— none —</option>
                  {developers.map((x) => <option key={x.id} value={x.id}>{x.developer_name}</option>)}
                </select>
              </Field>
              <Field label="Agent">
                <select className="field-in" value={agentId} onChange={(e) => { setAgentId(e.target.value); applyLinks(devId, e.target.value); }}>
                  <option value="">— none —</option>
                  {agents.filter((x) => x.is_active).map((x) => <option key={x.id} value={x.id}>{x.full_name}{x.rera_brn ? ` · BRN ${x.rera_brn}` : ''}</option>)}
                </select>
              </Field>
            </div>
            {clients.length > 0 && (
              <Field label="Client (auto-fills name, contact & ID)">
                <select className="field-in" value={clientId} onChange={(e) => applyClient(e.target.value)}>
                  <option value="">— none —</option>
                  {clients.map((x) => <option key={x.id} value={x.id}>{x.full_name}</option>)}
                </select>
              </Field>
            )}
            {developers.length === 0 && agents.length === 0 && <div className="text-[11px] text-slate-500">No developers or agents loaded — add them in the CRM to enable auto-fill and validation.</div>}
            {devIssues.map((i, k) => <div key={k} role="alert" className={`text-[12px] rounded-md p-2 border ${i.level === 'err' ? 'bg-red-50 border-red-200 text-red-800' : 'bg-amber-50 border-amber-200 text-amber-800'}`}>⚠ {i.text}</div>)}
            {brnIssue && <div role="alert" className="text-[12px] rounded-md p-2 border bg-red-50 border-red-200 text-red-800">⚠ {brnIssue}</div>}
            {selDev && !devIssues.length && (tpl === 'commission' || tpl === 'propnoc') && <div className="text-[12px] rounded-md p-2 border bg-emerald-50 border-emerald-200 text-emerald-800">✓ Agreement with {selDev.developer_name} is active and NOC is on file.</div>}
            {saveNote && <div className="text-[11px] text-slate-500">{saveNote}</div>}
          </Card>

          <Card title="Letter Header" right={
            <div className="flex gap-1 p-0.5 bg-slate-100 rounded-lg">
              {[['auto', `Auto${langMode === 'auto' ? ` · ${lang.toUpperCase()}` : ''}`], ['en', 'EN'], ['ar', 'AR']].map(([v, l]) => (
                <button key={v} type="button" onClick={() => setLangMode(v)} className={`text-[11px] font-bold px-2 py-1 rounded-md ${langMode === v ? 'bg-navy text-white' : 'text-slate-600'}`}>{l}</button>))}
            </div>}>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Ref. No." hint={<span>Auto-advances after each export · next: {fmtRef(YEAR, seqInfo)} · <button type="button" className="underline" onClick={() => upd({ ref: fmtRef(YEAR, nextSeq(YEAR)) })}>use next</button> · <button type="button" className="underline text-red-600" onClick={resetCounter}>reset to 0001</button></span>}>
                <Input value={d.ref} onChange={set('ref')} />
              </Field>
              <Field label="Date"><Input type="date" value={d.date} onChange={set('date')} /></Field>
            </div>
            <Field label="Attention / Dept. (optional)"><Input value={d.attention} onChange={set('attention')} dir="auto" /></Field>
            <Field label="To" hint="Use a new line for each line of the recipient."><textarea rows={2} dir="auto" className="field-in" value={d.to} onChange={set('to')} /></Field>
            <Field label="Address / Emirate (optional)"><Input value={d.address} onChange={set('address')} dir="auto" /></Field>
            <Switch on={d.subjectOn} onChange={(v) => upd({ subjectOn: v })} label="Subject Bar" />
            {d.subjectOn && <Field label="Subject"><Input value={d.subject} onChange={set('subject')} dir="auto" /></Field>}
          </Card>

          <Card title="Letter Body">
            <Field label="Salutation"><Input value={d.salutation} onChange={set('salutation')} dir="auto" placeholder="Dear Sir / Madam," /></Field>
            <Field label="Body" hint="Leave a blank line between paragraphs. The details table is placed before the last paragraph."><textarea rows={10} dir="auto" className="field-in" value={d.body} onChange={set('body')} /></Field>
            <Switch on={d.tableOn} onChange={(v) => upd((p) => ({ tableOn: v, rows: v && p.rows.length === 0 ? [{ id: uid(), k: 'Employee Name', v: '' }, { id: uid(), k: 'Designation', v: '' }] : p.rows }))} label="Structured Details Table" />
            {d.tableOn && (<div className="space-y-1.5">
              {d.rows.map((r) => (
                <div key={r.id} className="grid gap-2 items-center" style={{ gridTemplateColumns: '1fr 1.3fr 20px' }}>
                  <Input value={r.k} dir="auto" placeholder="Label" onChange={(e) => upd((p) => ({ rows: p.rows.map((x) => (x.id === r.id ? { ...x, k: e.target.value } : x)) }))} />
                  <Input value={r.v} dir="auto" placeholder="Value" onChange={(e) => upd((p) => ({ rows: p.rows.map((x) => (x.id === r.id ? { ...x, v: e.target.value } : x)) }))} />
                  <button type="button" title="Remove row" onClick={() => upd((p) => ({ rows: p.rows.filter((x) => x.id !== r.id) }))} className="text-red-500 text-lg leading-none">×</button>
                </div>))}
              <button type="button" onClick={() => upd((p) => ({ rows: [...p.rows, { id: uid(), k: '', v: '' }] }))} className="text-[12px] text-navy font-semibold hover:underline">+ Add Row</button>
            </div>)}
          </Card>

          <Card title="Signatory">
            <div className="grid grid-cols-2 gap-2">
              <Field label="Sign-off"><Input value={d.signoff} onChange={set('signoff')} dir="auto" /></Field>
              <Field label="Signatory Name"><Input value={d.signName} onChange={set('signName')} dir="auto" /></Field>
            </div>
            <Field label="Signatory Title"><Input value={d.signTitle} onChange={set('signTitle')} dir="auto" /></Field>
            <div className="text-[12px] font-semibold text-navy pt-1">Company stamp &amp; signature</div>
            <SignoffChoice compact />
          </Card>

          <Card title="Company Settings">
            <Field label="RERA ORN (Office Registration No.)" hint="Shown in the letterhead and footer. Leave blank to hide. Saved in this browser.">
              <Input value={orn} onChange={(e) => setOrn(e.target.value.replace(/[^\dA-Za-z-]/g, ''))} placeholder="e.g. 12345" />
            </Field>
          </Card>

          <Card title="Send to Manager for Signature">
            <div className="grid grid-cols-2 gap-2">
              <Field label="Manager WhatsApp (optional)" hint="With country code, e.g. 971501234567"><Input value={mgrPhone} onChange={(e) => setMgrPhone(e.target.value)} /></Field>
              <Field label="Manager Email (optional)"><Input type="email" value={mgrEmail} onChange={(e) => setMgrEmail(e.target.value)} /></Field>
            </div>
            <ActionBar />
            <p className="text-[11px] text-slate-500">Export the PDF first, then attach it in WhatsApp / your email app. Links can't attach files automatically.</p>
          </Card>
        </div>

        {/* ---------------- PREVIEW ---------------- */}
        <div className="lg:sticky lg:top-5">
          <div className="no-print flex items-center justify-between mb-3 px-1 gap-2 flex-wrap">
            <span className="text-[12px] font-semibold uppercase tracking-wider text-slate-500">Live A4 Preview</span>
            <span className="flex gap-2 flex-wrap">
              {uniquePh.length > 0 && <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-red-100 text-red-700" title={uniquePh.join('  ')}>⚠ {uniquePh.length} unfilled placeholder{uniquePh.length > 1 ? 's' : ''}</span>}
              {fit < 1 && <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-800">Fitted to 1 page · {Math.round(fit * 100)}%</span>}
              <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-slate-200 text-slate-700">{lang === 'ar' ? 'العربية · RTL' : 'English · LTR'}</span>
              <span className={`text-[11px] font-bold px-2 py-0.5 rounded ${signoff.mode === 'stamp' ? 'bg-emerald-600 text-white' : signoff.mode === 'request' ? 'bg-amber-500 text-white' : 'bg-navy text-white'}`}>{signoff.mode === 'stamp' ? 'STAMPED & SIGNED' : signoff.mode === 'request' ? 'STAMP REQUESTED' : 'NO STAMP'}</span>
            </span>
          </div>
          <ScaledA4><Sheet d={d} fit={fit} lang={lang} orn={orn.trim()} /></ScaledA4>
        </div>
      </main>

      {/* hidden unscaled measurement for the 1-page fit */}
      <div className="no-print" aria-hidden="true" style={{ position: 'absolute', left: -20000, top: 0, width: `${BODY_W_MM}mm`, visibility: 'hidden' }}>
        <div ref={measRef}><LetterBody d={d} lang={lang} orn={orn.trim()} /></div>
      </div>

      {/* ---------- modals ---------- */}
      {phModal && (
        <Modal title="Unfilled placeholders" onClose={() => setPhModal(false)}>
          <p className="text-[13px] text-slate-600">This letter still contains {uniquePh.length} placeholder{uniquePh.length > 1 ? 's' : ''} that will print as-is:</p>
          <div className="flex flex-wrap gap-1.5 max-h-40 overflow-auto">{uniquePh.map((p) => <span key={p} className="text-[12px] font-semibold px-2 py-0.5 rounded bg-amber-100 text-red-700">{p}</span>)}</div>
          <div className="grid grid-cols-2 gap-2 pt-1">
            <button type="button" onClick={() => setPhModal(false)} className="bg-navy text-white font-semibold text-sm py-2.5 rounded-lg">Go back &amp; fill</button>
            <button type="button" onClick={reallyPrint} className="border border-red-300 text-red-700 font-semibold text-sm py-2.5 rounded-lg hover:bg-red-50">Print anyway</button>
          </div>
        </Modal>
      )}

    </div>
  );
}


export default App as React.ComponentType<any>;
