export type ClaimLine = "motor" | "health" | "non_motor" | "life" | "personal_accident" | "other";

export type ClaimFormProfile = {
  line: ClaimLine;
  title: string;
  subtitle: string;
  sections: string[];
};

export type InsurerTemplate = {
  key: string;
  displayName: string;
  aliases: string[];
  verifiedOfficialLines?: ClaimLine[];
};

const normalize = (value: string) =>
  value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

// This registry is intentionally alias-based, not a closed whitelist. Any insurer
// name not listed here still gets the correct line-specific universal form.
export const INSURERS: InsurerTemplate[] = [
  { key: "bajaj", displayName: "Bajaj General Insurance Limited", aliases: ["bajaj allianz", "bajaj general", "bajaj allianz general"], verifiedOfficialLines: ["motor"] },
  { key: "acko", displayName: "Acko General Insurance Limited", aliases: ["acko"] },
  { key: "cholams", displayName: "Cholamandalam MS General Insurance Company Limited", aliases: ["cholamandalam", "chola ms", "cholamandalam ms"] },
  { key: "digit", displayName: "Go Digit General Insurance Limited", aliases: ["go digit", "digit general", "digit insurance"] },
  { key: "hdfcergo", displayName: "HDFC ERGO General Insurance Company Limited", aliases: ["hdfc ergo", "hdfc general"] },
  { key: "icici", displayName: "ICICI Lombard General Insurance Company Limited", aliases: ["icici lombard", "icici general"] },
  { key: "iffco", displayName: "IFFCO Tokio General Insurance Company Limited", aliases: ["iffco tokio", "iffco"] },
  { key: "liberty", displayName: "Liberty General Insurance Limited", aliases: ["liberty general", "liberty videocon"] },
  { key: "national", displayName: "National Insurance Company Limited", aliases: ["national insurance"] },
  { key: "newindia", displayName: "The New India Assurance Company Limited", aliases: ["new india", "new india assurance"] },
  { key: "oriental", displayName: "The Oriental Insurance Company Limited", aliases: ["oriental insurance"] },
  { key: "reliance", displayName: "Reliance General Insurance Company Limited", aliases: ["reliance general", "reliance insurance"] },
  { key: "royalsundaram", displayName: "Royal Sundaram General Insurance Co. Limited", aliases: ["royal sundaram"] },
  { key: "sbi", displayName: "SBI General Insurance Company Limited", aliases: ["sbi general"] },
  { key: "shriram", displayName: "Shriram General Insurance Company Limited", aliases: ["shriram general"] },
  { key: "tataaig", displayName: "Tata AIG General Insurance Company Limited", aliases: ["tata aig"] },
  { key: "united", displayName: "United India Insurance Company Limited", aliases: ["united india"] },
  { key: "universal", displayName: "Universal Sompo General Insurance Company Limited", aliases: ["universal sompo"] },
  { key: "zurichkotak", displayName: "Zurich Kotak General Insurance Company (India) Limited", aliases: ["zurich kotak", "kotak general"] },
  { key: "zuno", displayName: "Zuno General Insurance Limited", aliases: ["zuno", "edelweiss general"] },
  { key: "care", displayName: "Care Health Insurance Limited", aliases: ["care health", "religare health"] },
  { key: "star", displayName: "Star Health and Allied Insurance Company Limited", aliases: ["star health"] },
  { key: "niva", displayName: "Niva Bupa Health Insurance Company Limited", aliases: ["niva bupa", "max bupa"] },
  { key: "manipal", displayName: "ManipalCigna Health Insurance Company Limited", aliases: ["manipalcigna", "manipal cigna", "cigna ttk"] },
  { key: "adityabirlahealth", displayName: "Aditya Birla Health Insurance Company Limited", aliases: ["aditya birla health"] },
  { key: "lic", displayName: "Life Insurance Corporation of India", aliases: ["lic", "life insurance corporation"] },
  { key: "hdfclife", displayName: "HDFC Life Insurance Company Limited", aliases: ["hdfc life"] },
  { key: "sbilife", displayName: "SBI Life Insurance Company Limited", aliases: ["sbi life"] },
  { key: "icicipru", displayName: "ICICI Prudential Life Insurance Company Limited", aliases: ["icici prudential", "icici pru"] },
  { key: "axismax", displayName: "Axis Max Life Insurance Limited", aliases: ["axis max life", "max life"] },
  { key: "tataaialife", displayName: "Tata AIA Life Insurance Company Limited", aliases: ["tata aia"] },
  { key: "kotaklife", displayName: "Kotak Mahindra Life Insurance Company Limited", aliases: ["kotak life", "kotak mahindra life"] },
  { key: "birlasunlife", displayName: "Aditya Birla Sun Life Insurance Company Limited", aliases: ["aditya birla sun life", "birla sun life"] },
];

