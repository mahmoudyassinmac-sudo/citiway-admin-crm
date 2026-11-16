/* eslint-disable */
// @ts-nocheck — ported from the original single-file Citiway tool (Project Knowledge/citiway-tenancy-contract Update .html)
'use client';
import { PartyPicker, useIssueDocument } from '@/components/documents/crm-bridge';
import React, { useState, useMemo, useEffect, useLayoutEffect, useRef, useCallback, Fragment } from 'react';


const CITIWAY_LOGO = '/assets/citiway-logo.png';
const GOV_LOGO = '/assets/asset-92226ad8.png';
const DLD_LOGO = '/assets/asset-30c6df2f.png';

/* ---------------- Static legal text (DLD Unified Tenancy Contract) ---------------- */
const TERMS = [
  ['The tenant has inspected the premises and agreed to lease the unit on its current condition.',
   'عاين المستأجر الوحدة موضوع الإيجار ووافق على استئجار العقار على حالته الحالية.'],
  ['Tenant undertakes to use the premises for designated purpose, tenant has no rights to transfer or relinquish the tenancy contract either with or to without counterpart to any without landlord written approval. Also, tenant is not allowed to sublease the premises or any part thereof to third party in whole or in part unless it is legally permitted.',
   'يتعهد المستأجر باستعمال المأجور للغرض المخصص له، ولا يجوز للمستأجر تحويل أو التنازل عن عقد الإيجار للغير بمقابل أو دون مقابل دون موافقة المالك خطياً، كما لا يجوز للمستأجر تأجير المأجور أو أي جزء منه من الباطن ما لم يسمح بذلك قانوناً.'],
  ['The tenant undertakes not to make any amendments, modifications or addendums to the premises subject of the contract without obtaining the landlord written approval. Tenant shall be liable for any damages or failure due to that.',
   'يتعهد المستأجر بعدم إجراء أي تعديلات أو إضافات على العقار موضوع العقد دون موافقة المالك الخطية، ويكون المستأجر مسؤولاً عن أي أضرار أو نقص أو تلف يلحق بالعقار.'],
  ['The tenant shall be responsible for payment of all electricity, water, cooling and gas charges resulting of occupying leased unit unless other condition agreed in written.',
   'يكون المستأجر مسؤولاً عن سداد كافة فواتير الكهرباء والمياه والتبريد والغاز المترتبة عن إشغاله المأجور ما لم يتم الاتفاق على غير ذلك كتابياً.'],
  ['The tenant must pay the rent amount in the manner and dates agreed with the landlord.',
   'يتعهد المستأجر بسداد مبلغ الإيجار المتفق عليه في هذا العقد في التواريخ والطريقة المتفق عليها.'],
  ['The tenant fully undertakes to comply with all the regulations and instructions related to the management of the property and the use of the premises and of common areas such (parking, swimming pools, gymnasium, etc…).',
   'يلتزم المستأجر التقيد التام بالأنظمة والتعليمات المتعلقة باستخدام المأجور والمنافع المشتركة (كمواقف السيارات، أحواض السباحة، النادي الصحي، إلخ).'],
  ['Tenancy contract parties declare all mentioned emails addresses and phone numbers are correct, all formal and legal notifications will be sent to those addresses in case of dispute between parties.',
   'يقر أطراف التعاقد بصحة العناوين وأرقام الهواتف المذكورة أعلاه، وتكون تلك العناوين هي المعتمدة رسمياً للإخطارات والإعلانات القضائية في حال نشوء أي نزاع بين أطراف العقد.'],
  ['The landlord undertakes to enable the tenant of the full use of the premises including its facilities (swimming pool, gym, parking lot, etc) and do the regular maintenance as intended unless other condition agreed in written, and not to do any act that would detract from the premises benefit.',
   'يتعهد المؤجر بتمكين المستأجر من الانتفاع التام بالعقار للغرض المؤجر لأجله والمرافق الخاصة به (حوض سباحة، نادي صحي، مواقف سيارات… إلخ)، كما يكون مسؤولاً عن أعمال الصيانة ما لم يتم الاتفاق على غير ذلك، وعدم التعرض له في منفعة العقار.'],
  ['By signing this agreement from the first party, the “Landlord” hereby confirms and undertakes that he is the current owner of the property or his legal representative under legal power of attorney duly entitled by the competent authorities.',
   'يعتبر توقيع المؤجر على هذا العقد إقراراً منه بأنه المالك الحالي للعقار أو الوكيل القانوني للمالك بموجب وكالة قانونية موثقة وفق الأصول لدى الجهات المختصة.'],
  ['Any disagreement or dispute may arise from execution or interpretation of this contract shall be settled by the Rental Dispute Center.',
   'أي خلاف أو نزاع قد ينشأ عن تنفيذ أو تفسير هذا العقد يعود البت فيه لمركز فض المنازعات الإيجارية.'],
  ['This contract is subject to all provisions of Law No (26) of 2007 regulating the relation between landlords and tenants in the emirate of Dubai as amended, and as it will be changed or amended from time to time, as long with any related legislations and regulations applied in the emirate of Dubai.',
   'يخضع هذا العقد لكافة أحكام القانون رقم (26) لسنة 2007 بشأن تنظيم العلاقة بين مؤجري ومستأجري العقارات في إمارة دبي وتعديلاته، وأي تغيير أو تعديل يطرأ عليه من وقت لآخر، كما يخضع للتشريعات واللوائح الأخرى ذات العلاقة النافذة في دبي.'],
  ['Any additional condition will not be considered in case it conflicts with law.',
   'لا يعتد بأي شرط تمت إضافته إلى هذا العقد في حال تعارضه مع القانون.'],
  ['In case of discrepancy occurs between Arabic and non Arabic texts with regards to the interpretation of this agreement or the scope of its application, the Arabic text shall prevail.',
   'في حال حدوث أي تعارض أو اختلاف في التفسير بين النص العربي والنص الأجنبي يعتمد النص العربي.'],
  ['The landlord undertakes to register this tenancy contract on EJARI affiliated to Dubai Land Department and provide with all required documents.',
   'يتعهد المؤجر بتسجيل عقد الإيجار في نظام إيجاري التابع لدائرة الأراضي والأملاك وتوفير كافة المستندات اللازمة لذلك.'],
];
const RIGHTS = [
  ['You may visit Rental Dispute Center website through www.dubailand.gov.ae in case of any rental dispute between parties.',
   'يمكنكم زيارة موقع مركز فض المنازعات الإيجارية من خلال www.dubailand.gov.ae في حال نشوء أي نزاع إيجاري بين الأطراف.'],
  ['Law No 26 of 2007 regulating relationship between landlords and tenants.',
   'الاطلاع على قانون رقم 26 لسنة 2007 بشأن تنظيم العلاقة بين المؤجرين والمستأجرين.'],
  ['Law No 33 of 2008 amending law 26 of year 2007.',
   'الاطلاع على قانون رقم 33 لسنة 2008 الخاص بتعديل بعض أحكام قانون 26 لعام 2007.'],
  ['Law No 43 of 2013 determining rent increases for properties.',
   'الاطلاع على قانون رقم 43 لسنة 2013 بشأن تحديد زيادة بدل الإيجار.'],
];
const ATTACH = [
  ['Original unified tenancy contract', 'نسخة أصلية عن عقد الإيجار الموحد'],
  ['Original emirates ID of applicant', 'الهوية الإماراتية الأصلية لمقدم الطلب'],
];

