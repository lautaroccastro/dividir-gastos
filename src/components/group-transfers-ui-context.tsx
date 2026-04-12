"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

type GroupTransfersUiContextValue = {
  transfersViewActive: boolean;
  setTransfersViewActive: (value: boolean) => void;
};

const GroupTransfersUiContext = createContext<GroupTransfersUiContextValue | null>(
  null,
);

export function GroupTransfersUiProvider({
  children,
  initialTransfersSuggestedUi,
}: {
  children: React.ReactNode;
  initialTransfersSuggestedUi: boolean;
}) {
  const [transfersViewActive, setTransfersViewActiveState] = useState(
    initialTransfersSuggestedUi,
  );

  useEffect(() => {
    setTransfersViewActiveState(initialTransfersSuggestedUi);
  }, [initialTransfersSuggestedUi]);

  const setTransfersViewActive = useCallback((value: boolean) => {
    setTransfersViewActiveState(value);
  }, []);

  const value = useMemo(
    () => ({ transfersViewActive, setTransfersViewActive }),
    [transfersViewActive, setTransfersViewActive],
  );

  return (
    <GroupTransfersUiContext.Provider value={value}>
      {children}
    </GroupTransfersUiContext.Provider>
  );
}

export function useGroupTransfersUi(): GroupTransfersUiContextValue {
  const ctx = useContext(GroupTransfersUiContext);
  if (!ctx) {
    throw new Error(
      "useGroupTransfersUi must be used within GroupTransfersUiProvider",
    );
  }
  return ctx;
}
