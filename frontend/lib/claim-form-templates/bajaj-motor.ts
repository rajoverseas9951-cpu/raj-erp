export type BajajMotorPdfField = {
  formKey: string;
  pdfField: string;
  label: string;
  confidence: "high" | "review";
  page: 1 | 2;
};

export type BajajMotorPdfChoice = {
  formKey: string;
  pdfField: string;
  label: string;
  values: Record<string, string>;
  page: 1 | 2;
};

/**
 * Field names below come from the official two-page Bajaj General Motor Claim
 * PDF AcroForm supplied for the ERP implementation. The PDF contains 104 form
 * fields. We only automate fields whose visual position / AcroForm purpose is
 * sufficiently clear; ambiguous generated names stay manual until verified.
 */
export const BAJAJ_MOTOR_PDF_FIELDS: BajajMotorPdfField[] = [
  { formKey: "ckyc_no", pdfField: "1", label: "CKYC No.", confidence: "high", page: 1 },
  { formKey: "pan", pdfField: "undefined", label: "PAN", confidence: "high", page: 1 },
  { formKey: "dob", pdfField: "undefined_2", label: "DOB", confidence: "high", page: 1 },
  { formKey: "voter_id", pdfField: "2", label: "Voter ID", confidence: "high", page: 1 },
  { formKey: "policy_number", pdfField: "UID Last 4 Digit I 2", label: "Policy Number", confidence: "high", page: 1 },
  { formKey: "insured_name", pdfField: "undefined_5", label: "Name of Insured", confidence: "review", page: 1 },
  { formKey: "mobile", pdfField: "91", label: "Mobile Number", confidence: "high", page: 1 },
  { formKey: "address", pdfField: "undefined_6", label: "Address", confidence: "review", page: 1 },
  { formKey: "city", pdfField: "undefined_7", label: "City / State block", confidence: "review", page: 1 },
  { formKey: "pin_code", pdfField: "ma1 ID", label: "PIN Code", confidence: "high", page: 1 },
  { formKey: "email", pdfField: "1_2", label: "Email ID", confidence: "high", page: 1 },

  { formKey: "registration_number", pdfField: "3 Vehicle Loss Details Accident Theft", label: "Vehicle Registration No.", confidence: "high", page: 1 },
  { formKey: "chassis_number", pdfField: "Chassis Number I I", label: "Chassis Number", confidence: "high", page: 1 },
  { formKey: "loss_date", pdfField: "undefined_10", label: "Accident / Loss Date", confidence: "high", page: 1 },
  { formKey: "loss_time", pdfField: "undefined_11", label: "Accident / Loss Time", confidence: "high", page: 1 },
  { formKey: "occupants", pdfField: "fill_70", label: "No. of Occupants", confidence: "high", page: 1 },
  { formKey: "fir_number", pdfField: "undefined_9", label: "GD / FIR No.", confidence: "high", page: 1 },
  { formKey: "police_station", pdfField: "Name of Police Station 1", label: "Police Station", confidence: "high", page: 1 },
  { formKey: "loss_place", pdfField: "Name of Police Station 2", label: "Place of Accident", confidence: "high", page: 1 },

  { formKey: "driver_name", pdfField: "Name 1", label: "Driver Name", confidence: "high", page: 1 },
  { formKey: "driving_licence", pdfField: "Name 2", label: "Driving Licence No.", confidence: "high", page: 1 },
  { formKey: "issuing_rto", pdfField: "rto", label: "Issuing RTO", confidence: "high", page: 1 },
  { formKey: "driver_mobile", pdfField: "mobile 1001", label: "Driver Mobile", confidence: "high", page: 1 },
  { formKey: "accident_description", pdfField: "took place 1", label: "Accident Statement - line 1", confidence: "high", page: 1 },
  { formKey: "accident_description_2", pdfField: "took place 2", label: "Accident Statement - line 2", confidence: "high", page: 1 },
  { formKey: "accident_description_3", pdfField: "took place 3", label: "Accident Statement - line 3", confidence: "high", page: 1 },

  { formKey: "tp_vehicle_person_1", pdfField: "Vehicle Make and Model PersonRow1", label: "Third Party Vehicle / Person", confidence: "high", page: 1 },
  { formKey: "tp_address_1", pdfField: "Inspection AddressRow1", label: "Third Party Address", confidence: "high", page: 1 },
  { formKey: "tp_contact_1", pdfField: "Contact NumberRow1", label: "Third Party Contact", confidence: "high", page: 1 },
  { formKey: "tp_id_1", pdfField: "Vehicle NumberPerson IDRow1", label: "Third Party Vehicle No. / Person ID", confidence: "high", page: 1 },
  { formKey: "tp_damage_1", pdfField: "Description of Injury damageRow1", label: "Third Party Injury / Damage", confidence: "high", page: 1 },

  { formKey: "account_holder_name", pdfField: "Branch", label: "Name on Bank Account", confidence: "review", page: 1 },
  { formKey: "account_number", pdfField: "undefined_14", label: "Account Number", confidence: "review", page: 1 },
  { formKey: "ifsc_code", pdfField: "MICRCodeI I I I I I I I I I I", label: "IFSC Code", confidence: "review", page: 1 },
  { formKey: "micr_code", pdfField: "micr", label: "MICR Code", confidence: "review", page: 1 },
  { formKey: "signature_name", pdfField: "Name 3", label: "Insured Name near Signature", confidence: "high", page: 1 },
  { formKey: "signature_date", pdfField: "date1", label: "Declaration Date", confidence: "high", page: 1 },

  { formKey: "claim_number", pdfField: "claim", label: "Discharge Voucher Claim No.", confidence: "high", page: 2 },
  { formKey: "policy_number", pdfField: "policy", label: "Discharge Voucher Policy No.", confidence: "high", page: 2 },
  { formKey: "settlement_amount", pdfField: "rs", label: "Full & Final Settlement Amount", confidence: "high", page: 2 },
  { formKey: "settlement_amount_words", pdfField: "rs1", label: "Settlement Amount / Rs.", confidence: "review", page: 2 },
  { formKey: "issuance_office", pdfField: "add1", label: "Issuance Office / Seal line 1", confidence: "review", page: 2 },
  { formKey: "issuance_office_2", pdfField: "add2", label: "Issuance Office / Seal line 2", confidence: "review", page: 2 },
];

