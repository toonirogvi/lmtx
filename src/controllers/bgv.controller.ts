import { getInternById, listActivityRecords } from "../services/firestore.service";
import { asyncHandler } from "../utils/errors";

const bgvAccessActions = [
  "PUBLIC_VERIFICATION_COMPLETED",
  "PUBLIC_VERIFICATION_SUMMARY_DOWNLOADED"
];

function readString(value: unknown, fallback = "Unavailable") {
  return typeof value === "string" && value.trim().length > 0 ? value : fallback;
}

export const listBgvAccessLogs = asyncHandler(async (req, res) => {
  const { page, limit } = req.query as unknown as {
    page: number;
    limit: number;
  };
  const result = await listActivityRecords({
    actions: bgvAccessActions,
    page,
    limit
  });
  const internIds = Array.from(
    new Set(result.data.map((activity) => activity.internId).filter(Boolean))
  ) as string[];
  const interns = await Promise.all(internIds.map((id) => getInternById(id)));
  const internById = new Map();

  for (const intern of interns) {
    if (intern) {
      internById.set(intern.id, intern);
    }
  }

  const data = result.data.map((activity) => {
    const metadata = activity.metadata ?? {};
    const verifier = metadata.verifier;
    const details = typeof verifier === "object" && verifier !== null ? verifier as Record<string, unknown> : {};
    const intern = activity.internId ? internById.get(activity.internId) : null;
    const resultStatus = readString(metadata.resultStatus, "Valid");

    return {
      id: activity.id,
      action: activity.action,
      access_type:
        activity.action === "PUBLIC_VERIFICATION_SUMMARY_DOWNLOADED"
          ? "Summary downloaded"
          : "Record viewed",
      created_at: activity.createdAt.toISOString(),
      reference_id: readString(metadata.referenceId, intern?.referenceId ?? activity.entityId ?? "Unavailable"),
      result_status: resultStatus === "Revoked" ? "Revoked" : "Valid",
      intern: intern
        ? {
            id: intern.id,
            name: intern.name,
            reference_id: intern.referenceId
          }
        : null,
      verifier: {
        name: readString(details.name),
        email: readString(details.email),
        phone: readString(details.phone, ""),
        organization: readString(details.organization),
        designation: readString(details.designation, ""),
        purpose: readString(details.purpose),
        notes: readString(details.notes, "")
      },
      request: {
        ip_address: readString(metadata.ipAddress),
        user_agent: readString(metadata.userAgent)
      }
    };
  });

  return res.json({
    data,
    meta: {
      total: result.total,
      page,
      limit,
      pages: Math.ceil(result.total / limit)
    }
  });
});
