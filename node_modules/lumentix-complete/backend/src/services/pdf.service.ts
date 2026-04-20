import fs from "fs/promises";
import path from "path";
import puppeteer, { type Page } from "puppeteer";
import { env } from "../config/env";
import type { DocumentType, InternRecord } from "../types/models";
import { formatDate } from "../utils/date";
import { escapeHtml, renderTemplate } from "../utils/html";
import { generateBarcodeDataUri } from "./barcode.service";
import { generateQrCodeDataUri } from "./qrcode.service";
import { storageProvider } from "./storage.service";

const templateByType: Record<DocumentType, string> = {
  offer: "offer.html",
  certificate: "certificate.html",
  experience: "experience.html",
  relieving: "relieving.html",
  nda: "nda.html"
};

const titleByType: Record<DocumentType, string> = {
  offer: "Offer Letter",
  certificate: "Completion Certificate",
  experience: "Experience Letter",
  relieving: "Relieving Letter",
  nda: "Non-Disclosure Agreement"
};

const company = {
  name: "LUMENTIX SOLUTIONS PRIVATE LIMITED",
  addressLineOne: "115-9-122/3 AADARSH NAGAR, 1ST STREET KONTHAMURU,",
  addressLineTwo: "Sriramnagar (Rajahmundry), East Godavari - 533105, Andhra Pradesh",
  email: "info@lumentix.in",
  bgvEmail: "bgv@lumentix.in",
  website: "www.lumentix.in",
  phone: "9494548249"
};

const pdfMarginsMm = {
  top: 38,
  right: 17,
  bottom: 28,
  left: 17
};

const a4SizeMm = {
  width: 210,
  height: 297
};

const cssPxPerMm = 96 / 25.4;
const printableWidthPx = Math.round((a4SizeMm.width - pdfMarginsMm.left - pdfMarginsMm.right) * cssPxPerMm);
const printableHeightPx = (a4SizeMm.height - pdfMarginsMm.top - pdfMarginsMm.bottom) * cssPxPerMm;

type LayoutMetrics = {
  bodyFontSizePx: number;
  lineHeight: number;
  titleFontSizePx: number;
  h2FontSizePx: number;
  paragraphMarginPx: number;
  listMarginBottomPx: number;
  listIndentPx: number;
  listItemMarginPx: number;
  metaGapYPx: number;
  metaGapXPx: number;
  metaMarginTopPx: number;
  metaMarginBottomPx: number;
  metaPaddingYPx: number;
  metaPaddingXPx: number;
  metaLabelFontSizePx: number;
  noteMarginPx: number;
  notePaddingYPx: number;
  notePaddingXPx: number;
  signatureMarginTopPx: number;
  signatureTextFontSizePx: number;
  signatureQrTextFontSizePx: number;
  signatureQrMm: number;
};

function roundCss(value: number) {
  return Number(value.toFixed(2));
}

function createLayoutMetrics(spacingScale: number): LayoutMetrics {
  const bodyFontSizePx = 10.8;

  return {
    bodyFontSizePx: roundCss(bodyFontSizePx),
    lineHeight: roundCss(Math.min(2.45, 1.48 + (spacingScale - 1) * 0.42)),
    titleFontSizePx: roundCss(bodyFontSizePx * 1.55),
    h2FontSizePx: roundCss(bodyFontSizePx * 1.08),
    paragraphMarginPx: roundCss(6.5 * spacingScale),
    listMarginBottomPx: roundCss(7 * spacingScale),
    listIndentPx: roundCss(15),
    listItemMarginPx: roundCss(3 * spacingScale),
    metaGapYPx: roundCss(4.5 * spacingScale),
    metaGapXPx: roundCss(13),
    metaMarginTopPx: roundCss(9 * spacingScale),
    metaMarginBottomPx: roundCss(10 * spacingScale),
    metaPaddingYPx: roundCss(7 * spacingScale),
    metaPaddingXPx: roundCss(9),
    metaLabelFontSizePx: roundCss(bodyFontSizePx * 0.72),
    noteMarginPx: roundCss(9 * spacingScale),
    notePaddingYPx: roundCss(5.5 * spacingScale),
    notePaddingXPx: roundCss(8),
    signatureMarginTopPx: roundCss(6 + 2 * spacingScale),
    signatureTextFontSizePx: roundCss(bodyFontSizePx),
    signatureQrTextFontSizePx: roundCss(bodyFontSizePx * 0.72),
    signatureQrMm: roundCss(Math.min(22, 18 + spacingScale * 2))
  };
}

