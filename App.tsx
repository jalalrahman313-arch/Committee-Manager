import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { dbService } from './services/database';
import type { Committee, Member, Pair, Payment, Draw, AppData, ShareType, PayerType, PaymentStatus } from './types';
import { PlusIcon, UsersIcon, CalendarIcon, DollarSignIcon, TrashIcon, ChevronLeftIcon, SettingsIcon, DownloadIcon, UploadIcon, XIcon, AwardIcon, EditIcon } from './components/Icons';

type View = 'dashboard' | 'committee_detail' | 'backup_restore';

// --- Reusable UI Components ---

const Card: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className }) => (
  <div className={`bg-white/70 dark:bg-slate-800/70 backdrop-blur-sm border border-slate-200 dark:border-slate-700 shadow-lg rounded-lg p-4 sm:p-6 transition-all duration-300 ${className}`}>
    {children}
  </div>
);

const Button: React.FC<{ onClick: (e?: React.MouseEvent) => void; children: React.ReactNode; variant?: 'primary' | 'secondary' | 'danger'; className?: string, type?: 'button' | 'submit' | 'reset', disabled?: boolean }> = ({ onClick, children, variant = 'primary', className, type = 'button', disabled = false }) => {
  const baseClasses = 'inline-flex items-center justify-center gap-2 px-4 py-2 rounded-md font-semibold focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-slate-900 transition-all duration-200 shadow-md hover:shadow-lg hover:-translate-y-0.5 active:shadow-sm active:translate-y-px disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-md disabled:translate-y-0';
  const variantClasses = {
    primary: 'bg-primary-600 text-white hover:bg-primary-500 focus:ring-primary-500',
    secondary: 'bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 hover:bg-slate-300 dark:hover:bg-slate-600 focus:ring-slate-500',
    danger: 'bg-red-600 text-white hover:bg-red-500 focus:ring-red-500',
  };
  return (
    <button onClick={onClick} type={type} className={`${baseClasses} ${variantClasses[variant]} ${className}`} disabled={disabled}>
      {children}
    </button>
  );
};

const Modal: React.FC<{ isOpen: boolean; onClose: () => void; title: string; children: React.ReactNode }> = ({ isOpen, onClose, title, children }) => {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setShow(true);
    } else {
      // Delay closing for animation
      const timer = setTimeout(() => setShow(false), 200);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  if (!show && !isOpen) return null;

  return (
    <div className={`fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 transition-opacity duration-200 backdrop-blur-sm ${isOpen ? 'opacity-100' : 'opacity-0'}`} onClick={onClose}>
      <div
        className={`bg-slate-100 dark:bg-slate-800 rounded-lg shadow-xl w-full max-w-md max-h-[90vh] flex flex-col transition-transform duration-200 ${isOpen ? 'scale-100' : 'scale-95'}`}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex justify-between items-center p-4 border-b border-slate-200 dark:border-slate-700">
          <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">{title}</h2>
          <button onClick={onClose} className="text-slate-500 hover:text-primary-500 dark:hover:text-primary-400 p-1 rounded-full transition-colors">
            <XIcon />
          </button>
        </div>
        <div className="p-6 overflow-y-auto">
          {children}
        </div>
      </div>
    </div>
  );
};

const ConfirmationModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: React.ReactNode;
  confirmationText?: string;
}> = ({ isOpen, onClose, onConfirm, title, message, confirmationText }) => {
    const [inputValue, setInputValue] = useState('');

    useEffect(() => {
        if (isOpen) {
            setInputValue('');
        }
    }, [isOpen]);
    
    const isConfirmationRequired = !!confirmationText;
    const isConfirmed = !isConfirmationRequired || inputValue === confirmationText;

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={title}>
            <div className="space-y-6">
                <div className="text-slate-600 dark:text-slate-300 space-y-2">{message}</div>
                {isConfirmationRequired && (
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                            Please type <strong className="text-slate-900 dark:text-slate-100">{confirmationText}</strong> to confirm.
                        </label>
                        <input
                            type="text"
                            value={inputValue}
                            onChange={(e) => setInputValue(e.target.value)}
                            className="mt-1 block w-full bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                            aria-label={`Confirm by typing ${confirmationText}`}
                            autoComplete="off"
                        />
                    </div>
                )}
                <div className="flex justify-end gap-2">
                    <Button onClick={onClose} variant="secondary">
                        Cancel
                    </Button>
                    <Button onClick={onConfirm} variant="danger" disabled={!isConfirmed}>
                        Confirm Delete
                    </Button>
                </div>
            </div>
        </Modal>
    );
};

const Header: React.FC<{
  title: string;
  onBack?: () => void;
  children?: React.ReactNode;
}> = ({ title, onBack, children }) => (
  <header className="p-4 sm:p-6">
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-4">
        {onBack && (
          <button onClick={onBack} className="text-slate-500 hover:text-primary-500 dark:hover:text-primary-400 p-2 rounded-full bg-white/60 dark:bg-slate-800/60 transition-colors shadow-sm hover:shadow-md">
            <ChevronLeftIcon />
          </button>
        )}
        <h1 className="text-3xl font-bold text-slate-800 dark:text-slate-100">{title}</h1>
      </div>
      <div className="flex items-center gap-2">
        {children}
      </div>
    </div>
  </header>
);

// --- App Logic Components ---

