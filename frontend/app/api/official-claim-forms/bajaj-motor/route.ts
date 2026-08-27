import { NextResponse } from "next/server";

// IMPORTANT: This URL must stay on the same Bajaj General 2-page AcroForm
// version used by the ERP field map. The legacy general.bajajallianz.com URL
// serves an older Bajaj Allianz form whose field names do not match.
const BAJAJ_MOTOR_CLAIM_FORM_URL = "https://www.bajajgeneralinsurance.com/download-documents/motor/Motor_Claim_Form.pdf";

export async function GET() {
  try {
    const response = await fetch(BAJAJ_MOTOR_CLAIM_FORM_URL, {
      cache: "no-store",
      headers: { Accept: "application/pdf" },
    });
    if (!response.ok) {
      return NextResponse.json({ message: "Current official Bajaj claim form could not be downloaded." }, { status: 502 });
    }

    const contentType = response.headers.get("content-type") || "";
    const bytes = await response.arrayBuffer();
    const signature = new TextDecoder("latin1").decode(bytes.slice(0, 5));
    if (!contentType.toLowerCase().includes("pdf") && signature !== "%PDF-") {
      return NextResponse.json({ message: "Bajaj returned an invalid claim-form file." }, { status: 502 });
    }

    return new NextResponse(bytes, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'attachment; filename="Bajaj-General-Motor-Claim-Form.pdf"',
        "Cache-Control": "private, no-store, max-age=0",
        "X-Bajaj-Template": "bajaj-general-motor-v1",
      },
    });
  } catch {
    return NextResponse.json({ message: "Current official Bajaj claim form could not be downloaded." }, { status: 502 });
  }
}