/* ---------------- Helpers ---------------- */
const fmtDate = (iso) => { if (!iso) return ''; const [y, m, d] = iso.split('-'); return `${d}/${m}/${y}`; };
const today = () => new Date().toISOString().slice(0, 10);
function plusYearMinusDay(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(Date.UTC(y + 1, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() - 1);
  return dt.toISOString().slice(0, 10);
}
const aedFmt = (v) => {
  const n = parseFloat(String(v).replace(/,/g, ''));
  if (!isFinite(n) || String(v).trim() === '') return '';
  return 'AED ' + n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
};
const numFmt = (v) => {
  const n = parseFloat(String(v).replace(/,/g, ''));
  return isFinite(n) && String(v).trim() !== '' ? n.toLocaleString('en-US', { maximumFractionDigits: 2 }) : v;
};

/* ---------------- Sheet atoms ---------------- */
function Bar({ en, ar }) {
  return <div className="bar"><span className="en">{en}</span><span className="ar">{ar}</span></div>;
}
function Row({ en, ar, v }) {
  return (
    <div className="row row1">
      <span className="lbl-en">{en}</span>
      <span className="val" dir="auto">{v}</span>
      <span className="lbl-ar">{ar}</span>
    </div>
  );
}
function Half({ en, ar, v, sub }) {
  return (
    <div>
      <div className="half">
        <span className="lbl-en">{en}</span>
        <span className="val" dir="auto">{v}</span>
        <span className="lbl-ar">{ar}</span>
      </div>
      {sub && <div className="sub" style={{ paddingLeft: '26.5mm', paddingRight: '26.5mm' }}><span>Incase of a Company</span><span className="ar">في حال كانت شركة</span></div>}
    </div>
  );
}
function Pair({ children }) { return <div className="row row2">{children}</div>; }
function Check({ on, en, ar }) {
  return (
    <span className="inline-flex items-center" style={{ gap: '1.6mm' }}>
      <span style={{
        width: '3.4mm', height: '3.4mm', borderRadius: '0.7mm', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        border: on ? '1.4px solid #222222' : '1.4px solid #888888', background: on ? '#222222' : '#fff',
      }}>
        {on && <svg viewBox="0 0 12 12" style={{ width: '2.5mm', height: '2.5mm' }}><path d="M2.2 6.3 4.8 8.8 9.8 3.4" fill="none" stroke="#fff" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" /></svg>}
      </span>
      <span className={on ? 'font-semibold text-navy' : 'text-slate-500'} style={{ fontSize: '7.8pt' }}>{en}</span>
      <span className={`font-ar ${on ? 'font-semibold text-navy' : 'text-slate-500'}`} style={{ fontSize: '8.2pt' }}>{ar}</span>
    </span>
  );
}
function GovHeader({ mini, date }) {
  if (mini) {
    return (
      <div className="flex justify-between items-center" style={{ borderBottom: '0.45mm solid #222222', paddingBottom: '1.4mm' }}>
        <img src={GOV_LOGO} alt="Government of Dubai" className="logo" style={{ height: '10.5mm' }} />
        <div className="text-center" style={{ fontSize: '7.6pt', letterSpacing: '.14em', color: '#555555', fontWeight: 700 }}>
          TENANCY CONTRACT · <span className="font-ar" style={{ letterSpacing: 0 }}>عقد إيجار</span>
        </div>
        <img src={DLD_LOGO} alt="Dubai Land Department" className="logo" style={{ height: '9.5mm' }} />
      </div>
    );
  }
  return (
    <div style={{ borderBottom: '0.45mm solid #222222', paddingBottom: '1.8mm' }}>
      <div className="grid items-center" style={{ gridTemplateColumns: '1fr auto 1fr', columnGap: '6mm' }}>
        <div><img src={GOV_LOGO} alt="Government of Dubai" className="logo" style={{ height: '14mm' }} /></div>
        <div className="text-center">
          <div className="font-ar font-bold" style={{ fontSize: '16pt', lineHeight: 1.1, letterSpacing: '.08em', color: '#222222' }}>عقد إيجار</div>
          <div style={{ fontSize: '12.5pt', fontWeight: 600, letterSpacing: '.1em', color: '#222222', marginTop: '0.4mm' }}>TENANCY CONTRACT</div>
          <div className="half" style={{ gridTemplateColumns: '9mm 38mm 11mm', marginTop: '1.6mm' }}>
            <span className="lbl-en">Date</span>
            <span className="val num">{fmtDate(date)}</span>
            <span className="lbl-ar">التاريخ</span>
          </div>
        </div>
        <div className="flex justify-end"><img src={DLD_LOGO} alt="Dubai Land Department" className="logo" style={{ height: '11.5mm' }} /></div>
      </div>
    </div>
  );
}
function Signatures({ signDate }) {
  const box = (en, ar) => (
    <div style={{ flex: 1, border: '1px solid #888888', borderRadius: '1.6mm', padding: '1.4mm 3mm 1.6mm' }}>
      <div style={{ height: '8.5mm' }} />
      <div className="flex items-end" style={{ gap: '3mm' }}>
        <div style={{ flex: 1.3 }}>
          <div style={{ borderBottom: '1px solid #666666', marginBottom: '1mm' }} />
          <div className="flex justify-between"><span className="lbl-en">{en}</span><span className="lbl-ar">{ar}</span></div>
        </div>
        <div style={{ flex: 1 }}>
          <div className="num text-center font-semibold" style={{ borderBottom: '1px solid #666666', marginBottom: '1mm', minHeight: '3.6mm', fontSize: '8pt' }}>{fmtDate(signDate)}</div>
          <div className="flex justify-between"><span className="lbl-en">Date</span><span className="lbl-ar">التاريخ</span></div>
        </div>
      </div>
    </div>
  );
  return (
    <>
      <Bar en="Signatures" ar="التوقيعات" />
      <div className="flex" style={{ gap: '5mm' }}>
        {box("Tenant’s Signature", 'توقيع المستأجر')}
        {box("Lessor’s Signature", 'توقيع المؤجر')}
      </div>
    </>
  );
}
function Terms({ from, to }) {
  return (
    <div className="terms">
      {TERMS.slice(from - 1, to).map(([en, ar], i) => (
        <React.Fragment key={i}>
          <div className="t-en"><b className="text-navy">{from + i}.</b> {en}</div>
          <div className="t-ar ar"><b className="text-navy">{from + i}.</b> {ar}</div>
          {i < to - from && <div className="rule" />}
        </React.Fragment>
      ))}
    </div>
  );
}

/* ---------------- Page 1 ---------------- */
function Page1({ d }) {
  const period = (
    <div className="row row1">
      <span className="lbl-en">Contract Period</span>
      <span className="flex items-end" style={{ gap: '2mm' }}>
        <span className="lbl-en" style={{ fontSize: '7pt' }}>From <span className="font-ar">من</span></span>
        <span className="val num" style={{ flex: 1 }}>{fmtDate(d.from)}</span>
        <span className="lbl-en" style={{ fontSize: '7pt' }}>To <span className="font-ar">إلى</span></span>
        <span className="val num" style={{ flex: 1 }}>{fmtDate(d.to)}</span>
      </span>
      <span className="lbl-ar">فترة العقد</span>
    </div>
  );
  return (
    <div className="a4 font-body p1">
      <GovHeader date={d.date} />

      <Bar en="Owner / Lessor Information" ar="معلومات المالك / المؤجر" />
      <Row en="Owner’s Name" ar="اسم المالك" v={d.ownerName} />
      <Row en="Lessor’s Name" ar="اسم المؤجر" v={d.lessorSame ? d.ownerName : d.lessorName} />
      <Row en="Lessor’s Emirates ID" ar="الهوية الإماراتية للمؤجر" v={d.lessorEid} />
      <Pair>
        <Half en="License No." ar="رقم الرخصة" v={d.lessorLic} sub />
        <Half en="Licensing Authority" ar="سلطة الترخيص" v={d.lessorAuth} sub />
      </Pair>
      <Row en="Lessor’s Email" ar="البريد الإلكتروني للمؤجر" v={d.lessorEmail} />
      <Row en="Lessor’s Phone" ar="رقم هاتف المؤجر" v={d.lessorPhone} />

      <Bar en="Tenant Information" ar="معلومات المستأجر" />
      <Row en="Tenant’s Name" ar="اسم المستأجر" v={d.tenantName} />
      <Row en="Tenant’s Emirates ID" ar="الهوية الإماراتية للمستأجر" v={d.tenantEid} />
      <Pair>
        <Half en="License No." ar="رقم الرخصة" v={d.tenantLic} sub />
        <Half en="Licensing Authority" ar="سلطة الترخيص" v={d.tenantAuth} sub />
      </Pair>
      <Row en="Tenant’s Email" ar="البريد الإلكتروني للمستأجر" v={d.tenantEmail} />
      <Row en="Tenant’s Phone" ar="رقم هاتف المستأجر" v={d.tenantPhone} />

      <Bar en="Property Information" ar="معلومات العقار" />
      <div className="row" style={{ gridTemplateColumns: '31mm 1fr 34mm', alignItems: 'center' }}>
        <span className="lbl-en">Property Usage</span>
        <span className="flex justify-center" style={{ gap: '9mm' }}>
          <Check on={d.usage === 'Industrial'} en="Industrial" ar="صناعي" />
          <Check on={d.usage === 'Commercial'} en="Commercial" ar="تجاري" />
          <Check on={d.usage === 'Residential'} en="Residential" ar="سكني" />
        </span>
        <span className="lbl-ar">استخدام العقار</span>
      </div>
      <Pair>
        <Half en="Plot No." ar="رقم الأرض" v={d.plot} />
        <Half en="Makani No." ar="رقم مكاني" v={d.makani} />
      </Pair>
      <Pair>
        <Half en="Building Name" ar="اسم المبنى" v={d.building} />
        <Half en="Property No." ar="رقم العقار" v={d.propNo} />
      </Pair>
      <Pair>
        <Half en="Property Type" ar="نوع الوحدة" v={d.propType} />
        <Half en="Property Area (s.m)" ar="مساحة العقار (م²)" v={numFmt(d.area)} />
      </Pair>
      <Pair>
        <Half en="Location" ar="الموقع" v={d.location} />
        <Half en="Premises No. (DEWA)" ar="رقم المبنى (ديوا)" v={d.dewa} />
      </Pair>

      <Bar en="Contract Information" ar="معلومات العقد" />
      {period}
      <Pair>
        <Half en="Contract Value" ar="قيمة العقد" v={aedFmt(d.contractValue)} />
        <Half en="Annual Rent" ar="الإيجار السنوي" v={aedFmt(d.annualRent)} />
      </Pair>
      <Pair>
        <Half en="Security Deposit" ar="مبلغ التأمين" v={aedFmt(d.deposit)} />
        <Half en="Mode of Payment" ar="طريقة الدفع" v={d.mode} />
      </Pair>

      <Bar en="Terms and Conditions" ar="الأحكام والشروط" />
      <Terms from={1} to={3} />

      <div style={{ marginTop: 'auto' }}>
        <Signatures signDate={d.signDate} />
        <div className="flex justify-between text-slate-400" style={{ fontSize: '6.4pt', marginTop: '1.6mm' }}>
          <span>Page 1 of 2</span><span className="font-ar">صفحة 1 من 2</span>
        </div>
      </div>
    </div>
  );
}

/* ---------------- Page 2 ---------------- */
function Page2({ d }) {
  const bullet = <span style={{ width: '1.4mm', height: '1.4mm', borderRadius: '50%', background: '#555555', display: 'inline-block', flex: 'none', marginTop: '1.3mm' }} />;
  return (
    <div className="a4 font-body">
      <GovHeader mini />

      <div style={{ marginTop: '1.4mm' }}>
        <Terms from={4} to={14} />
      </div>

      <Bar en="Know your Rights" ar="لمعرفة حقوق الأطراف" />
      <div className="terms info" style={{ background: '#F3F4F6', borderRadius: '1.4mm', padding: '0.8mm 3mm' }}>
        {RIGHTS.map(([en, ar], i) => (
          <React.Fragment key={i}>
            <div className="t-en flex" style={{ gap: '1.6mm', padding: '0.25mm 0' }}>{bullet}<span>{en}</span></div>
            <div className="t-ar ar flex" style={{ gap: '1.6mm', padding: '0.25mm 0' }}>{bullet}<span>{ar}</span></div>
          </React.Fragment>
        ))}
      </div>

      <Bar en="Attachments for Ejari Registration" ar="مرفقات التسجيل في إيجاري" />
      <div className="terms info" style={{ background: '#F3F4F6', borderRadius: '1.4mm', padding: '0.8mm 3mm' }}>
        {ATTACH.map(([en, ar], i) => (
          <React.Fragment key={i}>
            <div className="t-en" style={{ padding: '0.2mm 0' }}><b className="text-navy">{i + 1}.</b> {en}</div>
            <div className="t-ar ar" style={{ padding: '0.2mm 0' }}><b className="text-navy">{i + 1}.</b> {ar}</div>
          </React.Fragment>
        ))}
      </div>

      <Bar en="Additional Terms" ar="شروط إضافية" />
      <div>
        {d.extra.map((t, i) => (
          <div key={i} className="flex items-start" style={{ gap: '2.4mm', padding: '0.6mm 0', borderBottom: '1px dotted #999999', minHeight: '5mm' }}>
            <span className="flex items-center justify-center font-bold text-navy num" style={{ width: '4.6mm', height: '4.6mm', borderRadius: '50%', border: '1px solid #888888', fontSize: '7pt', flex: 'none' }}>{i + 1}</span>
            <span style={{ flex: 1, fontSize: '7.6pt', lineHeight: 1.45 }}>{t.en}</span>
            <span className="ar" style={{ flex: 1, fontSize: '8pt', lineHeight: 1.5 }}>{t.ar}</span>
            <span className="flex items-center justify-center font-bold text-navy num" style={{ width: '4.6mm', height: '4.6mm', borderRadius: '50%', border: '1px solid #888888', fontSize: '7pt', flex: 'none' }}>{i + 1}</span>
          </div>
        ))}
      </div>
      <div className="terms" style={{ marginTop: '1.4mm', color: '#6B7280' }}>
        <div className="t-en" style={{ fontSize: '6.8pt' }}><b>Note:</b> You may add addendum to this tenancy contract in case you have additional terms while it needs to be signed by all parties.</div>
        <div className="t-ar ar" style={{ fontSize: '7.4pt' }}><b>ملاحظة:</b> يمكن إضافة ملحق إلى هذا العقد في حال وجود أي شروط إضافية، على أن يوقع من أطراف التعاقد.</div>
      </div>

      <div style={{ marginTop: 'auto' }}>
        <Signatures signDate={d.signDate} />
        <div style={{ height: '0.5mm', background: '#222222', margin: '2mm 0 1.2mm' }} />
        <div className="flex justify-between items-center" style={{ fontSize: '7pt', color: '#4B5563' }}>
          <span>Tel: 8004488 &nbsp;|&nbsp; P.O. Box 1166, Dubai, U.A.E. &nbsp;|&nbsp; www.dubailand.gov.ae</span>
          <span className="font-ar" style={{ direction: 'rtl', fontSize: '7.4pt' }}>هاتف: 8004488 &nbsp;|&nbsp; ص.ب: 1166، دبي، الإمارات العربية المتحدة</span>
        </div>
        <div className="flex justify-between text-slate-400" style={{ fontSize: '6.4pt', marginTop: '0.8mm' }}>
          <span>Page 2 of 2</span><span className="font-ar">صفحة 2 من 2</span>
        </div>
      </div>
    </div>
  );
}

/* ---------------- Scaled wrapper ---------------- */
function useScale(ref) {
  const [scale, setScale] = useState(0.7);
  useEffect(() => {
    const el = ref.current;
    const ro = new ResizeObserver(() => setScale(Math.min(1.1, Math.max(0.3, (el.clientWidth - 32) / 794))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return scale;
}
function ScaledPages({ pages }) {
  const ref = useRef(null);
  const scale = useScale(ref);
  return (
    <div ref={ref} className="w-full">
      {pages.map((p, i) => (
        <div key={i} className="sheet" style={{ marginBottom: i < pages.length - 1 ? 24 : 0 }}>
          <div className="scaler" style={{ width: 794 * scale, height: 1123 * scale, margin: '0 auto' }}>
            <div className="scaler" style={{ transform: `scale(${scale})`, transformOrigin: 'top left', width: 794, boxShadow: '0 12px 40px rgba(30,53,83,.18)', borderRadius: 4, overflow: 'hidden' }}>
              {p}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ---------------- Form atoms ---------------- */
function Field({ label, ar, children, hint }) {
  return (
    <label className="block">
      <span className="flex justify-between text-[12px] font-semibold text-navy mb-1 tracking-wide">
        <span>{label}</span>{ar && <span className="font-ar">{ar}</span>}
      </span>
      {children}
      {hint && <span className="block text-[11px] text-slate-500 mt-1">{hint}</span>}
    </label>
  );
}
function Input(props) { return <input {...props} className="field-in" />; }
function Card({ title, ar, children }) {
  return (
    <section className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-head font-bold text-[13px] uppercase tracking-wider text-navy flex items-center gap-2">
          <span className="w-1 h-4 rounded bg-brand inline-block" />{title}
        </h3>
        {ar && <span className="font-ar font-bold text-[13px] text-navy">{ar}</span>}
      </div>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

/* ---------------- App ---------------- */
const EMPTY_EXTRA = Array.from({ length: 5 }, () => ({ en: '', ar: '' }));
const INITIAL = {
  date: today(),
  usage: 'Residential',
  ownerName: '', lessorSame: true, lessorName: '', lessorEid: '', lessorLic: '', lessorAuth: '', lessorEmail: '', lessorPhone: '',
  tenantName: '', tenantEid: '', tenantLic: '', tenantAuth: '', tenantEmail: '', tenantPhone: '',
  plot: '', makani: '', building: '', propNo: '', propType: '', area: '', location: '', dewa: '',
  from: '', to: '', toTouched: false, contractValue: '', cvTouched: false, annualRent: '', deposit: '', mode: '',
  signDate: '',
  extra: EMPTY_EXTRA,
};
const SAMPLE = {
  ...INITIAL,
  ownerName: 'Khalid Ahmed Al Mazrouei', lessorEid: '784-1980-1234567-1', lessorEmail: 'owner@email.com', lessorPhone: '+971 50 111 2233',
  tenantName: 'John Michael Smith', tenantEid: '784-1990-7654321-2', tenantEmail: 'tenant@email.com', tenantPhone: '+971 55 444 5566',
  plot: '345-678', makani: '2345678901', building: 'Bayswater Tower', propNo: '1204', propType: 'Apartment', area: '116', location: 'Business Bay', dewa: '123456789',
  from: '2026-12-01', to: '2027-11-30', annualRent: '95000', contractValue: '95000', deposit: '4750', mode: '4 Cheques',
  extra: [
    { en: 'Chiller charges are included in the annual rent.', ar: 'رسوم التبريد مشمولة في الإيجار السنوي.' },
    { en: 'Minor maintenance up to AED 500 per incident is the tenant’s responsibility.', ar: 'الصيانة البسيطة حتى 500 درهم لكل حالة على مسؤولية المستأجر.' },
    { en: '', ar: '' }, { en: '', ar: '' }, { en: '', ar: '' },
  ],
};

function App({ clients = [], initial = {} }) {
  const [d, setD] = useState(SAMPLE);
  const set = (k) => (e) => setD((p) => ({ ...p, [k]: e && e.target ? e.target.value : e }));
  const [printMsg, setPrintMsg] = useState('');

  const onFrom = (e) => {
    const v = e.target.value;
    setD((p) => ({ ...p, from: v, to: p.toTouched ? p.to : plusYearMinusDay(v) }));
  };
  const onTo = (e) => setD((p) => ({ ...p, to: e.target.value, toTouched: e.target.value !== '' }));
  const onRent = (e) => {
    const v = e.target.value;
    setD((p) => ({ ...p, annualRent: v, contractValue: p.cvTouched ? p.contractValue : v }));
  };
  const onCv = (e) => setD((p) => ({ ...p, contractValue: e.target.value, cvTouched: e.target.value !== '' }));
  const setExtra = (i, k, v) => setD((p) => ({ ...p, extra: p.extra.map((t, j) => (j === i ? { ...t, [k]: v } : t)) }));

  const [clientId, setClientId] = useState('');
  const pick = (p) => {
    const c = p.record; setClientId(c.id);
    setD((prev) => ({ ...prev, tenantName: c.full_name, tenantEid: c.id_passport_no || '', tenantEmail: c.email || '', tenantPhone: c.phone || '' }));
  };
  useEffect(() => { const c = clients.find((x) => x.id === initial.client); if (c) pick({ kind: 'client', record: c }); }, []);
  const { note: crmNote, issue } = useIssueDocument(() => ({ docType: 'rental_contract', docNo: `TC-${d.building || 'UNIT'}-${d.propNo || 'NA'}-${d.from || d.date}`.replace(/\s+/g, '-'), amount: parseFloat(d.annualRent) || 0, vat: 0, total: parseFloat(d.contractValue || d.annualRent) || 0, clientId }));

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
          <div className="bg-white rounded-md px-2 py-1"><img src={CITIWAY_LOGO} alt="Citiway" style={{ height: 28, width: 'auto', display: 'block' }} /></div>
          <div>
            <div className="font-head font-bold tracking-wide">Unified Tenancy Contract Generator <span className="font-ar font-semibold text-blue-100">· عقد إيجار موحد</span></div>
            <div className="text-[12px] text-blue-100">Citiway CRM · Template #4 · Official DLD Unified Tenancy Contract (prints as 2 A4 pages)</div>
          </div>
          <div className="ml-auto flex gap-2 whitespace-nowrap" style={{ flexShrink: 0 }}>
            <button onClick={() => setD({ ...INITIAL, date: today() })} className="border border-blue-200/50 hover:bg-white/10 transition text-white font-semibold text-sm px-3 py-2 rounded-lg">Clear form</button>
            <button onClick={() => setD(SAMPLE)} className="border border-blue-200/50 hover:bg-white/10 transition text-white font-semibold text-sm px-3 py-2 rounded-lg">Load sample</button>
            <button onClick={issueAndPrint} title="Records the document in the CRM, then opens the print / PDF dialog" className="bg-emerald-500 hover:bg-emerald-400 transition text-white font-semibold text-sm px-4 py-2 rounded-lg whitespace-nowrap">Save &amp; Issue Document</button>
            <button onClick={doPrint} title="Print a draft without recording it" className="bg-brand hover:bg-white transition text-navy font-semibold text-sm px-4 py-2 rounded-lg">Print / Save as PDF</button>
          </div>
        </div>
        {printMsg && <div className="max-w-[1500px] mx-auto px-5 pb-3 text-[12px] text-blue-100">{printMsg}</div>}
        {crmNote && <div className="no-print max-w-[1500px] mx-auto px-5 pb-3 text-[12px] text-blue-100">{crmNote}</div>}
      </header>

      <main className="max-w-[1500px] mx-auto p-5 grid gap-5 lg:grid-cols-[460px_1fr] items-start">
        {/* ---- FORM ---- */}
        <div className="no-print space-y-4 lg:max-h-[calc(100vh-110px)] lg:overflow-y-auto lg:pr-1">
          <Card title="Contract" ar="العقد">
            <Field label="Contract Date" ar="التاريخ"><Input type="date" value={d.date} onChange={set('date')} /></Field>
            <Field label="Property Usage" ar="استخدام العقار">
              <div className="grid grid-cols-3 gap-1 p-1 bg-slate-100 rounded-lg">
                {[['Industrial', 'صناعي'], ['Commercial', 'تجاري'], ['Residential', 'سكني']].map(([en, ar]) => (
                  <button key={en} type="button" onClick={() => setD((p) => ({ ...p, usage: en }))}
                    className={`py-2 rounded-md text-sm font-semibold transition ${d.usage === en ? 'bg-navy text-white shadow' : 'text-slate-600 hover:bg-white'}`}>
                    {en} <span className="font-ar font-normal opacity-80">{ar}</span>
                  </button>
                ))}
              </div>
            </Field>
          </Card>

          <Card title="Owner / Lessor" ar="المالك / المؤجر">
            <Field label="Owner’s Name" ar="اسم المالك"><Input value={d.ownerName} onChange={set('ownerName')} dir="auto" /></Field>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={d.lessorSame} onChange={(e) => setD((p) => ({ ...p, lessorSame: e.target.checked }))} className="w-4 h-4 accent-[#1E3553]" />
              Lessor is the owner (copy owner’s name)
            </label>
            {!d.lessorSame && <Field label="Lessor’s Name" ar="اسم المؤجر"><Input value={d.lessorName} onChange={set('lessorName')} dir="auto" /></Field>}
            <Field label="Lessor’s Emirates ID" ar="الهوية الإماراتية للمؤجر"><Input value={d.lessorEid} onChange={set('lessorEid')} placeholder="784-XXXX-XXXXXXX-X" /></Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label="License No." ar="رقم الرخصة"><Input value={d.lessorLic} onChange={set('lessorLic')} placeholder="If company" /></Field>
              <Field label="Licensing Authority" ar="سلطة الترخيص"><Input value={d.lessorAuth} onChange={set('lessorAuth')} placeholder="If company" /></Field>
            </div>
            <Field label="Lessor’s Email" ar="البريد الإلكتروني"><Input type="email" value={d.lessorEmail} onChange={set('lessorEmail')} /></Field>
            <Field label="Lessor’s Phone" ar="رقم الهاتف"><Input value={d.lessorPhone} onChange={set('lessorPhone')} /></Field>
          </Card>

          <Card title="Tenant" ar="المستأجر">
            <PartyPicker clients={clients} onPick={pick} />
            <Field label="Tenant’s Name" ar="اسم المستأجر"><Input value={d.tenantName} onChange={set('tenantName')} dir="auto" /></Field>
            <Field label="Tenant’s Emirates ID" ar="الهوية الإماراتية للمستأجر"><Input value={d.tenantEid} onChange={set('tenantEid')} placeholder="784-XXXX-XXXXXXX-X" /></Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label="License No." ar="رقم الرخصة"><Input value={d.tenantLic} onChange={set('tenantLic')} placeholder="If company" /></Field>
              <Field label="Licensing Authority" ar="سلطة الترخيص"><Input value={d.tenantAuth} onChange={set('tenantAuth')} placeholder="If company" /></Field>
            </div>
            <Field label="Tenant’s Email" ar="البريد الإلكتروني"><Input type="email" value={d.tenantEmail} onChange={set('tenantEmail')} /></Field>
            <Field label="Tenant’s Phone" ar="رقم الهاتف"><Input value={d.tenantPhone} onChange={set('tenantPhone')} /></Field>
          </Card>

          <Card title="Property" ar="العقار">
            <div className="grid grid-cols-2 gap-2">
              <Field label="Plot No." ar="رقم الأرض"><Input value={d.plot} onChange={set('plot')} /></Field>
              <Field label="Makani No." ar="رقم مكاني"><Input value={d.makani} onChange={set('makani')} /></Field>
              <Field label="Building Name" ar="اسم المبنى"><Input value={d.building} onChange={set('building')} dir="auto" /></Field>
              <Field label="Property No." ar="رقم العقار"><Input value={d.propNo} onChange={set('propNo')} /></Field>
              <Field label="Property Type" ar="نوع الوحدة">
                <input list="ptypes" className="field-in" value={d.propType} onChange={set('propType')} />
                <datalist id="ptypes">{['Apartment', 'Villa', 'Townhouse', 'Office', 'Shop', 'Warehouse', 'Labour Camp'].map((x) => <option key={x} value={x} />)}</datalist>
              </Field>
              <Field label="Area (s.m)" ar="المساحة م²"><Input value={d.area} onChange={set('area')} inputMode="decimal" /></Field>
              <Field label="Location" ar="الموقع"><Input value={d.location} onChange={set('location')} dir="auto" /></Field>
              <Field label="Premises No. (DEWA)" ar="رقم ديوا"><Input value={d.dewa} onChange={set('dewa')} /></Field>
            </div>
          </Card>

          <Card title="Contract Information" ar="معلومات العقد">
            <div className="grid grid-cols-2 gap-2">
              <Field label="Period From" ar="من"><Input type="date" value={d.from} onChange={onFrom} /></Field>
              <Field label="Period To" ar="إلى"><Input type="date" value={d.to} onChange={onTo} /></Field>
            </div>
            <p className="text-[11px] text-slate-500 -mt-1">"To" fills in automatically as 1 year minus 1 day from "From" until you edit it.</p>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Annual Rent (AED)" ar="الإيجار السنوي"><Input type="number" min="0" value={d.annualRent} onChange={onRent} /></Field>
              <Field label="Contract Value (AED)" ar="قيمة العقد"><Input type="number" min="0" value={d.contractValue} onChange={onCv} /></Field>
              <Field label="Security Deposit (AED)" ar="مبلغ التأمين"><Input type="number" min="0" value={d.deposit} onChange={set('deposit')} /></Field>
              <Field label="Mode of Payment" ar="طريقة الدفع">
                <input list="modes" className="field-in" value={d.mode} onChange={set('mode')} />
                <datalist id="modes">{['1 Cheque', '2 Cheques', '4 Cheques', '6 Cheques', '12 Cheques', 'Bank Transfer', 'Cash'].map((x) => <option key={x} value={x} />)}</datalist>
              </Field>
            </div>
            {d.annualRent && d.deposit && (
              <div className="text-[12px] rounded-md bg-brand-soft text-navy p-2">Deposit = {((parseFloat(d.deposit) / parseFloat(d.annualRent)) * 100 || 0).toFixed(1)}% of annual rent (not printed).</div>
            )}
          </Card>

          <Card title="Additional Terms" ar="شروط إضافية">
            <p className="text-[11px] text-slate-500 -mt-1">Up to 5 clauses. Empty lines print as blank lines for handwriting. Arabic is optional.</p>
            {d.extra.map((t, i) => (
              <div key={i} className="rounded-lg border border-slate-200 p-2.5 space-y-2 bg-slate-50/60">
                <div className="text-[12px] font-bold text-navy">Term {i + 1}</div>
                <textarea rows={2} className="field-in" placeholder="English text" value={t.en} onChange={(e) => setExtra(i, 'en', e.target.value)} />
                <textarea rows={2} dir="rtl" className="field-in font-ar" placeholder="النص العربي (اختياري)" value={t.ar} onChange={(e) => setExtra(i, 'ar', e.target.value)} />
              </div>
            ))}
          </Card>

          <Card title="Signing" ar="التوقيع">
            <Field label="Signing Date (optional)" ar="تاريخ التوقيع" hint="Fills the Date lines next to both signatures on both pages. Leave blank to write by hand.">
              <Input type="date" value={d.signDate} onChange={set('signDate')} />
            </Field>
          </Card>
        </div>

        {/* ---- PREVIEW ---- */}
        <div className="preview-col lg:sticky lg:top-5 lg:max-h-[calc(100vh-110px)] lg:overflow-y-auto">
          <div className="no-print flex items-center justify-between mb-3 px-1">
            <span className="text-[12px] font-semibold uppercase tracking-wider text-slate-500">Live A4 Preview · 2 pages</span>
            <span className="text-[11px] font-bold px-2 py-0.5 rounded text-white" style={{ background: '#3B3B3B' }}>{d.usage.toUpperCase()}</span>
          </div>
          <ScaledPages pages={[<Page1 d={d} />, <Page2 d={d} />]} />
        </div>
      </main>
    </div>
  );
}


export default App as React.ComponentType<any>;