const CommitteeForm: React.FC<{ onClose: () => void; onSave: () => void; committeeToEdit?: Committee | null }> = ({ onClose, onSave, committeeToEdit }) => {
  const [name, setName] = useState('');
  const [contribution, setContribution] = useState(1000);
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [allowHalfShare, setAllowHalfShare] = useState(false);

  useEffect(() => {
    if (committeeToEdit) {
      setName(committeeToEdit.name);
      setContribution(committeeToEdit.contribution);
      setStartDate(committeeToEdit.startDate);
      setAllowHalfShare(committeeToEdit.allowHalfShare);
    } else {
      // Reset form for new committee
      setName('');
      setContribution(1000);
      setStartDate(new Date().toISOString().split('T')[0]);
      setAllowHalfShare(false);
    }
  }, [committeeToEdit]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || contribution <= 0) {
      alert('Please fill all fields with valid values.');
      return;
    }

    if (committeeToEdit) {
      const updatedCommittee: Committee = { ...committeeToEdit, name, contribution, startDate, allowHalfShare };
      await dbService.updateCommittee(updatedCommittee);
    } else {
      const newCommittee: Committee = { name, contribution, startDate, allowHalfShare };
      await dbService.addCommittee(newCommittee);
    }

    onSave();
    onClose();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Committee Name</label>
        <input type="text" value={name} onChange={(e) => setName(e.target.value)} required className="mt-1 block w-full bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Contribution</label>
          <input type="number" value={contribution} onChange={(e) => setContribution(parseInt(e.target.value))} required min="1" className="mt-1 block w-full bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Start Date</label>
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required className="mt-1 block w-full bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm" />
        </div>
      </div>
      <div className="flex items-center">
        <input id="allowHalfShare" type="checkbox" checked={allowHalfShare} onChange={(e) => setAllowHalfShare(e.target.checked)} disabled={!!committeeToEdit} className="h-4 w-4 text-primary-600 border-slate-300 rounded focus:ring-primary-500 disabled:opacity-50" />
        <label htmlFor="allowHalfShare" className="ml-2 block text-sm text-slate-900 dark:text-slate-200">
          Allow Half-Share Members
          {!!committeeToEdit && <span className="text-xs italic text-slate-500 ml-1">(Cannot be changed after creation)</span>}
        </label>
      </div>
      <div className="flex justify-end gap-2 pt-4">
        <Button onClick={onClose} variant="secondary">Cancel</Button>
        <Button onClick={() => {}} type="submit">Save Committee</Button>
      </div>
    </form>
  );
};

