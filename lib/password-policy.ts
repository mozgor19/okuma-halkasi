export const PASSWORD_ITERATIONS = 600_000;
export const MIN_PASSWORD_ITERATIONS = 100_000;
export const MAX_PASSWORD_ITERATIONS = 1_000_000;

export function normalizeUsername(username: string): string {
  return username.trim().toLowerCase();
}

export function passwordIterationsSupported(iterations: number): boolean {
  return Number.isInteger(iterations)
    && iterations >= MIN_PASSWORD_ITERATIONS
    && iterations <= MAX_PASSWORD_ITERATIONS;
}

export function passwordValidationIssue(password: string, username: string): string | null {
  if (password.length < 12) return "Yeni şifre en az 12 karakter olmalı.";
  if (password.length > 200) return "Yeni şifre en fazla 200 karakter olabilir.";
  if (!/[a-zçğıöşü]/i.test(password) || !/\d/.test(password)) {
    return "Yeni şifre en az bir harf ve bir rakam içermeli.";
  }
  const compactUsername = normalizeUsername(username).replace(/[^a-z0-9]/g, "");
  const compactPassword = password.toLowerCase().replace(/[^a-z0-9]/g, "");
  return compactUsername.length >= 4 && compactPassword.includes(compactUsername)
    ? "Yeni şifre kullanıcı adını içermemeli."
    : null;
}
