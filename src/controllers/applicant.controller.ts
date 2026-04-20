import { logActivity } from "../services/activity.service";
import {
  createApplicantRecord,
  getApplicantById,
  listApplicantRecords,
  updateApplicantRecord
} from "../services/firestore.service";
import type { ApplicantRecord, ApplicantStatus } from "../types/models";
import { toApplicantDto } from "../utils/applicantMapper";
import { asyncHandler, AppError } from "../utils/errors";

function dateFromInput(value: string) {
  const normalized = value.length === 10 ? `${value}T00:00:00.000Z` : value;
  return new Date(normalized);
}

function optionalDateFromInput(value: unknown) {
  if (value === null || value === undefined || String(value).trim() === "") {
    return null;
  }
  return dateFromInput(String(value));
}

function toCreateData(input: Record<string, unknown>) {
  return {
    name: String(input.name),
    email: String(input.email),
    phone: String(input.phone),
    position: String(input.position),
    department: String(input.department),
    source: String(input.source),
    status: String(input.status ?? "Applied") as ApplicantStatus,
    experience: String(input.experience),
    expectedJoiningDate: optionalDateFromInput(input.expected_joining_date),
    resumeUrl: input.resume_url ? String(input.resume_url) : undefined,
    owner: String(input.owner),
    notes: input.notes ? String(input.notes) : undefined
  };
}

export const createApplicant = asyncHandler(async (req, res) => {
  const applicant = await createApplicantRecord(toCreateData(req.body));

  await logActivity({
    actorId: req.user?.id,
    entity: "Applicant",
    entityId: applicant.id,
    action: "APPLICANT_CREATED",
    metadata: { email: applicant.email, position: applicant.position, status: applicant.status }
  });

  return res.status(201).json({ data: toApplicantDto(applicant) });
});

export const listApplicants = asyncHandler(async (req, res) => {
  const { search, status, includeDeleted, page, limit } = req.query as unknown as {
    search?: string;
    status?: ApplicantStatus;
    includeDeleted?: string;
    page: number;
    limit: number;
  };

  const result = await listApplicantRecords({
    search,
    status,
    includeDeleted: includeDeleted === "true" && req.user?.role === "Admin",
    page,
    limit
  });

  return res.json({
    data: result.data.map(toApplicantDto),
    meta: {
      total: result.total,
      page,
      limit,
      pages: Math.ceil(result.total / limit)
    }
  });
});

export const getApplicant = asyncHandler(async (req, res) => {
  const applicant = await getApplicantById(req.params.id);

  if (!applicant || applicant.deletedAt) {
    throw new AppError("Applicant not found.", 404);
  }

  return res.json({ data: toApplicantDto(applicant) });
});

export const updateApplicant = asyncHandler(async (req, res) => {
  const existing = await getApplicantById(req.params.id);

  if (!existing || existing.deletedAt) {
    throw new AppError("Applicant not found.", 404);
  }

  const body = req.body as Record<string, unknown>;
  const data: Partial<ApplicantRecord> = {
    ...(body.name ? { name: String(body.name) } : {}),
    ...(body.email ? { email: String(body.email) } : {}),
    ...(body.phone ? { phone: String(body.phone) } : {}),
    ...(body.position ? { position: String(body.position) } : {}),
    ...(body.department ? { department: String(body.department) } : {}),
    ...(body.source ? { source: String(body.source) } : {}),
    ...(body.status ? { status: String(body.status) as ApplicantStatus } : {}),
    ...(body.experience ? { experience: String(body.experience) } : {}),
    ...(Object.prototype.hasOwnProperty.call(body, "expected_joining_date")
      ? { expectedJoiningDate: optionalDateFromInput(body.expected_joining_date) }
      : {}),
    ...(Object.prototype.hasOwnProperty.call(body, "resume_url")
      ? { resumeUrl: body.resume_url ? String(body.resume_url) : undefined }
      : {}),
    ...(body.owner ? { owner: String(body.owner) } : {}),
    ...(Object.prototype.hasOwnProperty.call(body, "notes")
      ? { notes: body.notes ? String(body.notes) : undefined }
      : {})
  };

  const applicant = await updateApplicantRecord(req.params.id, data);

  await logActivity({
    actorId: req.user?.id,
    entity: "Applicant",
    entityId: applicant.id,
    action: "APPLICANT_UPDATED",
    metadata: { changedFields: Object.keys(body), status: applicant.status }
  });

  return res.json({ data: toApplicantDto(applicant) });
});

export const deleteApplicant = asyncHandler(async (req, res) => {
  const applicant = await getApplicantById(req.params.id);

  if (!applicant || applicant.deletedAt) {
    throw new AppError("Applicant not found.", 404);
  }

  await updateApplicantRecord(req.params.id, { deletedAt: new Date() });

  await logActivity({
    actorId: req.user?.id,
    entity: "Applicant",
    entityId: applicant.id,
    action: "APPLICANT_SOFT_DELETED",
    metadata: { email: applicant.email, position: applicant.position }
  });

  return res.status(204).send();
});