const Dashboard: React.FC<{ onSelectCommittee: (id: number) => void; onShowBackup: () => void }> = ({ onSelectCommittee, onShowBackup }) => {
  const [committees, setCommittees] = useState<Committee[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [pairs, setPairs] = useState<Pair[]>([]);
  const [draws, setDraws] = useState<Draw[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [committeeToEdit, setCommitteeToEdit] = useState<Committee | null>(null);
  const [committeeToDelete, setCommitteeToDelete] = useState<Committee | null>(null);

  const fetchData = useCallback(async () => {
    const committeesData = await dbService.getCommittees();
    const allMembers = await dbService.getMembers();
    const allPairs = await dbService.getPairs();
    const allDraws = await dbService.getDraws();
    setCommittees(committeesData);
    setMembers(allMembers);
    setPairs(allPairs);
    setDraws(allDraws);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const confirmDeleteCommittee = async () => {
    if (!committeeToDelete || !committeeToDelete.id) return;
    try {
      await dbService.deleteCommittee(committeeToDelete.id);
      fetchData();
      setCommitteeToDelete(null); // Close modal on success
    } catch (error) {
      console.error("Failed to delete committee:", error);
      alert("An error occurred while deleting the committee.");
      setCommitteeToDelete(null);
    }
  };
  
  const openCreateModal = () => {
    setCommitteeToEdit(null);
    setIsModalOpen(true);
  };

  const openEditModal = (committee: Committee) => {
    setCommitteeToEdit(committee);
    setIsModalOpen(true);
  };
  
  const closeFormModal = () => {
      setIsModalOpen(false);
      setCommitteeToEdit(null);
  };

  return (
    <div className="space-y-6">
      <Header title="Dashboard">
        <Button onClick={onShowBackup} variant='secondary'>
            <SettingsIcon className="w-5 h-5" />
            <span className="hidden sm:inline">Backup</span>
        </Button>
        <Button onClick={openCreateModal}>
            <PlusIcon className="w-5 h-5" />
            <span className="hidden sm:inline">New Committee</span>
        </Button>
      </Header>
      
      <main className="px-4 sm:px-6">
        {committees.length === 0 ? (
          <Card className="text-center py-16">
            <h3 className="text-xl font-semibold">Welcome to Committee Manager</h3>
            <p className="text-slate-500 dark:text-slate-400 mt-2">No committees found. Get started by creating a new one.</p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {committees.map(c => {
              const committeeFullMembersCount = members.filter(m => m.committeeId === c.id && m.shareType === 'Full').length;
              const committeePairsCount = pairs.filter(p => p.committeeId === c.id).length;
              const duration = committeeFullMembersCount + committeePairsCount;
              const drawAmount = c.contribution * duration;
              const committeeDraws = draws.filter(d => d.committeeId === c.id);
              const progress = duration > 0 ? (committeeDraws.length / duration) * 100 : 0;

              return (
                <div key={c.id} className="bg-white/70 dark:bg-slate-800/70 backdrop-blur-sm border border-slate-200 dark:border-slate-700 shadow-lg rounded-lg flex flex-col justify-between hover:shadow-xl transition-all duration-300 hover:-translate-y-1 border-t-4 border-primary-500">
                  <div onClick={() => c.id && onSelectCommittee(c.id)} className="cursor-pointer flex-grow p-4 sm:p-6">
                    <h2 className="text-xl font-bold text-primary-700 dark:text-primary-400">{c.name}</h2>
                    <div className="mt-4 space-y-3 text-sm text-slate-600 dark:text-slate-300">
                      <div className="flex items-center gap-3"><DollarSignIcon className="w-5 h-5 text-slate-400" /> <span>Contribution: <span className="font-semibold">{c.contribution.toLocaleString()}</span></span></div>
                      <div className="flex items-center gap-3"><AwardIcon className="w-5 h-5 text-slate-400" /> <span>Draw Amount: <span className="font-semibold">{drawAmount.toLocaleString()}</span></span></div>
                      <div className="flex items-center gap-3"><CalendarIcon className="w-5 h-5 text-slate-400" /> <span>Duration: <span className="font-semibold">{duration} months</span></span></div>
                      <div className="flex items-center gap-3"><UsersIcon className="w-5 h-5 text-slate-400" /> <span>Shares: <span className="font-semibold">{c.allowHalfShare ? 'Full & Half' : 'Full Only'}</span></span></div>
                    </div>
                     <div className="mt-6">
                        <div className="flex justify-between items-center text-sm mb-1 text-slate-600 dark:text-slate-400">
                            <span className="font-medium">Progress</span>
                            <span className="font-semibold">{committeeDraws.length} / {duration}</span>
                        </div>
                        <div className="w-full bg-slate-200 dark:bg-slate-600 rounded-full h-2 overflow-hidden">
                            <div 
                                className="bg-primary-500 h-2 rounded-full transition-all duration-500 ease-out" 
                                style={{ width: `${progress}%` }}
                            ></div>
                        </div>
                    </div>
                  </div>
                   <div className="p-2 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-700 flex justify-end gap-2 rounded-b-md">
                        <button onClick={(e) => { e.stopPropagation(); openEditModal(c); }} className="text-slate-500 hover:text-primary-500 p-2 rounded-full hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors">
                            <EditIcon className="w-5 h-5" />
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); setCommitteeToDelete(c); }} className="text-red-500 hover:text-red-700 p-2 rounded-full hover:bg-red-100 dark:hover:bg-red-900/50 transition-colors">
                            <TrashIcon className="w-5 h-5" />
                        </button>
                    </div>
                </div>
              )
            })}
          </div>
        )}
      </main>
      <Modal isOpen={isModalOpen} onClose={closeFormModal} title={committeeToEdit ? "Edit Committee" : "Create New Committee"}>
        <CommitteeForm onClose={closeFormModal} onSave={fetchData} committeeToEdit={committeeToEdit}/>
      </Modal>
      <ConfirmationModal
        isOpen={!!committeeToDelete}
        onClose={() => setCommitteeToDelete(null)}
        onConfirm={confirmDeleteCommittee}
        title="Confirm Deletion"
        message={
            committeeToDelete ? (
              <>
                <p>
                  Are you sure you want to delete the committee "{committeeToDelete.name}"?
                </p>
                <p className="font-semibold text-red-600 dark:text-red-400">
                  This will permanently delete the committee and all of its associated members, payments, and draws. This action cannot be undone.
                </p>
              </>
            ) : null
        }
        confirmationText={committeeToDelete?.name}
      />
    </div>
  );
};

const MemberForm: React.FC<{ committee: Committee; onClose: () => void; onSave: () => void; allMembers: Member[]; }> = ({ committee, onClose, onSave, allMembers }) => {
    const [name, setName] = useState('');
    const [phone, setPhone] = useState('');
    const [shareType, setShareType] = useState<ShareType>('Full');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name || !committee.id) return;
        
        const newMember: Omit<Member, 'id'> = { name, phone, shareType, committeeId: committee.id };

        if (shareType === 'Half') {
            const unpairedHalfMember = allMembers.find(m => m.shareType === 'Half' && !m.pairId);
            const createdMemberId = await dbService.addMember(newMember as Member);

            if (unpairedHalfMember && unpairedHalfMember.id) {
                const pairName = `${unpairedHalfMember.name} & ${name}`;
                const newPair: Omit<Pair, 'id'> = { committeeId: committee.id, member1Id: unpairedHalfMember.id, member2Id: createdMemberId, name: pairName };
                const newPairId = await dbService.addPair(newPair as Pair);
                
                await dbService.updateMember({ ...unpairedHalfMember, pairId: newPairId });
                const justAddedMember = { ...(newMember as Member), id: createdMemberId };
                await dbService.updateMember({ ...justAddedMember, pairId: newPairId });
            }
        } else {
             await dbService.addMember(newMember as Member);
        }
        
        onSave();
        onClose();
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
             <div>
                <label className="block text-sm font-medium">Full Name</label>
                <input type="text" value={name} onChange={e => setName(e.target.value)} required className="mt-1 block w-full bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm" />
            </div>
             <div>
                <label className="block text-sm font-medium">Contact Number</label>
                <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} className="mt-1 block w-full bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm" />
            </div>
            {committee.allowHalfShare && (
                <div>
                    <label className="block text-sm font-medium">Share Type</label>
                    <select value={shareType} onChange={e => setShareType(e.target.value as ShareType)} className="mt-1 block w-full bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm">
                        <option value="Full">Full Share</option>
                        <option value="Half">Half Share</option>
                    </select>
                </div>
            )}
            <div className="flex justify-end gap-2 pt-4">
                <Button onClick={onClose} variant="secondary">Cancel</Button>
                <Button onClick={() => {}} type="submit">Add Member</Button>
            </div>
        </form>
    )
};

const MemberEditForm: React.FC<{ member: Member; onClose: () => void; onSave: () => void; }> = ({ member, onClose, onSave }) => {
    const [name, setName] = useState(member.name);
    const [phone, setPhone] = useState(member.phone);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name) return;
        
        await dbService.updateMember({ ...member, name, phone });
        
        onSave();
        onClose();
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
             <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Full Name</label>
                <input type="text" value={name} onChange={e => setName(e.target.value)} required className="mt-1 block w-full bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm" />
            </div>
             <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Contact Number</label>
                <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} className="mt-1 block w-full bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm" />
            </div>
            <div className="flex justify-end gap-2 pt-4">
                <Button onClick={onClose} variant="secondary">Cancel</Button>
                <Button onClick={() => {}} type="submit">Save Changes</Button>
            </div>
        </form>
    )
};

