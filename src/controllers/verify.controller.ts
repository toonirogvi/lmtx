import type { Request } from "express";
import fs from "fs/promises";
import path from "path";
import puppeteer from "puppeteer";
import { asyncHandler, AppError } from "../utils/errors";
import { escapeHtml } from "../utils/html";
import { formatDate } from "../utils/date";
import { getInternByReferenceId, listDocumentsByInternId } from "../services/firestore.service";
import { logActivity } from "../services/activity.service";
import type { DocumentType } from "../types/models";

type VerificationInput = {
  verifier_name: string;
  verifier_email: string;
  verifier_phone?: string;
  verifier_organization: string;
  verifier_designation?: string;
  purpose: string;
  notes?: string;
  consent: true;
};

const documentLabels: Record<DocumentType, string> = {
  offer: "Offer Letter",
  certificate: "Completion Certificate",
  experience: "Experience Letter",
  relieving: "Relieving Letter",
  nda: "Non-Disclosure Agreement"
};

type VerificationRecordData = {
  verification_id: string;
  verified_at: string;
  reference_id: string;
  status: "Valid" | "Revoked";
  lifecycle_status: string;
  issue_date: string;
  joining_date: string;
  exit_date: string;
  name: string;
  role: string;
  department: string;
  duration: string;
  reporting_manager: string;
  registered_email: string;
  registered_phone: string;
  company: string;
  company_address: string;
  bgv_email: string;
  record_scope: string;
  documents_issued: Array<{
    type: DocumentType;
    label: string;
    issued_at: string;
  }>;
  verifier: {
    name: string;
    email: string;
    organization: string;
    designation: string | null;
    purpose: string;
  };
};

function getClientIp(req: Request) {
  const forwardedFor = req.headers["x-forwarded-for"];
  const raw = Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor;
  return raw?.split(",")[0]?.trim() || req.ip;
}

function maskEmail(email: string) {
  const [name, domain] = email.split("@");
  if (!name || !domain) return "Unavailable";
  const visible = name.length <= 2 ? name[0] : `${name.slice(0, 2)}***${name.slice(-1)}`;
  return `${visible}@${domain}`;
}

function maskPhone(phone: string) {
  const digits = phone.replace(/\D/g, "");
  if (digits.length <= 4) return "****";
  return `${"*".repeat(Math.max(0, digits.length - 4))}${digits.slice(-4)}`;
}

async function loadLogoDataUri() {
  const logoPath = path.resolve(process.cwd(), "../storage/assets/lumentix-logo.png");
  const png = await fs.readFile(logoPath);
  return `data:image/png;base64,${png.toString("base64")}`;
}

async function buildVerificationRecord(req: Request, input: VerificationInput, referenceId: string, action: string) {
  const verifier = {
    name: input.verifier_name,
    email: input.verifier_email.toLowerCase(),
    phone: input.verifier_phone,
    organization: input.verifier_organization,
    designation: input.verifier_designation,
    purpose: input.purpose,
    notes: input.notes
  };
  const requestContext = {
    ipAddress: getClientIp(req),
    userAgent: req.get("user-agent") ?? "Unavailable"
  };

  const intern = await getInternByReferenceId(referenceId);

  if (!intern) {
    await logActivity({
      entity: "Verification",
      entityId: referenceId,
      action: "PUBLIC_VERIFICATION_NOT_FOUND",
      metadata: {
        referenceId,
        verifier,
        ...requestContext
      }
    });
    throw new AppError("Verification record not found.", 404);
  }

  const documents = await listDocumentsByInternId(intern.id);
  const isValid = !intern.isRevoked && !intern.deletedAt;
  const issueDate = documents[0]?.createdAt ?? intern.createdAt;
  const verifiedAt = new Date();
  const verificationActivity = await logActivity({
    internId: intern.id,
    entity: "Verification",
    entityId: intern.referenceId,
    action,
    metadata: {
      resultStatus: isValid ? "Valid" : "Revoked",
      referenceId: intern.referenceId,
      verifier,
      ...requestContext
    }
  });

  return {
    verification_id: verificationActivity.id,
    verified_at: verifiedAt.toISOString(),
    reference_id: intern.referenceId,
    status: isValid ? "Valid" : "Revoked",
    lifecycle_status: intern.status,
    issue_date: formatDate(issueDate),
    joining_date: formatDate(intern.joiningDate),
    exit_date: intern.exitDate ? formatDate(intern.exitDate) : "Ongoing",
    name: intern.name,
    role: intern.role,
    department: intern.department,
    duration: intern.duration,
    reporting_manager: intern.manager,
    registered_email: maskEmail(intern.email),
    registered_phone: maskPhone(intern.phone),
    company: "LUMENTIX SOLUTIONS PRIVATE LIMITED",
    company_address:
      "115-9-122/3 AADARSH NAGAR, 1ST STREET KONTHAMURU, Sriramnagar (Rajahmundry), East Godavari - 533105, Andhra Pradesh",
    bgv_email: "bgv@lumentix.in",
    record_scope:
      "Employment and engagement records include internships, trainee assignments, employment, consulting, contracts, and project-based associations.",
    documents_issued: documents.map((document) => ({
      type: document.type,
      label: documentLabels[document.type],
      issued_at: formatDate(document.createdAt)
    })),
    verifier: {
      name: verifier.name,
      email: verifier.email,
      organization: verifier.organization,
      designation: verifier.designation ?? null,
      purpose: verifier.purpose
    }
  } satisfies VerificationRecordData;
}

