import type { ApplicantRecord } from "../types/models";

export function toApplicantDto(applicant: ApplicantRecord) {
  return {
    id: applicant.id,
    name: applicant.name,
    email: applicant.email,
    phone: applicant.phone,
    position: applicant.position,
    department: applicant.department,
    source: applicant.source,
    status: applicant.status,
    experience: applicant.experience,
    expected_joining_date: applicant.expectedJoiningDate?.toISOString() ?? null,
    resume_url: applicant.resumeUrl ?? null,
    owner: applicant.owner,
    notes: applicant.notes ?? null,
    created_at: applicant.createdAt.toISOString(),
    updated_at: applicant.updatedAt.toISOString(),
    deleted_at: applicant.deletedAt?.toISOString() ?? null
  };
}