const PairEditForm: React.FC<{ pair: Pair; members: Member[]; onClose: () => void; onSave: () => void; }> = ({ pair, members, onClose, onSave }) => {
    const member1 = useMemo(() => members.find(m => m.id === pair.member1Id), [members, pair.member1Id]);
    const member2 = useMemo(() => members.find(m => m.id === pair.member2Id), [members, pair.member2Id]);

    const [member1Name, setMember1Name] = useState(member1?.name || '');
    const [member1Phone, setMember1Phone] = useState(member1?.phone || '');
    const [member2Name, setMember2Name] = useState(member2?.name || '');
    const [member2Phone, setMember2Phone] = useState(member2?.phone || '');

    if (!member1 || !member2) return <div className="p-4 text-center text-red-500">Error: Could not find members for this pair.</div>;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        const updatedMember1 = { ...member1, name: member1Name, phone: member1Phone };
        const updatedMember2 = { ...member2, name: member2Name, phone: member2Phone };
        const updatedPair = { ...pair, name: `${member1Name} & ${member2Name}`};

        await Promise.all([
            dbService.updateMember(updatedMember1),
            dbService.updateMember(updatedMember2),
            dbService.updatePair(updatedPair)
        ]);
        
        onSave();
        onClose();
    };
    
    return (
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="p-4 border rounded-md dark:border-slate-600">
          <h4 className="font-semibold mb-2 text-slate-800 dark:text-slate-200">Partner 1</h4>
          <div className="space-y-2">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Full Name</label>
              <input type="text" value={member1Name} onChange={e => setMember1Name(e.target.value)} required className="mt-1 block w-full bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Contact Number</label>
              <input type="tel" value={member1Phone} onChange={e => setMember1Phone(e.target.value)} className="mt-1 block w-full bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm" />
            </div>
          </div>
        </div>
        <div className="p-4 border rounded-md dark:border-slate-600">
          <h4 className="font-semibold mb-2 text-slate-800 dark:text-slate-200">Partner 2</h4>
           <div className="space-y-2">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Full Name</label>
              <input type="text" value={member2Name} onChange={e => setMember2Name(e.target.value)} required className="mt-1 block w-full bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Contact Number</label>
              <input type="tel" value={member2Phone} onChange={e => setMember2Phone(e.target.value)} className="mt-1 block w-full bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm" />
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-4">
          <Button onClick={onClose} variant="secondary">Cancel</Button>
          <Button onClick={() => {}} type="submit">Save Changes</Button>
        </div>
      </form>
    );
};

const PaymentModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    onSave: (paymentDate: string) => void;
    shareholderName: string;
    monthName: string;
    existingPayment?: Payment;
}> = ({ isOpen, onClose, onSave, shareholderName, monthName, existingPayment }) => {
    const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);

    useEffect(() => {
        if (isOpen) {
            setPaymentDate(existingPayment?.paidOn || new Date().toISOString().split('T')[0]);
        }
    }, [isOpen, existingPayment]);

    if (!isOpen) return null;

    const handleSubmit = () => {
        onSave(paymentDate);
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`Payment for ${monthName}`}>
            <div className="space-y-4">
                <p>Recording payment for <strong>{shareholderName}</strong>.</p>
                <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Payment Date</label>
                    <input
                        type="date"
                        value={paymentDate}
                        onChange={(e) => setPaymentDate(e.target.value)}
                        required
                        className="mt-1 block w-full bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                    />
                </div>
                <div className="flex justify-end gap-2 pt-4">
                    <Button onClick={onClose} variant="secondary">Cancel</Button>
                    <Button onClick={handleSubmit}>Save Payment</Button>
                </div>
            </div>
        </Modal>
    );
};


