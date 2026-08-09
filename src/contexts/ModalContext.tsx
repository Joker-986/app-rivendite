import React, { createContext, useContext, useState, ReactNode } from 'react';

// --- TIPI DI STATO PER I MODALI ---
export interface ConfirmModalState {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  isDestructive?: boolean;
}

export interface ShareModalState {
  isOpen: boolean;
  text: string;
}

export interface QuickEditModalState {
  isOpen: boolean;
  editType: 'VISITA' | 'ORDINE' | 'HOSTESS' | 'ORDINE_LOGISTA' | null;
  rivenditaId: string;
  extra: any;
  targetIndex?: number;
}

export interface DualShareModalState {
  isOpen: boolean;
  res: any | null;
  extra: any | null;
  enrichedDetails: any | null;
}

// --- INTERFACCIA DEL CONTESTO ---
interface ModalContextType {
  // Confirm Modal
  confirmModal: ConfirmModalState;
  openConfirm: (options: Omit<ConfirmModalState, 'isOpen'>) => void;
  closeConfirm: () => void;

  // Share Modal
  shareModal: ShareModalState;
  openShare: (text: string) => void;
  closeShare: () => void;

  // Dual Share Modal (Sviluppo Parallelo)
  dualShareModal: DualShareModalState;
  openDualShare: (res: any, extra: any, enrichedDetails?: any) => void;
  closeDualShare: () => void;

  // Quick Edit Modal
  quickEditModal: QuickEditModalState;
  openQuickEdit: (type: 'VISITA' | 'ORDINE' | 'HOSTESS' | 'ORDINE_LOGISTA', id: string, extra: any, index?: number) => void;
  closeQuickEdit: () => void;

  // Revisit Modal
  revisitModalId: string | null;
  openRevisitModal: (id: string) => void;
  closeRevisitModal: () => void;

  // KPI Assign Modal
  isKpiAssignOpen: boolean;
  openKpiAssign: () => void;
  closeKpiAssign: () => void;
  selectedRivenditaId: string | null;
  setSelectedRivenditaId: (id: string | null) => void;
  isSwipeDisabled: boolean;
  setSwipeDisabled: (val: boolean) => void;
}

const ModalContext = createContext<ModalContextType | undefined>(undefined);

// --- PROVIDER ---
export const ModalProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [confirmModal, setConfirmModal] = useState<ConfirmModalState>({
    isOpen: false, title: '', message: '', onConfirm: () => {}
  });

  const [shareModal, setShareModal] = useState<ShareModalState>({
    isOpen: false, text: ''
  });

  const [dualShareModal, setDualShareModal] = useState<DualShareModalState>({
    isOpen: false, res: null, extra: null, enrichedDetails: null
  });

  const [quickEditModal, setQuickEditModal] = useState<QuickEditModalState>({
    isOpen: false, editType: null, rivenditaId: '', extra: {}
  });

  const [revisitModalId, setRevisitModalId] = useState<string | null>(null);
  const [isKpiAssignOpen, setIsKpiAssignOpen] = useState(false);
  const [selectedRivenditaId, setSelectedRivenditaId] = useState<string | null>(null);
  const [isSwipeDisabled, setSwipeDisabled] = useState(false);

  // Funzioni Confirm
  const openConfirm = (options: Omit<ConfirmModalState, 'isOpen'>) => setConfirmModal({ ...options, isOpen: true });
  const closeConfirm = () => setConfirmModal(prev => ({ ...prev, isOpen: false }));

  // Funzioni Share
  const openShare = (text: string) => setShareModal({ isOpen: true, text });
  const closeShare = () => setShareModal(prev => ({ ...prev, isOpen: false }));

  const openDualShare = (res: any, extra: any, enrichedDetails?: any) => 
    setDualShareModal({ isOpen: true, res, extra, enrichedDetails });
  const closeDualShare = () => 
    setDualShareModal(prev => ({ ...prev, isOpen: false }));

  // Funzioni Quick Edit
  const openQuickEdit = (type: 'VISITA' | 'ORDINE' | 'HOSTESS' | 'ORDINE_LOGISTA', id: string, extra: any, index?: number) => {
    setQuickEditModal({ isOpen: true, editType: type, rivenditaId: id, extra, targetIndex: index });
  };
  const closeQuickEdit = () => setQuickEditModal(prev => ({ ...prev, isOpen: false }));

  // Funzioni Revisit
  const openRevisitModal = (id: string) => setRevisitModalId(id);
  const closeRevisitModal = () => setRevisitModalId(null);

  // Funzioni KPI Assign
  const openKpiAssign = () => setIsKpiAssignOpen(true);
  const closeKpiAssign = () => setIsKpiAssignOpen(false);

  return (
    <ModalContext.Provider value={{
      confirmModal, openConfirm, closeConfirm,
      shareModal, openShare, closeShare,
      dualShareModal, openDualShare, closeDualShare,
      quickEditModal, openQuickEdit, closeQuickEdit,
      revisitModalId, openRevisitModal, closeRevisitModal,
      isKpiAssignOpen, openKpiAssign, closeKpiAssign,
      selectedRivenditaId, setSelectedRivenditaId,
      isSwipeDisabled, setSwipeDisabled
    }}>
      {children}
    </ModalContext.Provider>
  );
};

// --- CUSTOM HOOK ---
export const useModals = () => {
  const context = useContext(ModalContext);
  if (context === undefined) {
    throw new Error('useModals deve essere usato all\'interno di un ModalProvider');
  }
  return context;
};
