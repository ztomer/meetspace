import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

import {
  commands as localSttCommands,
  type LocalModel,
} from "@meetspace/plugin-local-stt";

import { useToastAction } from "~/store/zustand/toast-action";

type SttSettingsContextType = {
  accordionValue: string;
  setAccordionValue: (value: string) => void;
  startDownload: (model: LocalModel) => void;
};

const SttSettingsContext = createContext<SttSettingsContextType | null>(null);

export function SttSettingsProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [accordionValue, setAccordionValue] = useState<string>("");

  const toastActionTarget = useToastAction((state) => state.target);
  const clearToastActionTarget = useToastAction((state) => state.clearTarget);

  useEffect(() => {
    if (toastActionTarget === "stt") {
      clearToastActionTarget();
    }
  }, [toastActionTarget, clearToastActionTarget]);

  const startDownload = useCallback((model: LocalModel) => {
    void localSttCommands.downloadModel(model);
  }, []);

  return (
    <SttSettingsContext.Provider
      value={{
        accordionValue,
        setAccordionValue,
        startDownload,
      }}
    >
      {children}
    </SttSettingsContext.Provider>
  );
}

export function useSttSettings() {
  const context = useContext(SttSettingsContext);
  if (!context) {
    throw new Error("useSttSettings must be used within SttSettingsProvider");
  }
  return context;
}