async function loadLogoDataUri() {
  const logoPath = path.resolve(process.cwd(), "../storage/assets/lumentix-logo.png");
  const png = await fs.readFile(logoPath);
  return `data:image/png;base64,${png.toString("base64")}`;
}

function buildVerifyUrl(referenceId: string) {
  return `${env.publicVerifyBaseUrl.replace(/\/$/, "")}/${referenceId}`;
}

function buildDynamicStatements(intern: InternRecord, verifyUrl: string) {
  const joiningDate = formatDate(intern.joiningDate);
  const exitDate = intern.exitDate ? formatDate(intern.exitDate) : null;
  const roleContext = `${intern.role} in the ${intern.department} department under the reporting supervision of ${intern.manager}`;
  const timeline = exitDate
    ? `The recorded engagement timeline is from ${joiningDate} to ${exitDate}, covering ${intern.duration}.`
    : `The recorded engagement timeline begins on ${joiningDate} and is currently marked as ongoing, with duration recorded as ${intern.duration}.`;
  const exitOrContinuation = exitDate
    ? `The recorded date of exit is ${exitDate}, and any post-engagement obligations continue according to company policy.`
    : "The association is currently recorded without a final exit date, and continuation remains subject to company review, performance, compliance, and operational requirements.";

  return {
    role_context: roleContext,
    timeline_statement: timeline,
    exit_or_continuation_statement: exitOrContinuation,
    status_statement: `The current lifecycle status in company records is ${intern.status}.`,
    verification_statement: `Authenticity may be verified using reference ${intern.referenceId}, the QR code printed on the document, the verification URL ${verifyUrl}, or by contacting ${company.bgvEmail}.`,
    digital_record_statement: `This document is generated from the controlled HRFLOW record for ${intern.referenceId} and is intended to support digital verification, audit readiness, and secure background verification workflows.`
  };
}

function buildLayout(input: {
  title: string;
  body: string;
  logoDataUri: string;
  qrDataUri: string;
  verifyUrl: string;
  referenceId: string;
  metrics: LayoutMetrics;
}) {
  const { metrics } = input;
  const safeVerifyUrl = escapeHtml(input.verifyUrl);
  const safeReferenceId = escapeHtml(input.referenceId);

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      color: #18181b;
      font-family: "Times New Roman", Times, serif;
      font-size: ${metrics.bodyFontSizePx}px;
      line-height: ${metrics.lineHeight};
      background: #ffffff;
    }
    .page-watermark {
      height: auto;
      left: 50%;
      opacity: 0.055;
      pointer-events: none;
      position: fixed;
      top: 50%;
      transform: translate(-50%, -50%);
      width: 120mm;
      z-index: 0;
    }
    .content {
      position: relative;
      z-index: 1;
    }
    h1 {
      font-size: ${metrics.titleFontSizePx}px;
      font-weight: 700;
      letter-spacing: 0;
      margin: 0 0 ${roundCss(metrics.paragraphMarginPx + 5)}px;
      text-align: center;
      text-decoration: underline;
    }
    h2 {
      font-size: ${metrics.h2FontSizePx}px;
      margin: ${roundCss(metrics.paragraphMarginPx + 5)}px 0 ${roundCss(metrics.paragraphMarginPx * 0.57)}px;
      letter-spacing: 0;
      text-transform: uppercase;
    }
    .content p {
      margin: 0 0 ${metrics.paragraphMarginPx}px;
    }
    .content ul {
      margin: 0 0 ${metrics.listMarginBottomPx}px ${metrics.listIndentPx}px;
      padding: 0;
    }
    .content li {
      margin: 0 0 ${metrics.listItemMarginPx}px;
      padding-left: 1px;
    }
    .meta {
      background: #f4f4f5;
      border: 1px solid #e4e4e7;
      border-radius: 8px;
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: ${metrics.metaGapYPx}px ${metrics.metaGapXPx}px;
      margin: ${metrics.metaMarginTopPx}px 0 ${metrics.metaMarginBottomPx}px;
      padding: ${metrics.metaPaddingYPx}px ${metrics.metaPaddingXPx}px;
    }
    .meta > div {
      color: #18181b;
      font-weight: 700;
    }
    .meta > div > strong:first-child {
      display: block;
      color: #52525b;
      font-size: ${metrics.metaLabelFontSizePx}px;
      text-transform: uppercase;
    }
    .meta > div > strong:not(:first-child) {
      color: #18181b;
      display: inline;
      font-size: ${metrics.bodyFontSizePx}px;
      text-transform: none;
    }
    .note {
      border-left: 3px solid #0f766e;
      margin: ${metrics.noteMarginPx}px 0;
      padding: ${metrics.notePaddingYPx}px ${metrics.notePaddingXPx}px;
      background: #f0fdfa;
    }
    .document-signature {
      align-items: end;
      color: #52525b;
      display: grid;
      gap: 8mm;
      grid-template-columns: minmax(0, 1fr) 42mm;
      margin-top: ${metrics.signatureMarginTopPx}px;
      page-break-inside: avoid;
      width: 100%;
    }
    .signature-block {
      max-width: 240px;
      padding-top: 4px;
    }
    .signature-line {
      border-top: 1px solid #a1a1aa;
      margin-bottom: 3px;
      width: 185px;
    }
    .signature-qr {
      color: #3f3f46;
      font-size: ${metrics.signatureQrTextFontSizePx}px;
      line-height: 1.1;
      text-align: center;
      width: 42mm;
    }
    .signature-qr img {
      display: block;
      height: ${metrics.signatureQrMm}mm;
      margin: 0 auto 2px;
      width: ${metrics.signatureQrMm}mm;
    }
    .signature-qr strong {
      color: #18181b;
      display: block;
      font-size: ${metrics.signatureQrTextFontSizePx}px;
      text-transform: uppercase;
    }
    .signature-qr span {
      display: block;
      overflow-wrap: anywhere;
    }
    .signature-qr a {
      color: #0f766e;
      display: block;
      font-weight: 700;
      margin-top: 2px;
      overflow-wrap: anywhere;
      text-decoration: underline;
    }
    .signature-qr .verify-url {
      color: #52525b;
      font-size: ${roundCss(metrics.signatureQrTextFontSizePx * 0.88)}px;
      line-height: 1.15;
      margin-top: 1px;
    }
  </style>
