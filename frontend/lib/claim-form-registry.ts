export type ClaimLine = "motor" | "health" | "non_motor" | "life" | "personal_accident" | "other";

export type ClaimFormProfile = {
  line: ClaimLine;
  title: string;
  subtitle: string;
  sections: string[];
};

export type OfficialClaimSource = {
  line: ClaimLine;
  url: string;
  label: string;
};

export type InsurerTemplate = {
  key: string;
  displayName: string;
  aliases: string[];
  verifiedOfficialLines?: ClaimLine[];
  officialSources?: OfficialClaimSource[];
};

const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

export const INSURERS: InsurerTemplate[] = [
  { key: "bajaj", displayName: "Bajaj General Insurance Limited", aliases: ["bajaj allianz", "bajaj general", "bajaj allianz general"], verifiedOfficialLines: ["motor"], officialSources: [{ line: "motor", label: "Official Bajaj Motor Claim Form", url: "https://general.bajajallianz.com/Corp/content/claim/Motor_Claim_Form.pdf" }] },
  { key: "acko", displayName: "Acko General Insurance Limited", aliases: ["acko"], verifiedOfficialLines: ["motor", "health", "non_motor"], officialSources: [
    { line: "motor", label: "ACKO Motor Claim Form", url: "https://www.acko.com/wp-content/uploads/2018/02/motor_claim_form_060218.pdf" },
    { line: "health", label: "ACKO Health Claim Forms", url: "https://www.acko.com/download/" },
    { line: "non_motor", label: "ACKO Property/Cyber/Other Claim Forms", url: "https://www.acko.com/download/" },
  ] },
  { key: "ackolife", displayName: "ACKO Life Insurance Limited", aliases: ["acko life"], verifiedOfficialLines: ["life"], officialSources: [{ line: "life", label: "ACKO Life Death Claim Form", url: "https://www.acko.com/life/download/" }] },
  { key: "cholams", displayName: "Cholamandalam MS General Insurance Company Limited", aliases: ["cholamandalam", "chola ms", "cholamandalam ms"] },
  { key: "digit", displayName: "Go Digit General Insurance Limited", aliases: ["go digit", "digit general", "digit insurance"] },
  { key: "hdfcergo", displayName: "HDFC ERGO General Insurance Company Limited", aliases: ["hdfc ergo", "hdfc general"], verifiedOfficialLines: ["motor", "health", "non_motor"], officialSources: [
    { line: "motor", label: "HDFC ERGO Motor Claim Form", url: "https://www.hdfcergo.com/documents/downloads/claimforms/MotorClaimform.pdf" },
    { line: "health", label: "HDFC ERGO Health Claim Forms", url: "https://www.hdfcergo.com/download" },
    { line: "non_motor", label: "HDFC ERGO Property/Home Claim Forms", url: "https://www.hdfcergo.com/download" },
  ] },
  { key: "icici", displayName: "ICICI Lombard General Insurance Company Limited", aliases: ["icici lombard", "icici general"], verifiedOfficialLines: ["motor", "health"], officialSources: [
    { line: "motor", label: "ICICI Lombard Motor Claim Form", url: "https://www.icicilombard.com/docs/default-source/downloads/motor_claim_form.pdf" },
    { line: "health", label: "ICICI Lombard Health Claim Forms", url: "https://www.icicilombard.com/downloads" },
  ] },
  { key: "iffco", displayName: "IFFCO Tokio General Insurance Company Limited", aliases: ["iffco tokio", "iffco"], verifiedOfficialLines: ["motor", "health"], officialSources: [
    { line: "motor", label: "IFFCO Tokio Motor Claim Form", url: "https://www.iffcotokio.co.in/content/dam/iffcotokio/iffco-pdf/sites/default/files/download_forms/Motor%20Claim%20form_1.pdf" },
    { line: "health", label: "IFFCO Tokio Health Claim Forms", url: "https://www.iffcotokio.co.in/downloads" },
  ] },
  { key: "liberty", displayName: "Liberty General Insurance Limited", aliases: ["liberty general", "liberty videocon"], verifiedOfficialLines: ["motor", "health", "non_motor", "personal_accident"], officialSources: [
    { line: "motor", label: "Liberty Motor Claim Forms", url: "https://www.libertyinsurance.in/customer-support/download-forms.html" },
    { line: "health", label: "Liberty Health Claim Forms", url: "https://www.libertyinsurance.in/customer-support/download-forms.html" },
    { line: "non_motor", label: "Liberty Engineering/Other Claim Forms", url: "https://www.libertyinsurance.in/customer-support/download-forms.html" },
    { line: "personal_accident", label: "Liberty Personal Accident Claim Forms", url: "https://www.libertyinsurance.in/customer-support/download-forms.html" },
  ] },
  { key: "national", displayName: "National Insurance Company Limited", aliases: ["national insurance"] },
  { key: "newindia", displayName: "The New India Assurance Company Limited", aliases: ["new india", "new india assurance"], verifiedOfficialLines: ["non_motor"], officialSources: [{ line: "non_motor", label: "New India Machinery Insurance Claim Form", url: "https://www.newindia.co.in/assets/docs/know-more/miscellaneous/machinery-insurance/Claim%20form.pdf" }] },
  { key: "oriental", displayName: "The Oriental Insurance Company Limited", aliases: ["oriental insurance"] },
  { key: "reliance", displayName: "Reliance General Insurance Company Limited", aliases: ["reliance general", "reliance insurance"], verifiedOfficialLines: ["motor", "non_motor", "personal_accident"], officialSources: [
    { line: "motor", label: "Reliance General Motor Claim Form", url: "https://reliancegeneral.co.in/Downloads/motor_claim_form.pdf" },
    { line: "non_motor", label: "Reliance General Home/Other Claim Forms", url: "https://www.reliancegeneral.co.in/downloads" },
    { line: "personal_accident", label: "Reliance General PA Claim Forms", url: "https://www.reliancegeneral.co.in/downloads" },
  ] },
  { key: "royalsundaram", displayName: "Royal Sundaram General Insurance Co. Limited", aliases: ["royal sundaram"], verifiedOfficialLines: ["motor"], officialSources: [{ line: "motor", label: "Royal Sundaram Motor Insurance Claim Form", url: "https://www.royalsundaram.in/assets/claim-forms/car-insurance/motor-insurance-claim-form.pdf" }] },
  { key: "sbi", displayName: "SBI General Insurance Company Limited", aliases: ["sbi general"], verifiedOfficialLines: ["motor", "health", "non_motor"], officialSources: [
    { line: "motor", label: "SBI General Motor Claims", url: "https://www.sbigeneral.in/claim/motor" },
    { line: "health", label: "SBI General Health Claim Forms", url: "https://www.sbigeneral.in/downloads" },
    { line: "non_motor", label: "SBI General Other Claim Forms", url: "https://www.sbigeneral.in/downloads" },
  ] },
  { key: "shriram", displayName: "Shriram General Insurance Company Limited", aliases: ["shriram general"] },
  { key: "tataaig", displayName: "Tata AIG General Insurance Company Limited", aliases: ["tata aig"], verifiedOfficialLines: ["motor", "health", "non_motor"], officialSources: [
    { line: "motor", label: "Tata AIG Motor Claim Forms", url: "https://www.tataaig.com/downloads" },
    { line: "health", label: "Tata AIG Health Claim Forms", url: "https://www.tataaig.com/downloads" },
    { line: "non_motor", label: "Tata AIG Home/Property Claim Forms", url: "https://www.tataaig.com/downloads" },
  ] },
  { key: "united", displayName: "United India Insurance Company Limited", aliases: ["united india"], verifiedOfficialLines: ["motor"], officialSources: [{ line: "motor", label: "United India Motor Claim Form - Commercial Vehicle", url: "https://uiic.co.in/sites/default/files/uploads/downloadcenter/Motor_Claim_CV.pdf" }] },
  { key: "universal", displayName: "Universal Sompo General Insurance Company Limited", aliases: ["universal sompo"], verifiedOfficialLines: ["motor"], officialSources: [{ line: "motor", label: "Universal Sompo Motor Claim Form", url: "https://www.universalsompo.com/assets/file/claims/motor-claim-form.pdf" }] },
  { key: "zurichkotak", displayName: "Zurich Kotak General Insurance Company (India) Limited", aliases: ["zurich kotak", "kotak general"], verifiedOfficialLines: ["motor", "health", "non_motor"], officialSources: [
    { line: "motor", label: "Zurich Kotak Motor Claim Form", url: "https://one.zurichkotak.com/services/claims" },
    { line: "health", label: "Zurich Kotak Health Claim Forms", url: "https://one.zurichkotak.com/services/claims" },
    { line: "non_motor", label: "Zurich Kotak Other Claim Forms", url: "https://one.zurichkotak.com/services/claims" },
  ] },
  { key: "zuno", displayName: "Zuno General Insurance Limited", aliases: ["zuno", "edelweiss general"] },
  { key: "care", displayName: "Care Health Insurance Limited", aliases: ["care health", "religare health"], verifiedOfficialLines: ["health"], officialSources: [{ line: "health", label: "Care Health Claim Forms", url: "https://www.careinsurance.com/health-insurance-claim-forms.html" }] },
  { key: "star", displayName: "Star Health and Allied Insurance Company Limited", aliases: ["star health"], verifiedOfficialLines: ["health"], officialSources: [{ line: "health", label: "Star Health Reimbursement Claim Form", url: "https://web.starhealth.in/sites/default/files/CLAIMFORM.pdf" }] },
  { key: "niva", displayName: "Niva Bupa Health Insurance Company Limited", aliases: ["niva bupa", "max bupa"], verifiedOfficialLines: ["health", "personal_accident"], officialSources: [
    { line: "health", label: "Niva Bupa Reimbursement Claim Form", url: "https://transactions.nivabupa.com/pages/downloads.aspx" },
    { line: "personal_accident", label: "Niva Bupa Personal Accident Claim Form", url: "https://transactions.nivabupa.com/pages/downloads.aspx" },
  ] },
  { key: "manipal", displayName: "ManipalCigna Health Insurance Company Limited", aliases: ["manipalcigna", "manipal cigna", "cigna ttk"], verifiedOfficialLines: ["health", "personal_accident"], officialSources: [
    { line: "health", label: "ManipalCigna Health Claim Forms", url: "https://www.manipalcigna.com/downloads/claims/-/categories/37830" },
    { line: "personal_accident", label: "ManipalCigna Group PA Claim Forms", url: "https://www.manipalcigna.com/downloads/claims/-/categories/37830" },
  ] },
  { key: "adityabirlahealth", displayName: "Aditya Birla Health Insurance Company Limited", aliases: ["aditya birla health"], verifiedOfficialLines: ["health"], officialSources: [{ line: "health", label: "Aditya Birla Health Claim Forms", url: "https://www.adityabirlacapital.com/healthinsurance/claim" }] },
  { key: "lic", displayName: "Life Insurance Corporation of India", aliases: ["lic", "life insurance corporation"], verifiedOfficialLines: ["life"], officialSources: [{ line: "life", label: "LIC Claimant Statement Form 3783(A)", url: "https://originlic.licindia.in/documents/d/guest/3783-a-" }] },
  { key: "hdfclife", displayName: "HDFC Life Insurance Company Limited", aliases: ["hdfc life"], verifiedOfficialLines: ["life"], officialSources: [{ line: "life", label: "HDFC Life Individual Death Claim Form", url: "https://www.hdfclife.com/content/dam/hdfclifeinsurancecompany/claims/claims-pdf/Individual-Death-Claim-Form-Proposed-Standard-2022.pdf" }] },
  { key: "sbilife", displayName: "SBI Life Insurance Company Limited", aliases: ["sbi life"], verifiedOfficialLines: ["life"], officialSources: [{ line: "life", label: "SBI Life Death Claim Forms", url: "https://www.sbilife.co.in/en/services/download-center" }] },
  { key: "icicipru", displayName: "ICICI Prudential Life Insurance Company Limited", aliases: ["icici prudential", "icici pru"], verifiedOfficialLines: ["life"], officialSources: [{ line: "life", label: "ICICI Prudential Individual Death Claim Form", url: "https://www.iciciprulife.com/content/dam/icicipru/claims-documents/Claimant_statement_form_Death.pdf" }] },
  { key: "axismax", displayName: "Axis Max Life Insurance Limited", aliases: ["axis max life", "max life"], verifiedOfficialLines: ["life"], officialSources: [{ line: "life", label: "Axis Max Life Individual Death Claim Form", url: "https://www.axismaxlife.com/content/dam/corporate/claims/death-claims/english/INDIVIDUAL-DEATH-CLAIM-FORM-A.pdf" }] },
  { key: "tataaialife", displayName: "Tata AIA Life Insurance Company Limited", aliases: ["tata aia"] },
  { key: "kotaklife", displayName: "Kotak Mahindra Life Insurance Company Limited", aliases: ["kotak life", "kotak mahindra life"] },
  { key: "birlasunlife", displayName: "Aditya Birla Sun Life Insurance Company Limited", aliases: ["aditya birla sun life", "birla sun life"] },
];

