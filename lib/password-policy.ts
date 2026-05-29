/** Shared password rules for signup, reset, and settings copy. */
export const PASSWORD_MIN_LENGTH = 8

export const PASSWORD_REQUIREMENTS_TEXT =
  'At least 8 characters, including one uppercase letter, one lowercase letter, and one special character.'

const HAS_LOWERCASE = /[a-z]/
const HAS_UPPERCASE = /[A-Z]/
const HAS_SPECIAL = /[^A-Za-z0-9]/

export function validatePassword(password: string): string | null {
  if (password.length < PASSWORD_MIN_LENGTH) {
    return `Password must be at least ${PASSWORD_MIN_LENGTH} characters.`
  }
  if (!HAS_LOWERCASE.test(password)) {
    return 'Password must include at least one lowercase letter.'
  }
  if (!HAS_UPPERCASE.test(password)) {
    return 'Password must include at least one uppercase letter.'
  }
  if (!HAS_SPECIAL.test(password)) {
    return 'Password must include at least one special character (e.g. ! @ # $ %).'
  }
  return null
}

export function validatePasswordPair(
  password: string,
  confirm: string
): string | null {
  const passwordError = validatePassword(password)
  if (passwordError) return passwordError
  if (password !== confirm) return 'Passwords do not match.'
  return null
}
