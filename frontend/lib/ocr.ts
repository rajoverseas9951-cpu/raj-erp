export type OcrResult = {
  text: string;
  texts: string[];
  fields: Record<string, string>;
  field_confidence?: Record<string, number>;
  overall_confidence?: number;
  warnings?: string[];
};

export async function scanDocument(
  documentType: "rc" | "aadhaar" | "insurance_policy",
  images: File[],
): Promise<OcrResult> {
  const form = new FormData();
  form.append("document_type", documentType);
  images.forEach((image) => form.append("images[]", image));

  return authenticatedRequest<OcrResult>("/ocr", {
    method: "POST",
    body: form,
  });
}
import { authenticatedRequest } from "@/lib/api-client";
