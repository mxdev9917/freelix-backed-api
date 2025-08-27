exports.validatePassword = (password) => {
  if (!password || password.trim().length === 0) {
    return "invalid";
  }

  const hasLowerCase = /[a-z]/.test(password);
  const hasUpperCase = /[A-Z]/.test(password);
  const hasNum = /[0-9]/.test(password);
  const hasSymbols = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);

  if (password.length < 8) {
    return "too short";
  }

  if (hasLowerCase && hasUpperCase && hasNum && hasSymbols) {
    return "valid"; // Changed from "strong" to "valid" to match registerUser expectation
  } else if (
    (hasLowerCase && hasNum) ||
    (hasLowerCase && hasUpperCase) ||
    (hasLowerCase && hasSymbols)
  ) {
    return "normal";
  } else if (hasLowerCase || hasUpperCase || hasNum || hasSymbols) {
    return "weak";
  }

  return "invalid";
};