export const FORM_PROFILES: Record<ClaimLine, ClaimFormProfile> = {
  motor: {
    line: "motor",
    title: "Motor Insurance Claim Form",
    subtitle: "Policy, vehicle, driver, accident, police, third-party, repair and bank details",
    sections: ["Policy holder", "Vehicle & loss", "Driver", "Accident statement", "Third party", "Repair / garage", "Bank / NEFT", "Declaration"],
  },
  health: {
    line: "health",
    title: "Health Insurance Claim Form",
    subtitle: "Insured patient, hospitalisation, diagnosis, treatment, bills and bank details",
    sections: ["Policy & patient", "Hospitalisation", "Diagnosis & treatment", "Hospital / TPA", "Expense details", "Bank / NEFT", "Documents", "Declaration"],
  },
  non_motor: {
    line: "non_motor",
    title: "Non-Motor Insurance Claim Form",
    subtitle: "Property, fire, marine, shop, liability and miscellaneous loss reporting",
    sections: ["Policy holder", "Risk / property", "Loss event", "Police / fire brigade", "Damage details", "Surveyor", "Claim amount", "Bank / declaration"],
  },
  life: {
    line: "life",
    title: "Life Insurance Claim Form",
    subtitle: "Life assured, claimant, event details, nominee/legal-heir and bank information",
    sections: ["Policy & life assured", "Claimant / nominee", "Event details", "Medical / death documents", "KYC", "Bank / NEFT", "Declaration"],
  },
  personal_accident: {
    line: "personal_accident",
    title: "Personal Accident Claim Form",
    subtitle: "Accident, injury/disability/death, treatment and benefit claim details",
    sections: ["Policy holder", "Accident", "Injury / disability", "Treatment", "Police", "Benefit details", "Bank", "Declaration"],
  },
  other: {
    line: "other",
    title: "Insurance Claim Form",
    subtitle: "Universal insurer claim submission form",
    sections: ["Policy holder", "Loss / event", "Claim details", "Supporting documents", "Bank", "Declaration"],
  },
};

export function resolveInsurer(name?: string | null): InsurerTemplate {
  const n = normalize(name || "");
  const match = INSURERS.find((insurer) =>
    insurer.aliases.some((alias) => n.includes(normalize(alias))) || n.includes(normalize(insurer.displayName)),
  );
  return match || {
    key: n.replace(/\s+/g, "-") || "unknown-insurer",
    displayName: name?.trim() || "Insurance Company",
    aliases: name ? [name] : [],
  };
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

export function getClaimFormProfile(line?: string | null) {
  return FORM_PROFILES[resolveClaimLine(line)];
}

export function isVerifiedOfficialTemplate(insurerName: string | null | undefined, line: string | null | undefined) {
  const insurer = resolveInsurer(insurerName);
  const resolvedLine = resolveClaimLine(line);
  return Boolean(insurer.verifiedOfficialLines?.includes(resolvedLine));
}
