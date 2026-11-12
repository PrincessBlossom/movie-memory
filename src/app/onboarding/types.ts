/** What the onboarding server action returns to the form after a failed submit. */
export type OnboardingState = {
  /** Field error for the movie input, or null. */
  error: string | null;
  /** What the user submitted, so the form can show it again. */
  value: string;
};

/** The server action's signature, as the form receives it through props. */
export type OnboardingAction = (
  prev: OnboardingState,
  formData: FormData,
) => Promise<OnboardingState>;