const PaymentTracker: React.FC<{ committee: Committee; members: Member[]; pairs: Pair[]; payments: Payment[]; onUpdate: () => void; duration: number }> = ({ committee, members, pairs, payments, onUpdate, duration }) => {
    const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
    const [selectedPaymentInfo, setSelectedPaymentInfo] = useState<{ 
        shareholderId: number; 
        shareholderType: PayerType; 
        name: string; 
        month: number;
        payment?: Payment;
    } | null>(null);

    const shareholders = useMemo(() => {
        const fullMembers = members.filter(m => m.shareType === 'Full').map(m => ({ id: m.id!, type: 'member' as PayerType, name: m.name }));
        const paired = pairs.map(p => ({ id: p.id!, type: 'pair' as PayerType, name: p.name }));
        return [...fullMembers, ...paired].sort((a, b) => a.name.localeCompare(b.name));
    }, [members, pairs]);

    const getMonthHeaders = useCallback(() => {
        const headers: { name: string; monthIndex: number }[] = [];
        const startDate = new Date(committee.startDate);
        for (let i = 0; i < duration; i++) {
            const monthDate = new Date(startDate.getFullYear(), startDate.getMonth() + i, 1);
            const monthName = monthDate.toLocaleString('default', { month: 'short' });
            const year = monthDate.getFullYear();
            headers.push({ name: `${monthName} ${year}`, monthIndex: i });
        }
        return headers;
    }, [committee.startDate, duration]);

    const monthHeaders = useMemo(getMonthHeaders, [getMonthHeaders]);

    const getPaymentForCell = (shareholderId: number, shareholderType: PayerType, month: number): Payment | undefined => {
        return payments.find(p => p.payerId === shareholderId && p.payerType === shareholderType && p.month === month);
    };

    const handleOpenPaymentModal = (shareholderId: number, shareholderType: PayerType, name: string, month: number, payment?: Payment) => {
        setSelectedPaymentInfo({ shareholderId, shareholderType, name, month, payment });
        setIsPaymentModalOpen(true);
    };

    const handleSavePayment = async (paidOnDate: string) => {
        if (!selectedPaymentInfo) return;

        const { shareholderId, shareholderType, month, payment } = selectedPaymentInfo;
        
        const [pYear, pMonth, pDay] = paidOnDate.split('-').map(Number);
        const paymentDate = new Date(pYear, pMonth - 1, pDay);
        
        const committeeStartDate = new Date(committee.startDate);
        const dueDate = new Date(committeeStartDate.getFullYear(), committeeStartDate.getMonth() + month, 10);
        
        const status: PaymentStatus = paymentDate > dueDate ? 'Late' : 'Paid';
        
        if(payment && payment.id){
            const updatedPayment: Payment = { ...payment, status, paidOn: paidOnDate };
            await dbService.updatePayment(updatedPayment);
        } else {
             const newPayment: Omit<Payment, 'id'> = {
                committeeId: committee.id!,
                payerId: shareholderId,
                payerType: shareholderType,
                month,
                status,
                paidOn: paidOnDate
            };
            await dbService.addPayment(newPayment as Payment);
        }
        
        onUpdate();
        setIsPaymentModalOpen(false);
        setSelectedPaymentInfo(null);
    };

    const getStatusClasses = (status?: PaymentStatus) => {
        const base = 'w-8 h-8 rounded-full text-xs font-bold transition-all duration-200 hover:-translate-y-0.5 active:translate-y-px';
        switch (status) {
            case 'Paid': return `${base} bg-green-500 text-white shadow-md hover:bg-green-400 active:shadow-inner`;
            case 'Late': return `${base} bg-yellow-500 text-white shadow-md hover:bg-yellow-400 active:shadow-inner`;
            case 'Pending':
            default: return `${base} bg-slate-200 dark:bg-slate-700 text-slate-400 shadow-inner hover:bg-slate-300 dark:hover:bg-slate-600`;
        }
    }

    return (
        <>
            <Card>
                <h3 className="text-lg font-bold mb-4">Payment Tracker</h3>
                <div className="overflow-x-auto border border-slate-200 dark:border-slate-700 rounded-lg">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-slate-100 dark:bg-slate-700/50">
                            <tr>
                                <th className="p-3 sticky left-0 bg-slate-100 dark:bg-slate-700/50 z-10 border-b border-slate-200 dark:border-slate-600">Member/Pair</th>
                                {monthHeaders.map(h => <th key={h.monthIndex} className="p-3 text-center whitespace-nowrap border-b border-slate-200 dark:border-slate-600">{h.name}</th>)}
                            </tr>
                        </thead>
                        <tbody>
                            {shareholders.map(sh => (
                                <tr key={`${sh.type}-${sh.id}`} className="even:bg-slate-50 dark:even:bg-slate-800/50">
                                    <td className="p-3 font-medium sticky left-0 z-10 bg-inherit">{sh.name}</td>
                                    {monthHeaders.map(({ monthIndex }) => {
                                        const payment = getPaymentForCell(sh.id, sh.type, monthIndex);
                                        return (
                                            <td key={monthIndex} className="p-2 text-center">
                                                <button
                                                    onClick={() => handleOpenPaymentModal(sh.id, sh.type, sh.name, monthIndex, payment)}
                                                    className={getStatusClasses(payment?.status)}
                                                    title={payment ? `Edit: ${payment.status} on ${payment.paidOn}` : `Record payment for ${monthHeaders.find(h => h.monthIndex === monthIndex)?.name}`}
                                                >
                                                    {payment ? (payment.status === 'Paid' ? '✓' : '!') : '○'}
                                                </button>
                                            </td>
                                        );
                                    })}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </Card>
            <PaymentModal
                isOpen={isPaymentModalOpen}
                onClose={() => setIsPaymentModalOpen(false)}
                onSave={handleSavePayment}
                shareholderName={selectedPaymentInfo?.name || ''}
                monthName={selectedPaymentInfo ? monthHeaders.find(h => h.monthIndex === selectedPaymentInfo.month)?.name || '' : ''}
                existingPayment={selectedPaymentInfo?.payment}
            />
        </>
    );
};

const DrawWinnerSelectionModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (winner: { id: number; type: PayerType; }) => void;
    eligible: { id: number; type: PayerType; name: string; }[];
    monthName: string;
    currentWinner?: { id: number; type: PayerType; };
}> = ({ isOpen, onClose, onConfirm, eligible, monthName, currentWinner }) => {
    const [selected, setSelected] = useState(''); // e.g. "member-1"

    useEffect(() => {
        if (isOpen) {
            if (currentWinner) {
                setSelected(`${currentWinner.type}-${currentWinner.id}`);
            } else {
                setSelected(''); // Reset on open for new draw
            }
        }
    }, [isOpen, currentWinner]);

    if (!isOpen) return null;

    const handleConfirm = () => {
        if (!selected) return;
        const [type, idStr] = selected.split('-');
        onConfirm({ id: parseInt(idStr), type: type as PayerType });
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`Select Winner for ${monthName}`}>
            <div className="space-y-4">
                <p>Choose the winner from the list of eligible members/pairs.</p>
                <div className="max-h-60 overflow-y-auto space-y-2 pr-2">
                    {eligible.map(sh => (
                        <label key={`${sh.type}-${sh.id}`} className="flex items-center p-3 rounded-md bg-slate-200 dark:bg-slate-700 cursor-pointer hover:bg-slate-300 dark:hover:bg-slate-600 has-[:checked]:bg-primary-100 dark:has-[:checked]:bg-primary-900/50 has-[:checked]:ring-2 has-[:checked]:ring-primary-500 transition-all">
                            <input type="radio" name="winner" value={`${sh.type}-${sh.id}`} checked={selected === `${sh.type}-${sh.id}`} onChange={e => setSelected(e.target.value)} className="w-4 h-4 text-primary-600 border-gray-300 focus:ring-primary-500" />
                            <span className="ml-3 font-medium">{sh.name}</span>
                        </label>
                    ))}
                </div>
                {eligible.length === 0 && <p className="text-center text-slate-500">No eligible members to select.</p>}
                <div className="flex justify-end gap-2 pt-4">
                    <Button onClick={onClose} variant="secondary">Cancel</Button>
                    <Button onClick={handleConfirm} disabled={!selected}>Confirm Winner</Button>
                </div>
            </div>
        </Modal>
    );
};


const DrawManager: React.FC<{ committee: Committee; members: Member[]; pairs: Pair[]; payments: Payment[]; draws: Draw[]; onUpdate: () => void; duration: number }> = ({ committee, members, pairs, payments, draws, onUpdate, duration }) => {
    const [isDrawModalOpen, setIsDrawModalOpen] = useState(false);
    const [selectedMonth, setSelectedMonth] = useState<number | null>(null);
    const [editingDraw, setEditingDraw] = useState<Draw | null>(null);
    
    const shareholders = useMemo(() => {
        const fullMembers = members.filter(m => m.shareType === 'Full').map(m => ({ id: m.id!, type: 'member' as PayerType, name: m.name }));
        const paired = pairs.map(p => ({ id: p.id!, type: 'pair' as PayerType, name: p.name }));
        return [...fullMembers, ...paired];
    }, [members, pairs]);
    
    const getMonthHeaders = useCallback(() => {
        const headers: { name: string; monthIndex: number }[] = [];
        const startDate = new Date(committee.startDate);
        for (let i = 0; i < duration; i++) {
            const monthDate = new Date(startDate.getFullYear(), startDate.getMonth() + i, 1);
            const monthName = monthDate.toLocaleString('default', { month: 'long' });
            const year = monthDate.getFullYear();
            headers.push({ name: `${monthName} ${year}`, monthIndex: i });
        }
        return headers;
    }, [committee.startDate, duration]);

    const monthHeaders = useMemo(getMonthHeaders, [getMonthHeaders]);
    
    const eligibleForDraw = useMemo(() => {
        if (selectedMonth === null) return [];
        // When editing, the current winner of the month should also be in the eligible list.
        const otherMonthsWinners = draws
            .filter(d => d.month !== selectedMonth)
            .map(d => `${d.winnerType}-${d.winnerId}`);
        
        return shareholders.filter(sh => !otherMonthsWinners.includes(`${sh.type}-${sh.id}`));
    }, [draws, shareholders, selectedMonth]);

    const canConductDraw = (month: number): boolean => {
        const totalShareholders = shareholders.length;
        if(totalShareholders === 0) return false;
        const paymentsForMonth = payments.filter(p => p.month === month && (p.status === 'Paid' || p.status === 'Late')).length;
        const hasDraw = draws.some(d => d.month === month);
        return paymentsForMonth === totalShareholders && !hasDraw;
    };
    
    const openDrawModal = (month: number) => {
        const draw = draws.find(d => d.month === month);
        setEditingDraw(draw || null);
        setSelectedMonth(month);
        setIsDrawModalOpen(true);
    };
    
    const handleConfirmWinner = async (winner: { id: number, type: PayerType }) => {
        if (selectedMonth === null) return;

        if (editingDraw) {
            const updatedDraw: Draw = { ...editingDraw, winnerId: winner.id, winnerType: winner.type };
            await dbService.updateDraw(updatedDraw);
        } else {
            const newDraw: Omit<Draw, 'id'> = {
                committeeId: committee.id!,
                month: selectedMonth,
                winnerId: winner.id,
                winnerType: winner.type,
                drawDate: new Date().toISOString().split('T')[0]
            };
            await dbService.addDraw(newDraw as Draw);
        }
        
        onUpdate();
        setIsDrawModalOpen(false);
        setSelectedMonth(null);
        setEditingDraw(null);
    };
    
    const getWinnerName = (draw: Draw) => {
        return shareholders.find(sh => sh.id === draw.winnerId && sh.type === draw.winnerType)?.name || 'Unknown';
    }

    return (
        <>
            <Card>
                <h3 className="text-lg font-bold mb-4">Draws</h3>
                <div className="space-y-4">
                    {monthHeaders.map(({name, monthIndex: month}) => {
                        const drawForMonth = draws.find(d => d.month === month);
                        return (
                            <div key={month} className="flex items-center justify-between p-3 bg-slate-100 dark:bg-slate-700/50 rounded-lg">
                                <div className="font-semibold">{name}</div>
                                <div>
                                    {drawForMonth ? (
                                        <div className="flex items-center gap-2">
                                            <div className="flex items-center gap-2 text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/50 px-3 py-1 rounded-full">
                                                <AwardIcon className="w-5 h-5"/>
                                                <span className="font-semibold">{getWinnerName(drawForMonth)}</span>
                                            </div>
                                            <button onClick={() => openDrawModal(month)} className="text-slate-500 hover:text-primary-500 p-2 rounded-full hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors ml-4">
                                                <EditIcon className="w-4 h-4"/>
                                            </button>
                                        </div>
                                    ) : (
                                        <Button onClick={() => openDrawModal(month)} disabled={!canConductDraw(month)}>
                                            Conduct Draw
                                        </Button>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </Card>
            <DrawWinnerSelectionModal
                isOpen={isDrawModalOpen}
                onClose={() => setIsDrawModalOpen(false)}
                onConfirm={handleConfirmWinner}
                eligible={eligibleForDraw}
                monthName={selectedMonth !== null ? monthHeaders.find(h => h.monthIndex === selectedMonth)?.name || '' : ''}
                currentWinner={editingDraw ? { id: editingDraw.winnerId, type: editingDraw.winnerType } : undefined}
            />
        </>
    );
};


const CommitteeDetail: React.FC<{ committeeId: number; onBack: () => void }> = ({ committeeId, onBack }) => {
    const [committee, setCommittee] = useState<Committee | null>(null);
    const [members, setMembers] = useState<Member[]>([]);
    const [pairs, setPairs] = useState<Pair[]>([]);
    const [payments, setPayments] = useState<Payment[]>([]);
    const [draws, setDraws] = useState<Draw[]>([]);
    const [isMemberModalOpen, setIsMemberModalOpen] = useState(false);
    const [memberToEdit, setMemberToEdit] = useState<Member | null>(null);
    const [pairToEdit, setPairToEdit] = useState<Pair | null>(null);
    const [memberToDelete, setMemberToDelete] = useState<Member | null>(null);
    const [pairToDelete, setPairToDelete] = useState<Pair | null>(null);
    const [activeTab, setActiveTab] = useState('members');

    const fetchData = useCallback(async () => {
        const committees = await dbService.getCommittees();
        const comm = committees.find(c => c.id === committeeId) || null;
        setCommittee(comm);
        if (comm) {
            setMembers(await dbService.getMembersByCommittee(committeeId));
            setPairs(await dbService.getPairsByCommittee(committeeId));
            setPayments(await dbService.getPaymentsByCommittee(committeeId));
            setDraws(await dbService.getDrawsByCommittee(committeeId));
        }
    }, [committeeId]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const effectiveDuration = useMemo(() => {
        if (!members || !pairs) return 0;
        const fullMembersCount = members.filter(m => m.shareType === 'Full').length;
        const pairsCount = pairs.length;
        return fullMembersCount + pairsCount;
    }, [members, pairs]);

    if (!committee) {
        return <div className="p-6">Loading committee details...</div>;
    }

    const confirmDeleteMember = async () => {
      if (!memberToDelete || !memberToDelete.id) return;
      try {
        await dbService.deleteMember(memberToDelete.id);
        fetchData();
        setMemberToDelete(null);
      } catch (error: any) {
        console.error("Failed to delete member:", error);
        alert(`Error: ${error.message}`);
        setMemberToDelete(null);
      }
    };
    
    const confirmDeletePair = async () => {
      if (!pairToDelete || !pairToDelete.id) return;
      try {
        await dbService.deletePair(pairToDelete.id);
        fetchData();
        setPairToDelete(null);
      } catch (error: any) {
        console.error("Failed to delete pair:", error);
        alert(`Error: ${error.message || 'Failed to delete pair.'}`);
        setPairToDelete(null);
      }
    };

    const individualMembers = members.filter(m => m.shareType === 'Full' || !m.pairId);
    const unpairedHalfMember = members.find(m => m.shareType === 'Half' && !m.pairId);
    
    const TabButton: React.FC<{tabName: string; label: string}> = ({tabName, label}) => (
      <button
        onClick={() => setActiveTab(tabName)}
        className={`px-3 py-2 font-semibold rounded-md transition-all text-sm sm:text-base w-full ${activeTab === tabName ? 'bg-white dark:bg-slate-700 text-primary-600 dark:text-primary-300 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}
      >
        {label}
      </button>
    )

    return (
        <div className="space-y-6">
            <Header title={committee.name} onBack={onBack}/>

            <main className="px-4 sm:px-6 space-y-6">
                <div className="p-1 bg-slate-200 dark:bg-slate-900/80 rounded-lg grid grid-cols-3 gap-1 border dark:border-slate-700 shadow-inner">
                    <TabButton tabName="members" label="Members" />
                    <TabButton tabName="payments" label="Payments" />
                    <TabButton tabName="draws" label="Draws" />
                </div>
                
                <div>
                    {activeTab === 'members' && (
                        <Card>
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="text-lg font-bold">Members & Pairs</h3>
                                 <Button onClick={() => setIsMemberModalOpen(true)}>
                                    <PlusIcon className="w-5 h-5"/> Add Member
                                 </Button>
                            </div>
                            {unpairedHalfMember && (
                                <div className="p-3 mb-4 bg-yellow-100 dark:bg-yellow-900/50 border border-yellow-300 dark:border-yellow-700 rounded-md text-sm text-yellow-800 dark:text-yellow-200">
                                    <strong>{unpairedHalfMember.name}</strong> is a half-share member waiting for a partner.
                                </div>
                            )}
                            <div className="space-y-3">
                                {individualMembers.map(m => (
                                    <div key={m.id} className="flex items-center justify-between p-3 bg-slate-100 dark:bg-slate-700/50 rounded-md">
                                        <div>
                                            <span className="font-semibold">{m.name}</span>
                                            <span className={`text-xs ml-2 px-2 py-1 rounded-full ${m.shareType === 'Full' ? 'bg-slate-200 dark:bg-slate-600' : 'bg-blue-200 dark:bg-blue-900/60'}`}>
                                                {m.shareType} Share
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-1">
                                          <button onClick={() => setMemberToEdit(m)} className="text-slate-500 hover:text-primary-500 p-2 rounded-full hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors">
                                              <EditIcon className="w-4 h-4" />
                                          </button>
                                          <button onClick={() => setMemberToDelete(m)} className="text-red-500 hover:text-red-700 p-2 rounded-full hover:bg-red-100 dark:hover:bg-red-900/50 transition-colors">
                                            <TrashIcon className="w-4 h-4" />
                                          </button>
                                        </div>
                                    </div>
                                ))}
                                 {pairs.map(p => {
                                    const m1 = members.find(m => m.id === p.member1Id);
                                    const m2 = members.find(m => m.id === p.member2Id);
                                    return (
                                        <div key={p.id} className="flex items-center justify-between p-3 bg-slate-100 dark:bg-slate-700/50 rounded-md">
                                            <div>
                                              <span className="font-semibold">{m1?.name} & {m2?.name}</span>
                                              <span className="text-xs bg-green-200 dark:bg-green-900/60 ml-2 px-2 py-1 rounded-full">Paired</span>
                                            </div>
                                            <div className="flex items-center gap-1">
                                              <button onClick={() => setPairToEdit(p)} className="text-slate-500 hover:text-primary-500 p-2 rounded-full hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors">
                                                  <EditIcon className="w-4 h-4" />
                                              </button>
                                              <button onClick={() => setPairToDelete(p)} className="text-red-500 hover:text-red-700 p-2 rounded-full hover:bg-red-100 dark:hover:bg-red-900/50 transition-colors">
                                                <TrashIcon className="w-4 h-4" />
                                              </button>
                                            </div>
                                        </div>
                                    )
                                 })}
                            </div>
                        </Card>
                    )}

                    {activeTab === 'payments' && <PaymentTracker committee={committee} members={members} pairs={pairs} payments={payments} onUpdate={fetchData} duration={effectiveDuration} />}
                    {activeTab === 'draws' && <DrawManager committee={committee} members={members} pairs={pairs} payments={payments} draws={draws} onUpdate={fetchData} duration={effectiveDuration}/>}
                </div>
            </main>

            <Modal isOpen={isMemberModalOpen} onClose={() => setIsMemberModalOpen(false)} title="Add New Member">
                <MemberForm committee={committee} onClose={() => setIsMemberModalOpen(false)} onSave={fetchData} allMembers={members} />
            </Modal>
            <Modal isOpen={!!memberToEdit} onClose={() => setMemberToEdit(null)} title={`Edit Member: ${memberToEdit?.name}`}>
                {memberToEdit && <MemberEditForm member={memberToEdit} onClose={() => setMemberToEdit(null)} onSave={fetchData} />}
            </Modal>
            <Modal isOpen={!!pairToEdit} onClose={() => setPairToEdit(null)} title={`Edit Pair`}>
                {pairToEdit && <PairEditForm pair={pairToEdit} members={members} onClose={() => setPairToEdit(null)} onSave={fetchData} />}
            </Modal>
            <ConfirmationModal
                isOpen={!!memberToDelete}
                onClose={() => setMemberToDelete(null)}
                onConfirm={confirmDeleteMember}
                title="Confirm Member Deletion"
                message={memberToDelete ? `Are you sure you want to delete ${memberToDelete.name}? This cannot be undone.` : ''}
            />
            <ConfirmationModal
                isOpen={!!pairToDelete}
                onClose={() => setPairToDelete(null)}
                onConfirm={confirmDeletePair}
                title="Confirm Pair Deletion"
                message={pairToDelete ? `Are you sure you want to delete the pair "${pairToDelete.name}"? This will also delete both members. This cannot be undone.` : ''}
            />
        </div>
    );
};

const BackupRestore: React.FC<{ onBack: () => void }> = ({ onBack }) => {
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleExport = async () => {
        if (!window.confirm("This will export all your data into a JSON file. Keep this file safe.")) return;
        try {
            const data = await dbService.exportData();
            const jsonString = JSON.stringify(data, null, 2);
            const blob = new Blob([jsonString], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `committee-manager-backup-${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            alert("Backup successful!");
        } catch (error) {
            console.error("Export failed:", error);
            alert("Failed to export data.");
        }
    };

    const handleImport = () => {
        fileInputRef.current?.click();
    };

    const onFileSelected = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        if (!window.confirm("This will replace all current data with the data from the backup file. This cannot be undone. Are you sure?")) {
            if(fileInputRef.current) fileInputRef.current.value = "";
            return;
        }

        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const text = e.target?.result as string;
                const data = JSON.parse(text) as AppData;
                // Basic validation
                if (data.committees && data.members && data.pairs && data.payments && data.draws) {
                    await dbService.importData(data);
                    alert("Data restored successfully! The application will now reload.");
                    window.location.reload();
                } else {
                    throw new Error("Invalid backup file format.");
                }
            } catch (error) {
                console.error("Import failed:", error);
                alert("Failed to import data. The file may be corrupt or in the wrong format.");
            } finally {
                 if(fileInputRef.current) fileInputRef.current.value = "";
            }
        };
        reader.readAsText(file);
    };

    return (
        <div className="space-y-6">
            <Header title="Backup & Restore" onBack={onBack} />
            <main className="px-4 sm:px-6">
                <Card className="space-y-4">
                    <h3 className="text-lg font-bold">Data Management</h3>
                    <p className="text-slate-600 dark:text-slate-400">All data is stored locally on this device. You can manually export your data for backup or to move to another device.</p>
                    <div className="flex flex-col sm:flex-row gap-4 pt-2">
                        <Button onClick={handleExport} className="w-full">
                            <DownloadIcon className="w-5 h-5"/> Export Data
                        </Button>
                        <Button onClick={handleImport} variant="secondary" className="w-full">
                            <UploadIcon className="w-5 h-5"/> Import Data
                        </Button>
                        <input
                            type="file"
                            ref={fileInputRef}
                            onChange={onFileSelected}
                            accept=".json"
                            className="hidden"
                        />
                    </div>
                </Card>
            </main>
        </div>
    );
};

// --- Main App Component ---

export default function App() {
  const [view, setView] = useState<View>('dashboard');
  const [selectedCommitteeId, setSelectedCommitteeId] = useState<number | null>(null);

  useEffect(() => {
    dbService.init().then(() => console.log('Database initialized'));
  }, []);

  const navigateToCommittee = (id: number) => {
    setSelectedCommitteeId(id);
    setView('committee_detail');
  };

  const navigateToDashboard = () => {
    setSelectedCommitteeId(null);
    setView('dashboard');
  };

  const navigateToBackupRestore = () => {
    setView('backup_restore');
  };

  const renderView = () => {
    switch (view) {
      case 'committee_detail':
        return selectedCommitteeId ? <CommitteeDetail committeeId={selectedCommitteeId} onBack={navigateToDashboard} /> : <Dashboard onSelectCommittee={navigateToCommittee} onShowBackup={navigateToBackupRestore} />;
      case 'backup_restore':
        return <BackupRestore onBack={navigateToDashboard} />;
      case 'dashboard':
      default:
        return <Dashboard onSelectCommittee={navigateToCommittee} onShowBackup={navigateToBackupRestore} />;
    }
  };

  return (
    <div className="min-h-screen">
      <div className="max-w-7xl mx-auto flex flex-col min-h-screen">
        <div className="flex-grow">
          {renderView()}
        </div>
        <footer className="text-center py-4 text-slate-500 dark:text-slate-400 text-sm">
          Jaleeliyat
        </footer>
      </div>
    </div>
  );
}
