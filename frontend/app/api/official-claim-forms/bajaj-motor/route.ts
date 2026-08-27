import { NextResponse } from "next/server";

const BAJAJ_MOTOR_CLAIM_FORM_URL = "https://general.bajajallianz.com/Corp/content/claim/Motor_Claim_Form.pdf";

export async function GET() {
  try {
    const response = await fetch(BAJAJ_MOTOR_CLAIM_FORM_URL, { cache: "no-store" });
    if (!response.ok) {
      return NextResponse.json({ message: "Official Bajaj claim form could not be downloaded." }, { status: 502 });
    }

    const bytes = await response.arrayBuffer();
    return new NextResponse(bytes, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'attachment; filename="Bajaj-General-Motor-Claim-Form.pdf"',
        "Cache-Control": "private, no-store, max-age=0",
      },
    });
  } catch {
    return NextResponse.json({ message: "Official Bajaj claim form could not be downloaded." }, { status: 502 });
  }
}
