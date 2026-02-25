export interface UserProfile {
  userId: string;
  name?: string;
  locationPreference?: string;
  budgetPreference?: string;
}

export async function getUserProfile(userId: string): Promise<UserProfile> {
  return { userId };
}

export async function saveUserProfile(profile: UserProfile): Promise<UserProfile> {
  return profile;
}