export const FORM_PROFILES: Record<ClaimLine, ClaimFormProfile> = {
  motor: { line: "motor", title: "Motor Insurance Claim Form", subtitle: "Policy, vehicle, driver, accident, police, third-party, repair and bank details", sections: ["Policy holder", "Vehicle & loss", "Driver", "Accident statement", "Third party", "Repair / garage", "Bank / NEFT", "Declaration"] },
  health: { line: "health", title: "Health Insurance Claim Form", subtitle: "Insured patient, hospitalisation, diagnosis, treatment, bills and bank details", sections: ["Policy & patient", "Hospitalisation", "Diagnosis & treatment", "Hospital / TPA", "Expense details", "Bank / NEFT", "Documents", "Declaration"] },
  non_motor: { line: "non_motor", title: "Non-Motor Insurance Claim Form", subtitle: "Property, fire, marine, shop, liability and miscellaneous loss reporting", sections: ["Policy holder", "Risk / property", "Loss event", "Police / fire brigade", "Damage details", "Surveyor", "Claim amount", "Bank / declaration"] },
  life: { line: "life", title: "Life Insurance Claim Form", subtitle: "Life assured, claimant, event details, nominee/legal-heir and bank information", sections: ["Policy & life assured", "Claimant / nominee", "Event details", "Medical / death documents", "KYC", "Bank / NEFT", "Declaration"] },
  personal_accident: { line: "personal_accident", title: "Personal Accident Claim Form", subtitle: "Accident, injury/disability/death, treatment and benefit claim details", sections: ["Policy holder", "Accident", "Injury / disability", "Treatment", "Police", "Benefit details", "Bank", "Declaration"] },
  other: { line: "other", title: "Insurance Claim Form", subtitle: "Universal insurer claim submission form", sections: ["Policy holder", "Loss / event", "Claim details", "Supporting documents", "Bank", "Declaration"] },
};

