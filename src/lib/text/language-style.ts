const ARABIC_PATTERN = /[\u0600-\u06FF]/;

/**
 * Detects whether text is primarily Arabic.
 * @param text Input text
 * @returns Language key
 */
export function detectLanguage(text: string): "ar" | "en" {
  return ARABIC_PATTERN.test(text) ? "ar" : "en";
}

/**
 * Returns channel-safe default next-step question.
 * @param language Language key
 * @returns Question string
 */
export function defaultNextStep(language: "ar" | "en"): string {
  if (language === "ar") {
    return "هل تريد أن أكمل بالخطوة التالية؟";
  }
  return "Would you like me to continue with the next step?";
}
