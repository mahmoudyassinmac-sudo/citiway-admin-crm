// Scoped styles — rendered only while the tool is mounted.
const css = `
  html, body { margin: 0; font-family: 'Inter', sans-serif; background: #F3F5F8; color: #3F3F3F; }
  .ar { font-family: 'IBM Plex Sans Arabic', sans-serif; direction: rtl; text-align: right; }
  .a4 {
    width: 210mm; height: 297mm; background: #fff; box-sizing: border-box;
    padding: 7.5mm 10mm 6mm; display: flex; flex-direction: column; overflow: hidden;
    font-size: 8pt; color: #222222;
    -webkit-print-color-adjust: exact; print-color-adjust: exact;
  }
  /* section bar */
  .bar { display: flex; justify-content: space-between; align-items: center; background: #3B3B3B; color: #fff;
         padding: 1mm 3mm; border-radius: 1.4mm; margin: 2.2mm 0 0.8mm; }
  .bar .en { font-family: 'Inter', sans-serif; font-weight: 700; font-size: 8pt; letter-spacing: .03em; }
  .bar .ar { font-weight: 700; font-size: 8.6pt; }
  /* field rows */
  .row { display: grid; align-items: end; column-gap: 2mm; padding: 0.4mm 0; }
  .row1 { grid-template-columns: 31mm 1fr 34mm; }
  .p1 .row { padding: 0.75mm 0; }
  .p1 .bar { margin-top: 2.8mm; }
  .row2 { grid-template-columns: minmax(0,1fr) minmax(0,1fr); column-gap: 5mm; }
  .half { display: grid; grid-template-columns: 25mm 1fr 25mm; column-gap: 1.5mm; align-items: end; }
  .lbl-en { font-weight: 600; color: #222222; font-size: 7.6pt; white-space: nowrap; }
  .lbl-ar { font-family: 'IBM Plex Sans Arabic', sans-serif; direction: rtl; text-align: right; font-weight: 600; color: #222222; font-size: 8.2pt; white-space: nowrap; }
  .val { border-bottom: 1px dotted #666666; min-height: 4.3mm; padding: 0 1.2mm 0.3mm; font-weight: 600; font-size: 8.2pt; color: #111827;
         overflow: hidden; white-space: nowrap; text-overflow: ellipsis; unicode-bidi: plaintext; text-align: center; }
  .sub { display: flex; justify-content: space-between; font-size: 5.6pt; color: #777777; margin-top: 0; line-height: 1.2; }
  .sub .ar { font-size: 6pt; }
  /* terms */
  .terms { display: grid; grid-template-columns: 1.1fr 0.9fr; column-gap: 5mm; }
  .terms .t-en { font-size: 6.9pt; line-height: 1.36; padding: 0.4mm 0; text-align: justify; }
  .terms .t-ar { font-size: 7.4pt; line-height: 1.42; padding: 0.4mm 0; text-align: justify; }
  .terms.info .t-en, .terms.info .t-ar { text-align: start; }
  .terms.info .t-en { font-size: 6.8pt; } .terms.info .t-ar { font-size: 7.2pt; }
  .terms .rule { grid-column: 1 / -1; border-bottom: 1px solid #E5E7EB; }
  .num { font-variant-numeric: tabular-nums; }
  /* official neutral palette inside the printed sheets */
  .a4 .text-navy { color: #222222 !important; }
  .a4 .font-head { font-family: 'Inter', sans-serif !important; }
  .a4 .text-slate-500 { color: #6B6B6B !important; }
  .a4 .text-slate-400 { color: #8A8A8A !important; }
  .logo { display: block; object-fit: contain; }
  .field-in { width: 100%; border: 1px solid #D6DEE8; border-radius: 8px; padding: 7px 10px; font-size: 14px; background: #fff; outline: none; transition: border-color .15s, box-shadow .15s; }
  .field-in:focus { border-color: #7AA3D8; box-shadow: 0 0 0 3px rgba(122,163,216,.25); }

  @media print {
    @page { size: A4 portrait; margin: 0; }
    html, body { background: #fff !important; }
    .no-print { display: none !important; }
    #root > div { min-height: 0 !important; }
    main { padding: 0 !important; display: block !important; max-width: none !important; }
    .preview-col { position: static !important; max-height: none !important; overflow: visible !important; }
    .scaler { transform: none !important; width: 210mm !important; height: 297mm !important; box-shadow: none !important; margin: 0 !important; border-radius: 0 !important; }
    .sheet { break-after: page; page-break-after: always; margin: 0 !important; }
    .sheet:last-child { break-after: auto; page-break-after: auto; }
  }
`;
export default css;
