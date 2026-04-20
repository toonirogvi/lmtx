import type { DocumentRecord, InternRecord } from "../types/models";

type InternWithDocuments = InternRecord & { documents?: DocumentRecord[] };

export function toInternDto(intern: InternWithDocuments) {
  return {
    id: intern.id,
    name: intern.name,
    email: intern.email,
    phone: intern.phone,
    role: intern.role,
    department: intern.department,
    joining_date: intern.joiningDate.toISOString(),
    exit_date: intern.exitDate?.toISOString() ?? null,
    duration: intern.duration,
    manager: intern.manager,
    reference_id: intern.referenceId,
    status: intern.status,
    is_revoked: intern.isRevoked,
    created_at: intern.createdAt.toISOString(),
    updated_at: intern.updatedAt.toISOString(),
    deleted_at: intern.deletedAt?.toISOString() ?? null,
    documents: intern.documents?.map(toDocumentDto) ?? []
  };
}

export function toDocumentDto(document: DocumentRecord) {
  return {
    id: document.id,
    intern_id: document.internId,
    type: document.type,
    file_url: document.fileUrl,
    created_at: document.createdAt.toISOString()
  };
}
