import { createContext, useContext } from "react";

export interface DashboardContextValue {
  csrfToken: string;
}

export const DashboardContext = createContext<DashboardContextValue>({ csrfToken: "" });

export function useDashboardContext(): DashboardContextValue {
  return useContext(DashboardContext);
}