</head>
<body>
  <img class="page-watermark" src="${input.logoDataUri}" alt="" />
  <main class="content">
    <h1>${input.title}</h1>
    ${input.body}
    <section class="document-signature">
      <div class="signature-block">
        <div class="signature-line"></div>
        <div>Authorised Sign</div>
      </div>
      <div class="signature-qr">
        <a href="${safeVerifyUrl}">
          <img src="${input.qrDataUri}" alt="Verification QR Code" />
        </a>
        <strong>Scan to verify</strong>
        <span>${safeReferenceId}</span>
        <a href="${safeVerifyUrl}">Open verification page</a>
        <span class="verify-url">${safeVerifyUrl}</span>
      </div>
    </section>
  </main>
</body>
</html>`;
}

function buildHeaderTemplate(input: {
  referenceId: string;
  barcodeDataUri: string;
  logoDataUri: string;
}) {
  return `
    <style>
      * { box-sizing: border-box; }
      .pdf-header {
        color: #18181b;
        font-family: "Times New Roman", Times, serif;
        font-size: 9px;
        padding: 6mm 17mm 4mm;
        width: 100%;
      }
      .header-grid {
        align-items: flex-start;
        border-bottom: 2px solid #0f766e;
        display: grid;
        gap: 18px;
        grid-template-columns: 1fr 198px;
        padding-bottom: 5px;
      }
      .brand-block {
        display: block;
        max-width: 420px;
      }
      .brand-logo {
        display: block;
        height: auto;
        max-height: 58px;
        object-fit: contain;
        width: 158px;
      }
      .company-address {
        color: #52525b;
        font-size: 8.2px;
        line-height: 1.4;
        margin-top: 4px;
      }
      .reference-card {
        color: #3f3f46;
        text-align: center;
        width: 198px;
      }
      .reference-card img {
        display: block;
        height: 36px;
        margin: 0 auto 2px;
        object-fit: contain;
        width: 190px;
      }
      .reference-label {
        color: #71717a;
        font-size: 8px;
        line-height: 1.15;
        text-transform: uppercase;
      }
      .reference-value {
        color: #18181b;
        font-size: 10px;
        font-weight: 700;
        line-height: 1.2;
      }
    </style>
    <div class="pdf-header">
      <div class="header-grid">
        <div class="brand-block">
          <img class="brand-logo" src="${input.logoDataUri}" alt="Lumentix logo" />
          <div class="company-address">${company.addressLineOne}<br />${company.addressLineTwo}</div>
        </div>
        <div class="reference-card">
          <img src="${input.barcodeDataUri}" alt="Barcode" />
          <div class="reference-label">Reference Number</div>
          <div class="reference-value">${input.referenceId}</div>
        </div>
      </div>
    </div>`;
}

function buildFooterTemplate() {
  return `
    <style>
      * { box-sizing: border-box; }
      .pdf-footer {
        color: #52525b;
        font-family: "Times New Roman", Times, serif;
        font-size: 9px;
        padding: 0 17mm 6mm;
        width: 100%;
      }
      .footer-grid {
        align-items: center;
        border-top: 1px solid #d4d4d8;
        display: block;
        padding-top: 5px;
      }
      .footer-contact strong {
        color: #18181b;
        display: block;
        font-size: 8px;
        text-transform: uppercase;
      }
      .footer-contact {
        color: #71717a;
        font-size: 7.8px;
        line-height: 1.45;
      }
      .footer-contact span {
        color: #52525b;
        display: block;
      }
      .page-count {
        color: #71717a;
        font-size: 7.2px;
        margin-top: 3px;
      }
    </style>
    <div class="pdf-footer">
      <div class="footer-grid">
        <div>
          <div class="footer-contact">
            <strong>Contact Information</strong>
            <span>${company.email} | ${company.website} | ${company.phone}</span>
            <span>Background verification: ${company.bgvEmail}</span>
          </div>
          <div class="page-count">Page <span class="pageNumber"></span> of <span class="totalPages"></span></div>
        </div>
      </div>
    </div>`;
}

type LayoutMeasurement = {
  measuredPages: number;
  signatureOffsetRatio: number;
  signaturePage: number;
  signatureStartsNearPageTop: boolean;
  signatureWouldMoveToNextPage: boolean;
};

async function measureLayout(page: Page, html: string): Promise<LayoutMeasurement> {
  await page.setViewport({
    width: printableWidthPx,
    height: Math.ceil(printableHeightPx * 3),
    deviceScaleFactor: 1
  });
  await page.setContent(html, { waitUntil: "load" });

  const measurement = await page.evaluate((pageHeightPx) => {
    const content = document.querySelector(".content") as HTMLElement | null;
    const signature = document.querySelector(".document-signature") as HTMLElement | null;

    const contentRect = content?.getBoundingClientRect() ?? document.documentElement.getBoundingClientRect();
    const contentHeightPx = Math.ceil(content ? contentRect.height : document.documentElement.scrollHeight);

    if (!signature) {
      return {
        contentHeightPx,
        signatureHeightPx: 0,
        signaturePage: 1,
        signaturePageOffsetPx: pageHeightPx,
        signatureRemainingPx: pageHeightPx
      };
    }

    const signatureRect = signature.getBoundingClientRect();
    const signatureTopPx = Math.max(0, signatureRect.top - contentRect.top);
    const signatureHeightPx = Math.ceil(signatureRect.height);
    const signaturePageOffsetPx = signatureTopPx % pageHeightPx;

    return {
      contentHeightPx,
      signatureHeightPx,
      signaturePage: Math.floor(signatureTopPx / pageHeightPx) + 1,
      signaturePageOffsetPx,
      signatureRemainingPx: pageHeightPx - signaturePageOffsetPx
    };
  }, printableHeightPx);

  return {
    measuredPages: measurement.contentHeightPx / printableHeightPx,
    signatureOffsetRatio: measurement.signaturePageOffsetPx / printableHeightPx,
    signaturePage: measurement.signaturePage,
    signatureStartsNearPageTop:
      measurement.signaturePage > 1 && measurement.signaturePageOffsetPx < printableHeightPx * 0.2,
    signatureWouldMoveToNextPage: measurement.signatureRemainingPx < measurement.signatureHeightPx + 16
  };
}

function createSpacingScales() {
  const scales: number[] = [];

  for (let value = 0.68; value <= 3.2; value += 0.04) {
    scales.push(roundCss(value));
  }

  return scales;
}

async function chooseLayoutMetrics(
  page: Page,
  input: Omit<Parameters<typeof buildLayout>[0], "metrics">
) {
  const spacingScales = createSpacingScales();
  const targetMaxPages = 1.98;
  const targetIdealPages = 1.94;

  let selected = createLayoutMetrics(spacingScales[0]);
  let selectedScore = Number.POSITIVE_INFINITY;
  let fallback = selected;
  let fallbackPages = 0;

  for (const spacingScale of spacingScales) {
    const metrics = createLayoutMetrics(spacingScale);
    const html = buildLayout({ ...input, metrics });
    const measurement = await measureLayout(page, html);

    if (measurement.measuredPages > targetMaxPages) {
      break;
    }

    const keepsSignatureWithContent =
      !measurement.signatureStartsNearPageTop && !measurement.signatureWouldMoveToNextPage;

    if (measurement.measuredPages > fallbackPages) {
      fallback = metrics;
      fallbackPages = measurement.measuredPages;
    }

    if (keepsSignatureWithContent) {
      const signaturePlacementPenalty = measurement.signaturePage === 2
        ? Math.abs(0.72 - measurement.signatureOffsetRatio) * 0.06
        : 0.06;
      const score = Math.abs(targetIdealPages - measurement.measuredPages) + signaturePlacementPenalty;

      if (score <= selectedScore) {
        selected = metrics;
        selectedScore = score;
      }
    }
  }

  return Number.isFinite(selectedScore) ? selected : fallback;
}

export async function renderInternDocumentPdf(intern: InternRecord, type: DocumentType) {
  const templatePath = path.resolve(process.cwd(), "templates", templateByType[type]);
  const template = await fs.readFile(templatePath, "utf8");
  const verifyUrl = buildVerifyUrl(intern.referenceId);
  const today = new Date();

  const values = {
    name: intern.name,
    email: intern.email,
    phone: intern.phone,
    role: intern.role,
    department: intern.department,
    joining_date: formatDate(intern.joiningDate),
    exit_date: intern.exitDate ? formatDate(intern.exitDate) : "Ongoing",
    duration: intern.duration,
    manager: intern.manager,
    reference_id: intern.referenceId,
    status: intern.status,
    date: formatDate(today),
    company_name: company.name,
    company_address: `${company.addressLineOne} ${company.addressLineTwo}`,
    company_email: company.email,
    company_website: company.website,
    company_phone: company.phone,
    bgv_email: company.bgvEmail,
    verify_url: verifyUrl,
    ...buildDynamicStatements(intern, verifyUrl)
  };

  const [barcodeDataUri, qrDataUri, logoDataUri] = await Promise.all([
    generateBarcodeDataUri(intern.referenceId),
    generateQrCodeDataUri(verifyUrl),
    loadLogoDataUri()
  ]);

  const headerTemplate = buildHeaderTemplate({
    referenceId: intern.referenceId,
    barcodeDataUri,
    logoDataUri
  });
  const footerTemplate = buildFooterTemplate();

  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"]
  });

  try {
    const page = await browser.newPage();
    const layoutInput = {
      title: titleByType[type],
      body: renderTemplate(template, values),
      logoDataUri,
      qrDataUri,
      verifyUrl,
      referenceId: intern.referenceId
    };
    const metrics = await chooseLayoutMetrics(page, layoutInput);
    const html = buildLayout({
      ...layoutInput,
      metrics
    });

    await page.setContent(html, { waitUntil: "load" });
    return Buffer.from(
      await page.pdf({
        displayHeaderFooter: true,
        format: "A4",
        footerTemplate,
        headerTemplate,
        margin: {
          top: `${pdfMarginsMm.top}mm`,
          right: `${pdfMarginsMm.right}mm`,
          bottom: `${pdfMarginsMm.bottom}mm`,
          left: `${pdfMarginsMm.left}mm`
        },
        printBackground: true,
        preferCSSPageSize: false
      })
    );
  } finally {
    await browser.close();
  }
}

export async function generateInternDocument(intern: InternRecord, type: DocumentType) {
  const buffer = await renderInternDocumentPdf(intern, type);
  const filename = `${intern.referenceId}-${type}-${Date.now()}.pdf`;

  return storageProvider.saveFile({
    buffer,
    filename,
    contentType: "application/pdf"
  });
}