export function resolveInsurer(name?: string | null): InsurerTemplate {
  const n = normalize(name || "");
  const match = INSURERS.find((insurer) => insurer.aliases.some((alias) => n.includes(normalize(alias))) || n.includes(normalize(insurer.displayName)));
  return match || { key: n.replace(/\s+/g, "-") || "unknown-insurer", displayName: name?.trim() || "Insurance Company", aliases: name ? [name] : [] };
}

export function resolveClaimLine(value?: string | null): ClaimLine {
  const n = normalize(value || "");
  if (n.includes("motor")) return "motor";
  if (n.includes("health") || n.includes("mediclaim")) return "health";
  if (n.includes("life")) return "life";
  if (n.includes("personal accident") || n === "pa") return "personal_accident";
  if (n.includes("non motor") || n.includes("property") || n.includes("fire") || n.includes("marine")) return "non_motor";
  return "other";
}

export function getClaimFormProfile(line?: string | null) { return FORM_PROFILES[resolveClaimLine(line)]; }

export function isVerifiedOfficialTemplate(insurerName: string | null | undefined, line: string | null | undefined) {
  const insurer = resolveInsurer(insurerName);
  return Boolean(insurer.verifiedOfficialLines?.includes(resolveClaimLine(line)));
}

export function getOfficialClaimSource(insurerName: string | null | undefined, line: string | null | undefined) {
  const insurer = resolveInsurer(insurerName);
  const resolvedLine = resolveClaimLine(line);
  return insurer.officialSources?.find((source) => source.line === resolvedLine) || null;
}
