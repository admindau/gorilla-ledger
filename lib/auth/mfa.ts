export type TotpFactorSummary = {
  id: string;
  status: string;
  friendly_name?: string | null;
};

export function verifiedTotpFactors<T extends TotpFactorSummary>(factors: T[]) {
  return factors.filter((factor) => factor.status === "verified");
}

export function factorDisplayName(
  factor: TotpFactorSummary,
  index: number,
) {
  const friendlyName = factor.friendly_name?.trim();
  return friendlyName || `Authenticator ${index + 1}`;
}

export function initialFactorSelection(factors: TotpFactorSummary[]) {
  return factors.length === 1 ? factors[0].id : null;
}