export const BAJAJ_MOTOR_PDF_CHOICES: BajajMotorPdfChoice[] = [
  { formKey: "salvage_retain", pdfField: "Group1", label: "Retain Salvage", values: { Yes: "Choice1", No: "Choice2" }, page: 1 },
  { formKey: "police_report", pdfField: "Group1001", label: "Police Report", values: { Yes: "0", No: "1" }, page: 1 },
  { formKey: "driver_relation", pdfField: "Group1002", label: "Relation with Insured", values: { Self: "0", Relative: "1", Friend: "2", "Paid Driver": "3", Employee: "4" }, page: 1 },
  { formKey: "addon_claim", pdfField: "Group1003", label: "Add-on Endorsement Claim", values: { Yes: "0", No: "1" }, page: 1 },
  { formKey: "tp_involvement", pdfField: "Group1004", label: "Third Party Involvement", values: { Yes: "0", No: "1" }, page: 1 },
  { formKey: "account_type", pdfField: "Group1005", label: "Bank Account Type", values: { Savings: "0", Current: "1", "Cash Credit": "2" }, page: 1 },
  { formKey: "bank_proof", pdfField: "Group1006", label: "Bank Proof", values: { "Cancelled Cheque": "0", "Bank passbook copy": "1" }, page: 1 },
];

export const BAJAJ_MOTOR_ACCIDENT_DOCUMENT_CHECKBOXES = Array.from({ length: 10 }, (_, index) => `Group1007.${index}`);
export const BAJAJ_MOTOR_THEFT_DOCUMENT_CHECKBOXES = Array.from({ length: 11 }, (_, index) => `Group1008.${index}`);

export const BAJAJ_MOTOR_REQUIRED_PREP_KEYS = [
  "policy_number",
  "insured_name",
  "mobile",
  "registration_number",
  "chassis_number",
  "loss_date",
  "loss_place",
  "driver_name",
  "driving_licence",
  "accident_description",
] as const;

export function isBajajMotorExactTemplate(insurerKey: string, line: string): boolean {
  return insurerKey === "bajaj" && line === "motor";
}
