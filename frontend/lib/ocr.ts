export type OcrResult = {
  text: string;
  texts: string[];
  fields: Record<string, string>;
};

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://127.0.0.1:8000';

export async function scanDocument(documentType: 'rc' | 'aadhaar' | 'insurance_policy', images: File[]): Promise<OcrResult> {
  const token = sessionStorage.getItem('raj_erp_token');
  const form = new FormData();
  form.append('document_type', documentType);
  images.forEach((image) => form.append('images[]', image));

  const response = await fetch(`${API}/api/v1/ocr`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: form,
  });

  const payload = await response.json().catch(() => ({})) as {
    data?: OcrResult;
    message?: string;
    errors?: Record<string, string[]>;
  };

  if (!response.ok) {
    const validationError = payload.errors ? Object.values(payload.errors)[0]?.[0] : undefined;
    throw new Error(validationError ?? payload.message ?? `OCR request failed: ${response.status}`);
  }

  if (!payload.data) throw new Error('OCR response did not contain any data.');
  return payload.data;
}
