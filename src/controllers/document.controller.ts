import { renderInternDocumentPdf } from "../services/pdf.service";
import { logActivity } from "../services/activity.service";
import { sendOfferLetterEmail } from "../services/email.service";
import {
  createDocumentRecord,
  getDocumentById,
  getInternById,
  listDocumentRecords
} from "../services/firestore.service";
import { asyncHandler, AppError } from "../utils/errors";
import { toDocumentDto } from "../utils/internMapper";
import type { DocumentType } from "../types/models";

const dataBackedDocumentUrl = "data:hrflow-record";

function buildDocumentFilename(referenceId: string, type: DocumentType) {
  return `${referenceId}-${type}.pdf`;
}

export const generateDocument = asyncHandler(async (req, res) => {
  const { internId, type } = req.body as {
    internId: string;
    type: DocumentType;
  };

  const intern = await getInternById(internId);

  if (!intern || intern.deletedAt) {
    throw new AppError("Record not found.", 404);
  }

  const document = await createDocumentRecord({
    internId: intern.id,
    type,
    fileUrl: dataBackedDocumentUrl
  });

  await logActivity({
    actorId: req.user?.id,
    internId: intern.id,
    entity: "Document",
    entityId: document.id,
    action: "DOCUMENT_GENERATED",
    metadata: { type, storage: "saved-record-data" }
  });

  return res.status(201).json({
    data: toDocumentDto(document),
    download_url: `/api/documents/${document.id}/download`
  });
});

export const listDocuments = asyncHandler(async (req, res) => {
  const { internId, offset, page, limit } = req.query as unknown as {
    internId?: string;
    offset?: number;
    page: number;
    limit: number;
  };
  const documents = await listDocumentRecords(internId);
  const start = offset ?? (page - 1) * limit;
  const pagedDocuments = documents.slice(start, start + limit);

  const data = await Promise.all(
    pagedDocuments.map(async (document) => {
      const intern = await getInternById(document.internId);

      return {
        ...toDocumentDto(document),
        intern: {
          id: intern?.id ?? document.internId,
          name: intern?.name ?? "Unknown record",
          reference_id: intern?.referenceId ?? "Unavailable"
        }
      };
    })
  );

  return res.json({
    data,
    meta: {
      total: documents.length,
      offset: start,
      limit,
      page,
      pages: Math.ceil(documents.length / limit)
    }
  });
});

export const downloadDocument = asyncHandler(async (req, res) => {
  const document = await getDocumentById(req.params.id);

  if (!document) {
    throw new AppError("Document not found.", 404);
  }

  const intern = await getInternById(document.internId);

  if (!intern || intern.deletedAt) {
    throw new AppError("Record not found.", 404);
  }

  const pdfBuffer = await renderInternDocumentPdf(intern, document.type);

  res.attachment(buildDocumentFilename(intern.referenceId, document.type));
  res.type("application/pdf");
  res.setHeader("Content-Length", pdfBuffer.length);

  return res.send(pdfBuffer);
});

export const emailDocument = asyncHandler(async (req, res) => {
  const document = await getDocumentById(req.params.id);

  if (!document) {
    throw new AppError("Document not found.", 404);
  }

  const intern = await getInternById(document.internId);

  if (!intern) {
    throw new AppError("Record not found.", 404);
  }

  if (document.type !== "offer") {
    throw new AppError("Only offer letters are supported by the email endpoint.", 400);
  }

  const pdfBuffer = await renderInternDocumentPdf(intern, document.type);
  const result = await sendOfferLetterEmail({
    to: req.body.email ?? intern.email,
    intern,
    attachmentBuffer: pdfBuffer,
    attachmentFilename: buildDocumentFilename(intern.referenceId, document.type)
  });

  await logActivity({
    actorId: req.user?.id,
    internId: intern.id,
    entity: "Document",
    entityId: document.id,
    action: "OFFER_EMAIL_SENT",
    metadata: { to: req.body.email ?? intern.email, messageId: result.messageId }
  });

  return res.json({ message: "Offer letter email queued.", result });
});
