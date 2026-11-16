// Scoped styles — rendered only while the tool is mounted.
const css = `
  html, body { margin: 0; font-family: 'Inter', sans-serif; background: #F3F5F8; color: #3F3F3F; }
  .a4 {
    width: 210mm; height: 297mm; background: #fff; box-sizing: border-box;
    padding: 12mm 14mm 9mm; display: flex; flex-direction: column; overflow: hidden;
    -webkit-print-color-adjust: exact; print-color-adjust: exact;
  }
  .rt { width: 100%; border-collapse: separate; border-spacing: 0; font-size: 9.6pt; border: 1px solid #C9D9EE; border-radius: 6px; overflow: hidden; }
  .rt td, .rt th { padding: 2.1mm 3mm; border-bottom: 1px solid #E1E9F4; vertical-align: top; text-align: left; }
  .rt tr:last-child td { border-bottom: none; }
  .rt .lbl { width: 46mm; background: #F4F8FC; color: #1E3553; font-weight: 600; font-size: 8.8pt; border-right: 1px solid #E1E9F4; }
  .rt thead th { background: #1E3553; color: #fff; font-family: 'Montserrat', sans-serif; font-weight: 600; font-size: 8.4pt; letter-spacing: .06em; text-transform: uppercase; border-bottom: none; }
  .rt .total td { background: #EAF1FA; font-weight: 700; color: #1E3553; border-top: 1.5px solid #7AA3D8; }
  .rt .total .lbl { background: #1E3553; color: #fff; }
  .num { font-variant-numeric: tabular-nums; }
  .sec { display: flex; align-items: center; gap: 2.5mm; font-family: 'Montserrat', sans-serif; font-weight: 700; color: #1E3553; font-size: 10.5pt; letter-spacing: .04em; text-transform: uppercase; margin: 5mm 0 2.2mm; }
  .sec::before { content: ''; width: 1.2mm; height: 4.2mm; background: #7AA3D8; border-radius: 1mm; }
  .field-in { width: 100%; border: 1px solid #D6DEE8; border-radius: 8px; padding: 8px 10px; font-size: 14px; background: #fff; outline: none; transition: border-color .15s, box-shadow .15s; }
  .field-in:focus { border-color: #7AA3D8; box-shadow: 0 0 0 3px rgba(122,163,216,.25); }

  @media print {
    @page { size: A4 portrait; margin: 0; }
    html, body { background: #fff !important; width: 210mm !important; height: 297mm !important; overflow: hidden !important; }
    #root > div { min-height: 0 !important; height: 297mm !important; overflow: hidden !important; }
    main { padding: 0 !important; display: block !important; }
    body * { visibility: hidden !important; }
    #print-root, #print-root * { visibility: visible !important; }
    #print-root { position: fixed !important; left: 0; top: 0; transform: none !important; margin: 0 !important; box-shadow: none !important; border-radius: 0 !important; }
    .no-print { display: none !important; }
    .scaler { transform: none !important; width: 210mm !important; height: 297mm !important; box-shadow: none !important; }
  }
  .qr svg { width: 100%; height: 100%; display: block; }
`;
export default css;
