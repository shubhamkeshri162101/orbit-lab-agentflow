const STORAGE_KEY = "orbit-lab-agentflow:user";

// No real auth: this is a self-reported display name, remembered in this
// browser, sent as the X-User header on every request. It only scopes which
// "personal" records show up in list views — anyone who types the same name
// sees the same personal items. Not access control.
export function getCurrentUser(): string {
  return localStorage.getItem(STORAGE_KEY) || "anonymous";
}

export function setCurrentUser(name: string): void {
  localStorage.setItem(STORAGE_KEY, name.trim() || "anonymous");
}
