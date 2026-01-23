import { createContext, useState, useContext, useEffect } from "react";
import type { ReactNode } from "react"; // FIXED: Explicit type import

interface FormStateContextType {
  isDirty: boolean;
  setIsDirty: (dirty: boolean) => void;
}

export const FormStateContext = createContext<FormStateContextType>({} as FormStateContextType);

export const useFormState = () => useContext(FormStateContext);

export const FormStateProvider = ({ children }: { children: ReactNode }) => {
  const [isDirty, setIsDirty] = useState(false);

  // Handle Browser Native "Close Tab" / "Refresh" warning
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        // FIXED: Modern standard uses preventDefault() to trigger the dialog.
        // The deprecated e.returnValue assignment is removed.
        e.preventDefault(); 
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isDirty]);

  return (
    <FormStateContext.Provider value={{ isDirty, setIsDirty }}>
      {children}
    </FormStateContext.Provider>
  );
};