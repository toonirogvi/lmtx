import { z } from "zod";

export const internStatusSchema = z.enum(["Applied", "Offered", "Joined", "Completed", "Relieved"]);

export const applicantStatusSchema = z.enum(["Applied", "Screening", "Interview", "Offered", "Hired", "Rejected"]);

export const documentTypeSchema = z.enum(["offer", "certificate", "experience", "relieving", "nda"]);

const dateInputSchema = z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/));

const optionalDateInputSchema = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? null : value),
  dateInputSchema.nullable().optional()
);

const optionalText = (max = 200) =>
  z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    z.string().trim().max(max).optional()
  );

const personNameSchema = z
  .string()
  .trim()
  .min(2)
  .max(120)
  .regex(/^[A-Za-z][A-Za-z .'-]*$/, "Use letters only for names.");

const phoneSchema = z
  .string()
  .trim()
  .regex(/^\d{7,15}$/, "Phone must contain digits only, 7 to 15 numbers.");

const optionalPhoneSchema = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  phoneSchema.optional()
);

const businessTextSchema = (min = 2, max = 160) =>
  z
    .string()
    .trim()
    .min(min)
    .max(max)
    .regex(/^[A-Za-z0-9][A-Za-z0-9 &.,/+()#'-]*$/, "Use valid business text.");

const optionalUrl = (max = 500) =>
  z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    z.string().trim().url().max(max).optional()
  );

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8)
});

export const advocateRegisterSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(160),
  password: z.string().min(10).max(100),
  phone: z.string().trim().min(6).max(20),
  organization: z.string().trim().min(2).max(160),
  bar_council_id: z.string().trim().min(3).max(80)
});

export const advocateCaseSchema = z.object({
  case_title: z.string().trim().min(3).max(180),
  client_name: z.string().trim().min(2).max(120),
  case_type: z.string().trim().min(2).max(80),
  jurisdiction: optionalText(120),
  description: z.string().trim().min(10).max(2000)
});

export const creditPurchaseSchema = z.object({
  package_id: z.enum(["credits_10", "credits_25", "credits_50"]),
  payment_reference: optionalText(160),
  notes: optionalText(500)
});

export const approveCreditPurchaseSchema = z.object({
  transaction_id: z.string().uuid()
});

export const idParamSchema = z.object({
  id: z.string().uuid()
});

export const referenceParamSchema = z.object({
  reference_id: z.string().regex(/^LTX-\d{8}-\d{4}$/)
});

export const createInternSchema = z.object({
  name: personNameSchema,
  email: z.string().trim().email().max(160).transform((value) => value.toLowerCase()),
  phone: phoneSchema,
  role: businessTextSchema(2, 120),
  department: businessTextSchema(2, 120),
  joining_date: dateInputSchema,
  exit_date: optionalDateInputSchema,
  duration: z.string().min(2).optional(),
  manager: personNameSchema,
  status: internStatusSchema.optional()
});

export const updateInternSchema = createInternSchema
  .partial()
  .extend({
    is_revoked: z.boolean().optional()
  })
  .refine((value) => Object.keys(value).length > 0, "At least one field is required.");

export const listInternsSchema = z.object({
  search: z.string().optional(),
  status: internStatusSchema.optional(),
  includeDeleted: z.enum(["true", "false"]).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20)
});

export const createApplicantSchema = z.object({
  name: personNameSchema,
  email: z.string().trim().email().max(160).transform((value) => value.toLowerCase()),
  phone: phoneSchema,
  position: businessTextSchema(2, 120),
  department: businessTextSchema(2, 120),
  source: businessTextSchema(2, 120),
  status: applicantStatusSchema.optional(),
  experience: z.string().trim().min(1).max(80).regex(/^(Fresher|\d{1,2}(\.\d{1,2})?\s*(month|months|year|years))$/i, "Use Fresher, 6 months, or 2 years."),
  expected_joining_date: optionalDateInputSchema,
  resume_url: optionalUrl(500),
  owner: personNameSchema,
  notes: optionalText(1500)
});

export const updateApplicantSchema = createApplicantSchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, "At least one field is required.");

export const listApplicantsSchema = z.object({
  search: z.string().optional(),
  status: applicantStatusSchema.optional(),
  includeDeleted: z.enum(["true", "false"]).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(50)
});

export const generateDocumentSchema = z.object({
  internId: z.string().uuid(),
  type: documentTypeSchema
});

export const listDocumentsSchema = z.object({
  internId: z.string().uuid().optional(),
  offset: z.coerce.number().int().nonnegative().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(10)
});

export const emailDocumentSchema = z.object({
  email: z.string().email().optional()
});

export const listBgvAccessLogsSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20)
});

export const verificationRequestSchema = z.object({
  verifier_name: personNameSchema,
  verifier_email: z.string().trim().email().max(160).transform((value) => value.toLowerCase()),
  verifier_phone: optionalPhoneSchema,
  verifier_organization: businessTextSchema(2, 160),
  verifier_designation: optionalText(120),
  purpose: z.enum([
    "Background Verification",
    "Employment Verification",
    "Academic Verification",
    "Client Verification",
    "Vendor Verification",
    "Other"
  ]),
  notes: optionalText(500),
  consent: z.literal(true)
});
