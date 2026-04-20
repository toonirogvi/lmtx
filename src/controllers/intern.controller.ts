import { parse } from "csv-parse/sync";
import { generateReferenceId } from "../services/referenceId.service";
import { logActivity } from "../services/activity.service";
import {
  createInternRecord,
  getInternById,
  listActivityByInternId,
  listDocumentsByInternId,
  listInternRecords,
  updateInternRecord
} from "../services/firestore.service";
import { asyncHandler, AppError } from "../utils/errors";
import { toInternDto } from "../utils/internMapper";
import { createInternSchema } from "../utils/schemas";
import { calculateDuration } from "../utils/duration";
import type { InternRecord, InternStatus } from "../types/models";

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

function durationFromDates(joiningDate: Date, exitDate: Date | null) {
  try {
    return calculateDuration(joiningDate, exitDate);
  } catch (error) {
    throw new AppError(error instanceof Error ? error.message : "Unable to calculate duration.", 400);
  }
}

function toCreateData(input: Record<string, unknown>, referenceId: string) {
  const joiningDate = dateFromInput(String(input.joining_date));
  const exitDate = optionalDateFromInput(input.exit_date);

  return {
    name: String(input.name),
    email: String(input.email),
    phone: String(input.phone),
    role: String(input.role),
    department: String(input.department),
    joiningDate,
    exitDate,
    duration: durationFromDates(joiningDate, exitDate),
    manager: String(input.manager),
    status: String(input.status ?? "Applied") as InternStatus,
    referenceId
  };
}

async function withDocuments(intern: InternRecord) {
  const documents = await listDocumentsByInternId(intern.id);
  return { ...intern, documents };
}

export const createIntern = asyncHandler(async (req, res) => {
  const referenceId = await generateReferenceId();
  const intern = await createInternRecord(toCreateData(req.body, referenceId));

  await logActivity({
    actorId: req.user?.id,
    internId: intern.id,
    entity: "Intern",
    entityId: intern.id,
    action: "INTERN_CREATED",
    metadata: { referenceId }
  });

  return res.status(201).json({ data: toInternDto(await withDocuments(intern)) });
});

export const listInterns = asyncHandler(async (req, res) => {
  const { search, status, includeDeleted, page, limit } = req.query as unknown as {
    search?: string;
    status?: InternStatus;
    includeDeleted?: string;
    page: number;
    limit: number;
  };

  const result = await listInternRecords({
    search,
    status,
    includeDeleted: includeDeleted === "true" && req.user?.role === "Admin",
    page,
    limit
  });

  const data = await Promise.all(result.data.map(withDocuments));

  return res.json({
    data: data.map(toInternDto),
    meta: {
      total: result.total,
      page,
      limit,
      pages: Math.ceil(result.total / limit)
    }
  });
});

export const getIntern = asyncHandler(async (req, res) => {
  const intern = await getInternById(req.params.id);

  if (!intern) {
    throw new AppError("Record not found.", 404);
  }

  const [documents, activities] = await Promise.all([
    listDocumentsByInternId(intern.id),
    listActivityByInternId(intern.id)
  ]);

  return res.json({
    data: {
      ...toInternDto({ ...intern, documents }),
      activities: activities.map((activity) => ({
        id: activity.id,
        action: activity.action,
        entity: activity.entity,
        entity_id: activity.entityId ?? null,
        metadata: activity.metadata ?? null,
        created_at: activity.createdAt.toISOString()
      }))
    }
  });
});

export const updateIntern = asyncHandler(async (req, res) => {
  const existing = await getInternById(req.params.id);

  if (!existing || existing.deletedAt) {
    throw new AppError("Record not found.", 404);
  }

  const body = req.body as Record<string, unknown>;
  const hasJoiningDate = Object.prototype.hasOwnProperty.call(body, "joining_date");
  const hasExitDate = Object.prototype.hasOwnProperty.call(body, "exit_date");
  const effectiveJoiningDate = hasJoiningDate ? dateFromInput(String(body.joining_date)) : existing.joiningDate;
  const effectiveExitDate = hasExitDate ? optionalDateFromInput(body.exit_date) : existing.exitDate;
  const data: Partial<InternRecord> = {
    ...(body.name ? { name: String(body.name) } : {}),
    ...(body.email ? { email: String(body.email) } : {}),
    ...(body.phone ? { phone: String(body.phone) } : {}),
    ...(body.role ? { role: String(body.role) } : {}),
    ...(body.department ? { department: String(body.department) } : {}),
    ...(hasJoiningDate ? { joiningDate: effectiveJoiningDate } : {}),
    ...(hasExitDate ? { exitDate: effectiveExitDate } : {}),
    ...(hasJoiningDate || hasExitDate ? { duration: durationFromDates(effectiveJoiningDate, effectiveExitDate) } : {}),
    ...(body.manager ? { manager: String(body.manager) } : {}),
    ...(body.status ? { status: String(body.status) as InternStatus } : {}),
    ...(typeof body.is_revoked === "boolean" ? { isRevoked: body.is_revoked } : {})
  };

  const intern = await updateInternRecord(req.params.id, data);

  await logActivity({
    actorId: req.user?.id,
    internId: intern.id,
    entity: "Intern",
    entityId: intern.id,
    action: "INTERN_UPDATED",
    metadata: { changedFields: Object.keys(body) }
  });

  return res.json({ data: toInternDto(await withDocuments(intern)) });
});

export const deleteIntern = asyncHandler(async (req, res) => {
  const intern = await getInternById(req.params.id);

  if (!intern || intern.deletedAt) {
    throw new AppError("Record not found.", 404);
  }

  await updateInternRecord(req.params.id, { deletedAt: new Date() });

  await logActivity({
    actorId: req.user?.id,
    internId: intern.id,
    entity: "Intern",
    entityId: intern.id,
    action: "INTERN_SOFT_DELETED",
    metadata: { referenceId: intern.referenceId }
  });

  return res.status(204).send();
});

export const bulkUploadInterns = asyncHandler(async (req, res) => {
  if (!req.file) {
    throw new AppError("CSV file is required in field named file.", 400);
  }

  const rows = parse(req.file.buffer, {
    columns: true,
    skip_empty_lines: true,
    trim: true
  }) as Array<Record<string, unknown>>;

  if (rows.length === 0) {
    throw new AppError("CSV file has no rows.", 400);
  }

  const errors: Array<{ row: number; issues: unknown }> = [];
  const validRows: Array<Record<string, unknown>> = [];

  rows.forEach((row, index) => {
    const parsed = createInternSchema.safeParse(row);
    if (!parsed.success) {
      errors.push({ row: index + 2, issues: parsed.error.flatten().fieldErrors });
      return;
    }
    validRows.push(parsed.data);
  });

  if (errors.length > 0) {
    return res.status(422).json({ message: "CSV validation failed.", errors });
  }

  const created = [];

  for (const row of validRows) {
    const referenceId = await generateReferenceId();
    const intern = await createInternRecord(toCreateData(row, referenceId));
    created.push(intern);

    await logActivity({
      actorId: req.user?.id,
      internId: intern.id,
      entity: "Intern",
      entityId: intern.id,
      action: "INTERN_BULK_CREATED",
      metadata: { referenceId }
    });
  }

  const data = await Promise.all(created.map(withDocuments));

  return res.status(201).json({
    data: data.map(toInternDto),
    meta: { created: created.length }
  });
});