function summaryRow(label: string, value: string) {
  return `<div class="row"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`;
}

function buildVerificationSummaryHtml(record: VerificationRecordData, logoDataUri: string) {
  const documents =
    record.documents_issued.length === 0
      ? "<p class=\"muted\">No issued documents are recorded for this reference.</p>"
      : record.documents_issued
          .map((document) => `<li><strong>${escapeHtml(document.label)}</strong><span>${escapeHtml(document.issued_at)}</span></li>`)
          .join("");

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    * { box-sizing: border-box; }
    body {
      color: #18181b;
      font-family: "Times New Roman", Times, serif;
      font-size: 10px;
      line-height: 1.28;
      margin: 0;
    }
    .page {
      border: 1px solid #d4d4d8;
      min-height: 267mm;
      padding: 8mm;
      position: relative;
    }
    .watermark {
      left: 50%;
      opacity: 0.045;
      position: absolute;
      top: 52%;
      transform: translate(-50%, -50%);
      width: 110mm;
      z-index: 0;
    }
    .content { position: relative; z-index: 1; }
    header {
      align-items: flex-start;
      border-bottom: 2px solid #0f766e;
      display: flex;
      justify-content: space-between;
      gap: 8mm;
      padding-bottom: 4mm;
    }
    .logo { width: 42mm; }
    h1 {
      font-size: 18px;
      margin: 0;
      text-align: right;
      text-decoration: underline;
      text-transform: uppercase;
    }
    .status {
      border: 1px solid ${record.status === "Valid" ? "#0f766e" : "#dc2626"};
      color: ${record.status === "Valid" ? "#0f766e" : "#dc2626"};
      display: inline-block;
      font-size: 11px;
      font-weight: 700;
      margin-top: 3mm;
      padding: 1.5mm 3mm;
      text-transform: uppercase;
    }
    .section {
      border: 1px solid #e4e4e7;
      margin-top: 4mm;
      padding: 3mm;
    }
    h2 {
      font-size: 11px;
      margin: 0 0 2mm;
      text-transform: uppercase;
    }
    .grid {
      display: grid;
      gap: 2mm 4mm;
      grid-template-columns: 1fr 1fr;
    }
    .row span {
      color: #52525b;
      display: block;
      font-size: 8px;
      text-transform: uppercase;
    }
    .row strong {
      display: block;
      font-size: 10px;
    }
    ul {
      list-style: none;
      margin: 0;
      padding: 0;
    }
    li {
      align-items: center;
      border-top: 1px solid #e4e4e7;
      display: flex;
      justify-content: space-between;
      padding: 1.5mm 0;
    }
    li:first-child { border-top: 0; }
    .muted { color: #52525b; margin: 0; }
    footer {
      border-top: 1px solid #d4d4d8;
      color: #52525b;
      font-size: 8px;
      margin-top: 4mm;
      padding-top: 2mm;
    }
  </style>
</head>
<body>
  <main class="page">
    <img class="watermark" src="${logoDataUri}" alt="" />
    <div class="content">
      <header>
        <div>
          <img class="logo" src="${logoDataUri}" alt="Lumentix" />
          <p class="muted">${escapeHtml(record.company_address)}</p>
        </div>
        <div>
          <h1>Verification Summary</h1>
          <div class="status">${escapeHtml(record.status)}</div>
        </div>
      </header>

      <section class="section">
        <h2>Verified Candidate Record</h2>
        <div class="grid">
          ${summaryRow("Name", record.name)}
          ${summaryRow("Reference ID", record.reference_id)}
          ${summaryRow("Role", record.role)}
          ${summaryRow("Department", record.department)}
          ${summaryRow("Lifecycle Status", record.lifecycle_status)}
          ${summaryRow("Duration", record.duration)}
          ${summaryRow("Joining Date", record.joining_date)}
          ${summaryRow("Date Of Exit", record.exit_date)}
          ${summaryRow("Issue Date", record.issue_date)}
          ${summaryRow("Reporting Manager", record.reporting_manager)}
          ${summaryRow("Registered Email", record.registered_email)}
          ${summaryRow("Registered Phone", record.registered_phone)}
        </div>
      </section>

      <section class="section">
        <h2>Issued Documents</h2>
        <ul>${documents}</ul>
      </section>

      <section class="section">
        <h2>Verifier And Audit Details</h2>
        <div class="grid">
          ${summaryRow("Verifier", record.verifier.name)}
          ${summaryRow("Organization", record.verifier.organization)}
          ${summaryRow("Official Email", record.verifier.email)}
          ${summaryRow("Designation", record.verifier.designation ?? "Not provided")}
          ${summaryRow("Purpose", record.verifier.purpose)}
          ${summaryRow("Verified At", new Date(record.verified_at).toLocaleString("en-IN"))}
          ${summaryRow("Verification ID", record.verification_id)}
          ${summaryRow("BGV Contact", record.bgv_email)}
        </div>
      </section>

      <section class="section">
        <h2>Scope</h2>
        <p class="muted">${escapeHtml(record.record_scope)}</p>
      </section>

      <footer>
        This one-page verification summary is generated from the controlled LUMENTIX HRFLOW public verification workflow.
        For independent confirmation, quote reference ${escapeHtml(record.reference_id)} to ${escapeHtml(record.bgv_email)}.
      </footer>
    </div>
  </main>
</body>
</html>`;
}

export const verifyReference = asyncHandler(async (req, res) => {
  const intern = await getInternByReferenceId(req.params.reference_id);

  if (!intern) {
    throw new AppError("Verification record not found.", 404);
  }

  return res.json({
    data: {
      reference_id: intern.referenceId,
      requires_verifier_details: true,
      message: "Submit verifier details to access this verification report."
    }
  });
});

export const submitVerificationRequest = asyncHandler(async (req, res) => {
  const input = req.body as VerificationInput;
  const referenceId = req.params.reference_id;
  const record = await buildVerificationRecord(req, input, referenceId, "PUBLIC_VERIFICATION_COMPLETED");

  return res.json({
    data: record
  });
});

export const downloadVerificationSummary = asyncHandler(async (req, res) => {
  const input = req.body as VerificationInput;
  const referenceId = req.params.reference_id;
  const record = await buildVerificationRecord(req, input, referenceId, "PUBLIC_VERIFICATION_SUMMARY_DOWNLOADED");
  const logoDataUri = await loadLogoDataUri();
  const html = buildVerificationSummaryHtml(record, logoDataUri);
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"]
  });

  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "load" });
    const buffer = Buffer.from(
      await page.pdf({
        format: "A4",
        margin: {
          top: "10mm",
          right: "10mm",
          bottom: "10mm",
          left: "10mm"
        },
        pageRanges: "1",
        printBackground: true,
        preferCSSPageSize: false
      })
    );

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${record.reference_id}-verification-summary.pdf"`);
    return res.send(buffer);
  } finally {
    await browser.close();
  }
});
