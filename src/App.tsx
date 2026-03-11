import React, { useState, useEffect, FormEvent } from 'react';
import { Plus, LayoutDashboard, Users, CheckCircle2, Clock, AlertCircle, ChevronRight, X, Calendar as CalendarIcon, User, Briefcase, Package, ChevronLeft, Trash2, Edit2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { ActionItem, Merchant, Buyer, TaskType } from './types';

export default function App() {
  const [view, setView] = useState<'dashboard' | 'merchants' | 'calendar'>('dashboard');
  const [items, setItems] = useState<ActionItem[]>([]);
  const [merchants, setMerchants] = useState<Merchant[]>([]);
  const [buyers, setBuyers] = useState<Buyer[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeModal, setActiveModal] = useState<'task' | 'merchant' | 'buyer'>('task');
  const [selectedMerchantId, setSelectedMerchantId] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingMerchantId, setEditingMerchantId] = useState<number | null>(null);
  const [editingBuyerId, setEditingBuyerId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    type: 'General Task' as TaskType,
    description: '',
    due_date: '',
    merchant_id: '',
    buyer_id: ''
  });

  const [merchantFormData, setMerchantFormData] = useState({
    name: '',
    email: ''
  });

  const [buyerFormData, setBuyerFormData] = useState({
    name: '',
    region: '',
    merchant_id: ''
  });

  const [showOwnerTasks, setShowOwnerTasks] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      const [itemsRes, merchantsRes, buyersRes] = await Promise.all([
        fetch('/api/action-items'),
        fetch('/api/merchants'),
        fetch('/api/buyers'),
      ]);
      const [itemsData, merchantsData, buyersData] = await Promise.all([
        itemsRes.json(),
        merchantsRes.json(),
        buyersRes.json(),
      ]);
      setItems(itemsData);
      setMerchants(merchantsData);
      setBuyers(buyersData);
    } catch (err) {
      console.error('Failed to load data:', err);
    } finally {
      setLoading(false);
    }
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingId(null);
    setEditingMerchantId(null);
    setEditingBuyerId(null);
    setFormError(null);
    setFormData({
      type: 'General Task',
      description: '',
      due_date: '',
      merchant_id: '',
      buyer_id: ''
    });
    setMerchantFormData({ name: '', email: '' });
    setBuyerFormData({ name: '', region: '', merchant_id: '' });
  };

  const handleAddTask = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const isOwner = merchants.find(m => String(m.id) === formData.merchant_id)?.name === 'Nandita';
    const body = {
      type: formData.type,
      description: formData.description,
      due_date: formData.due_date || null,
      merchant_id: Number(formData.merchant_id),
      buyer_id: isOwner ? null : (formData.buyer_id ? Number(formData.buyer_id) : null),
    };
    try {
      if (editingId) {
        await fetch(`/api/action-items/${editingId}`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
        });
      } else {
        await fetch('/api/action-items', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
        });
      }
      closeModal();
      await fetchData();
    } catch (err) {
      console.error('Failed to save task:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteTask = async (id: number) => {
    await fetch(`/api/action-items/${id}`, { method: 'DELETE' });
    await fetchData();
  };

  const handleEditTask = (item: ActionItem) => {
    setFormData({
      type: item.type,
      description: item.description,
      due_date: item.due_date || '',
      merchant_id: String(item.merchant_id),
      buyer_id: item.buyer_id ? String(item.buyer_id) : ''
    });
    setEditingId(item.id);
    setActiveModal('task');
    setIsModalOpen(true);
  };

  const handleAddMerchant = async (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setSaving(true);
    try {
      const url = editingMerchantId ? `/api/merchants/${editingMerchantId}` : '/api/merchants';
      const method = editingMerchantId ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method, headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: merchantFormData.name, email: merchantFormData.email }),
      });
      const data = await res.json();
      if (!res.ok) { setFormError(data.error ?? 'Something went wrong.'); return; }
      closeModal();
      await fetchData();
    } catch (err) {
      setFormError('Network error. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteMerchant = async (id: number) => {
    if (!window.confirm('Delete this merchant? Their buyers and tasks will also be removed.')) return;
    await fetch(`/api/merchants/${id}`, { method: 'DELETE' });
    await fetchData();
  };

  const handleEditMerchant = (merchant: Merchant) => {
    setMerchantFormData({ name: merchant.name, email: merchant.email });
    setEditingMerchantId(merchant.id);
    setActiveModal('merchant');
    setIsModalOpen(true);
  };

  const handleAddBuyer = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const url = editingBuyerId ? `/api/buyers/${editingBuyerId}` : '/api/buyers';
      const method = editingBuyerId ? 'PUT' : 'POST';
      await fetch(url, {
        method, headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: buyerFormData.name, region: buyerFormData.region, merchant_id: buyerFormData.merchant_id }),
      });
      closeModal();
      await fetchData();
    } catch (err) {
      console.error('Failed to save buyer:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteBuyer = async (id: number) => {
    if (!window.confirm('Delete this buyer?')) return;
    await fetch(`/api/buyers/${id}`, { method: 'DELETE' });
    await fetchData();
  };

  const handleEditBuyer = (buyer: Buyer) => {
    setBuyerFormData({ name: buyer.name, region: buyer.region, merchant_id: String(buyer.merchant_id) });
    setEditingBuyerId(buyer.id);
    setActiveModal('buyer');
    setIsModalOpen(true);
  };

  const toggleStatus = async (id: number, currentStatus: string) => {
    const newStatus = currentStatus === 'Pending' ? 'Completed' : 'Pending';
    await fetch(`/api/action-items/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    });
    await fetchData();
  };

  const today = new Date().toISOString().split('T')[0];
  
  // Filter out Nandita's tasks from the main dashboard lists
  const mainItems = items.filter(i => i.merchant_name !== 'Nandita');
  const ownerItems = items.filter(i => i.merchant_name === 'Nandita');

  const samplesToday = mainItems.filter(i => i.type === 'Sample Dispatch' && i.due_date === today && i.status === 'Pending');
  const tasksToday = mainItems.filter(i => i.type !== 'Sample Dispatch' && i.due_date === today && i.status === 'Pending');
  const overdue = mainItems.filter(i => i.due_date && i.due_date < today && i.status === 'Pending');
  const generalPending = mainItems.filter(i => !i.due_date && i.status === 'Pending');
  const completed = items.filter(i => i.status === 'Completed').sort((a, b) => b.id - a.id);

  const ownerPending = ownerItems.filter(i => i.status === 'Pending');
  const ownerCompleted = ownerItems.filter(i => i.status === 'Completed').sort((a, b) => b.id - a.id);

  return (
    <div className="min-h-screen pb-24">
      {/* Header */}
      <header className="bg-white border-b border-black/5 sticky top-0 z-30 px-4 py-4">
        <div className="max-w-2xl mx-auto flex justify-between items-center">
          <h1 className="text-xl font-bold tracking-tight">LeatherOps</h1>
          <div className="flex gap-2">
            <button 
              onClick={() => setView('dashboard')}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl transition-all ${view === 'dashboard' ? 'bg-brand-primary text-white shadow-lg shadow-brand-primary/20' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
            >
              <LayoutDashboard size={18} />
              <span className="text-xs font-bold uppercase tracking-wider hidden sm:inline">Dashboard</span>
            </button>
            <button 
              onClick={() => setView('merchants')}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl transition-all ${view === 'merchants' ? 'bg-brand-primary text-white shadow-lg shadow-brand-primary/20' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
            >
              <Users size={18} />
              <span className="text-xs font-bold uppercase tracking-wider hidden sm:inline">Merchants</span>
            </button>
            <button 
              onClick={() => setView('calendar')}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl transition-all ${view === 'calendar' ? 'bg-brand-primary text-white shadow-lg shadow-brand-primary/20' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
            >
              <CalendarIcon size={18} />
              <span className="text-xs font-bold uppercase tracking-wider hidden sm:inline">Calendar</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto p-4 space-y-6">
        {view === 'dashboard' ? (
          <>
            {/* Owner's Tile */}
            <section className="px-1">
              <button 
                onClick={() => setShowOwnerTasks(true)}
                className="w-full bg-white border border-black/5 rounded-2xl p-6 shadow-sm hover:shadow-md transition-all flex items-center justify-between group"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-brand-primary/10 rounded-full flex items-center justify-center text-brand-primary">
                    <User size={24} />
                  </div>
                  <div className="text-left">
                    <h2 className="text-xl font-bold">Nandita</h2>
                    <p className="text-sm text-gray-500">Business Owner's Desk</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {ownerPending.length > 0 && (
                    <span className="bg-brand-primary text-white text-xs font-bold px-2 py-1 rounded-full">
                      {ownerPending.length} Pending
                    </span>
                  )}
                  <ChevronRight size={20} className="text-gray-300 group-hover:text-brand-primary transition-colors" />
                </div>
              </button>
            </section>

            {/* Overdue Section */}
            {overdue.length > 0 && (
              <section className="space-y-3">
                <div className="flex items-center gap-2 text-red-600 font-semibold px-1">
                  <AlertCircle size={18} />
                  <h2>Overdue Items ({overdue.length})</h2>
                </div>
                <div className="space-y-2">
                  {overdue.map(item => (
                    <TaskCard 
                      key={item.id} 
                      item={item} 
                      onToggle={() => toggleStatus(item.id, item.status)} 
                      onEdit={() => handleEditTask(item)}
                      onDelete={() => handleDeleteTask(item.id)}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* Samples Section */}
            <section className="space-y-3">
              <div className="flex items-center gap-2 text-brand-accent font-semibold px-1">
                <Package size={18} />
                <h2>Samples to Dispatch Today ({samplesToday.length})</h2>
              </div>
              <div className="space-y-2">
                {samplesToday.length > 0 ? (
                  samplesToday.map(item => (
                    <TaskCard 
                      key={item.id} 
                      item={item} 
                      onToggle={() => toggleStatus(item.id, item.status)} 
                      onEdit={() => handleEditTask(item)}
                      onDelete={() => handleDeleteTask(item.id)}
                    />
                  ))
                ) : (
                  <div className="card text-center py-8 text-gray-400">No samples scheduled for today</div>
                )}
              </div>
            </section>

            {/* Tasks Section */}
            <section className="space-y-3">
              <div className="flex items-center gap-2 text-brand-primary font-semibold px-1">
                <Clock size={18} />
                <h2>Tasks Due Today ({tasksToday.length})</h2>
              </div>
              <div className="space-y-2">
                {tasksToday.length > 0 ? (
                  tasksToday.map(item => (
                    <TaskCard 
                      key={item.id} 
                      item={item} 
                      onToggle={() => toggleStatus(item.id, item.status)} 
                      onEdit={() => handleEditTask(item)}
                      onDelete={() => handleDeleteTask(item.id)}
                    />
                  ))
                ) : (
                  <div className="card text-center py-8 text-gray-400">All tasks completed for today!</div>
                )}
              </div>
            </section>

            {/* General Pending Section */}
            <section className="space-y-3">
              <div className="flex items-center gap-2 text-gray-600 font-semibold px-1">
                <Briefcase size={18} />
                <h2>General Pending ({generalPending.length})</h2>
              </div>
              <div className="space-y-2">
                {generalPending.length > 0 ? (
                  generalPending.map(item => (
                    <TaskCard 
                      key={item.id} 
                      item={item} 
                      onToggle={() => toggleStatus(item.id, item.status)} 
                      onEdit={() => handleEditTask(item)}
                      onDelete={() => handleDeleteTask(item.id)}
                    />
                  ))
                ) : (
                  <div className="card text-center py-8 text-gray-400">No general pending tasks</div>
                )}
              </div>
            </section>

            {/* Recently Completed Section */}
            {completed.length > 0 && (
              <section className="space-y-3">
                <div className="flex items-center gap-2 text-green-600 font-semibold px-1">
                  <CheckCircle2 size={18} />
                  <h2>Recently Completed ({completed.length})</h2>
                </div>
                <div className="space-y-2 opacity-60">
                  {completed.slice(0, 10).map(item => (
                    <TaskCard 
                      key={item.id} 
                      item={item} 
                      onToggle={() => toggleStatus(item.id, item.status)} 
                      onEdit={() => handleEditTask(item)}
                      onDelete={() => handleDeleteTask(item.id)}
                    />
                  ))}
                  {completed.length > 10 && (
                    <p className="text-center text-xs text-gray-400 py-2 italic">
                      Showing last 10 completed items. View Calendar for full history.
                    </p>
                  )}
                </div>
              </section>
            )}
          </>
        ) : view === 'merchants' ? (
          <MerchantDirectory
            merchants={merchants}
            selectedId={selectedMerchantId}
            onSelect={setSelectedMerchantId}
            items={items}
            buyers={buyers}
            onToggle={toggleStatus}
            onAddTask={(id) => {
              setFormData({
                ...formData,
                merchant_id: String(id),
                buyer_id: ''
              });
              setActiveModal('task');
              setIsModalOpen(true);
            }}
            onEdit={handleEditTask}
            onDelete={handleDeleteTask}
            onEditMerchant={handleEditMerchant}
            onDeleteMerchant={handleDeleteMerchant}
            onEditBuyer={handleEditBuyer}
            onDeleteBuyer={handleDeleteBuyer}
          />
        ) : (
          <CalendarView 
            items={items} 
            onToggle={toggleStatus} 
            onEdit={handleEditTask}
            onDelete={handleDeleteTask}
          />
        )}
      </main>

      {/* Quick Add Button */}
      <div className="fixed top-24 right-4 flex flex-col gap-2 items-end z-40">
        <AnimatePresence>
          {view === 'merchants' && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.8, x: 20 }}
              animate={{ opacity: 1, scale: 1, x: 0 }}
              exit={{ opacity: 0, scale: 0.8, x: 20 }}
              className="flex flex-col gap-2 items-end"
            >
              <button 
                onClick={() => { setActiveModal('merchant'); setIsModalOpen(true); }}
                className="flex items-center gap-1 bg-white border border-gray-200 px-2 py-1 rounded-full shadow-sm text-[10px] font-bold text-gray-500 active:scale-95 transition-transform"
              >
                <User size={12} /> Merchant
              </button>
              <button 
                onClick={() => { setActiveModal('buyer'); setIsModalOpen(true); }}
                className="flex items-center gap-1 bg-white border border-gray-200 px-2 py-1 rounded-full shadow-sm text-[10px] font-bold text-gray-500 active:scale-95 transition-transform"
              >
                <Briefcase size={12} /> Buyer
              </button>
            </motion.div>
          )}
        </AnimatePresence>
        <button 
          onClick={() => { 
            setFormData({
              ...formData,
              merchant_id: selectedMerchantId ? String(selectedMerchantId) : '',
              buyer_id: ''
            });
            setActiveModal('task'); 
            setIsModalOpen(true); 
          }}
          className="w-10 h-10 bg-brand-primary text-white rounded-full shadow-md flex items-center justify-center active:scale-90 transition-transform"
          title="Quick Add Task"
        >
          <Plus size={20} />
        </button>
      </div>

      {/* Owner Tasks Modal */}
      <AnimatePresence>
        {showOwnerTasks && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowOwnerTasks(false)}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              className="relative bg-gray-50 w-full max-w-lg rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl overflow-y-auto max-h-[90vh]"
            >
              <div className="flex justify-between items-center mb-6 sticky top-0 bg-gray-50 z-10 py-2">
                <div>
                  <h2 className="text-2xl font-bold">Nandita's Desk</h2>
                  <p className="text-sm text-gray-500">Personal tasks & business priorities</p>
                </div>
                <button onClick={() => setShowOwnerTasks(false)} className="p-2 bg-white border border-gray-200 rounded-full shadow-sm">
                  <X size={20} />
                </button>
              </div>

              <div className="space-y-6">
                <section className="space-y-3">
                  <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400 px-1">Pending Tasks</h3>
                  <div className="space-y-2">
                    {ownerPending.length > 0 ? (
                      ownerPending.map(item => (
                        <TaskCard 
                          key={item.id} 
                          item={item} 
                          onToggle={() => toggleStatus(item.id, item.status)} 
                          onEdit={() => { setShowOwnerTasks(false); handleEditTask(item); }}
                          onDelete={() => handleDeleteTask(item.id)}
                        />
                      ))
                    ) : (
                      <div className="bg-white border border-dashed border-gray-200 rounded-2xl py-8 text-center text-gray-400">
                        No pending tasks for Nandita
                      </div>
                    )}
                  </div>
                </section>

                {ownerCompleted.length > 0 && (
                  <section className="space-y-3">
                    <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400 px-1">Recently Completed</h3>
                    <div className="space-y-2 opacity-60">
                      {ownerCompleted.slice(0, 5).map(item => (
                        <TaskCard 
                          key={item.id} 
                          item={item} 
                          onToggle={() => toggleStatus(item.id, item.status)} 
                          onEdit={() => { setShowOwnerTasks(false); handleEditTask(item); }}
                          onDelete={() => handleDeleteTask(item.id)}
                        />
                      ))}
                    </div>
                  </section>
                )}
              </div>

              <button 
                onClick={() => {
                  setShowOwnerTasks(false);
                  const nandita = merchants.find(m => m.name === 'Nandita');
                  setFormData({
                    ...formData,
                    merchant_id: nandita ? String(nandita.id) : '',
                    buyer_id: ''
                  });
                  setActiveModal('task');
                  setIsModalOpen(true);
                }}
                className="w-full mt-8 bg-brand-primary text-white py-4 rounded-2xl font-bold shadow-lg shadow-brand-primary/20 active:scale-95 transition-transform flex items-center justify-center gap-2"
              >
                <Plus size={20} /> Add Task for Nandita
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modals */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={closeModal}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              className="relative bg-white w-full max-w-lg rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl overflow-y-auto max-h-[90vh]"
            >
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold">
                  {activeModal === 'task' && (editingId ? 'Edit Task' : 'Quick Add Task')}
                  {activeModal === 'merchant' && (editingMerchantId ? 'Edit Merchant' : 'Add New Merchant')}
                  {activeModal === 'buyer' && (editingBuyerId ? 'Edit Buyer' : 'Add New Buyer')}
                </h2>
                <button onClick={closeModal} className="p-2 bg-gray-100 rounded-full">
                  <X size={20} />
                </button>
              </div>

              {activeModal === 'task' && (
                <form onSubmit={handleAddTask} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Type</label>
                      <select 
                        className="input-field"
                        value={formData.type}
                        onChange={e => setFormData({...formData, type: e.target.value as TaskType})}
                      >
                        <option>General Task</option>
                        <option>Sample Dispatch</option>
                        <option>Discussion Point</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <div className="flex justify-between items-center">
                        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Due Date (Optional)</label>
                        <div className="flex gap-2">
                          <button 
                            type="button" 
                            onClick={() => setFormData({...formData, due_date: new Date().toISOString().split('T')[0]})}
                            className="text-[10px] text-brand-primary font-bold uppercase"
                          >
                            Today
                          </button>
                          {formData.due_date && (
                            <button 
                              type="button" 
                              onClick={() => setFormData({...formData, due_date: ''})}
                              className="text-[10px] text-brand-accent font-bold uppercase"
                            >
                              Clear
                            </button>
                          )}
                        </div>
                      </div>
                      <input 
                        type="date" 
                        className="input-field"
                        placeholder="No due date"
                        value={formData.due_date}
                        onChange={e => setFormData({...formData, due_date: e.target.value})}
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Merchant</label>
                    <select 
                      required
                      className="input-field"
                      value={formData.merchant_id}
                      onChange={e => setFormData({...formData, merchant_id: e.target.value, buyer_id: ''})}
                    >
                      <option value="">Select Merchant</option>
                      {merchants.map(m => (
                        <option key={m.id} value={m.id}>{m.name}</option>
                      ))}
                    </select>
                  </div>

                  {merchants.find(m => String(m.id) === formData.merchant_id)?.name !== 'Nandita' && (
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Buyer</label>
                      <select 
                        required
                        disabled={!formData.merchant_id}
                        className="input-field disabled:opacity-50"
                        value={formData.buyer_id}
                        onChange={e => setFormData({...formData, buyer_id: e.target.value})}
                      >
                        <option value="">Select Buyer</option>
                        {buyers.filter(b => b.merchant_id === Number(formData.merchant_id)).map(b => (
                          <option key={b.id} value={b.id}>{b.name} ({b.region})</option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Description</label>
                    <textarea 
                      required
                      placeholder="Quick note..."
                      className="input-field min-h-[100px] resize-none"
                      value={formData.description}
                      onChange={e => setFormData({...formData, description: e.target.value})}
                    />
                  </div>

                  <button type="submit" disabled={saving} className="btn-primary w-full py-4 text-lg disabled:opacity-60">
                    {saving ? 'Saving…' : 'Save Task'}
                  </button>
                </form>
              )}

              {activeModal === 'merchant' && (
                <form onSubmit={handleAddMerchant} className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Full Name</label>
                    <input 
                      required
                      type="text" 
                      className="input-field"
                      placeholder="e.g. Robert Wilson"
                      value={merchantFormData.name}
                      onChange={e => setMerchantFormData({...merchantFormData, name: e.target.value})}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Email Address</label>
                    <input 
                      required
                      type="email" 
                      className="input-field"
                      placeholder="robert@leatherops.com"
                      value={merchantFormData.email}
                      onChange={e => setMerchantFormData({...merchantFormData, email: e.target.value})}
                    />
                  </div>
                  {formError && (
                    <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">
                      {formError}
                    </div>
                  )}
                  <button type="submit" disabled={saving} className="btn-primary w-full py-4 text-lg disabled:opacity-60">
                    {saving ? 'Saving…' : (editingMerchantId ? 'Save Changes' : 'Add Merchant')}
                  </button>
                </form>
              )}

              {activeModal === 'buyer' && (
                <form onSubmit={handleAddBuyer} className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Company Name</label>
                    <input 
                      required
                      type="text" 
                      className="input-field"
                      placeholder="e.g. Global Leather Ltd"
                      value={buyerFormData.name}
                      onChange={e => setBuyerFormData({...buyerFormData, name: e.target.value})}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Region</label>
                    <input 
                      required
                      type="text" 
                      className="input-field"
                      placeholder="e.g. Europe / UK"
                      value={buyerFormData.region}
                      onChange={e => setBuyerFormData({...buyerFormData, region: e.target.value})}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Assign to Merchant</label>
                    <select 
                      required
                      className="input-field"
                      value={buyerFormData.merchant_id}
                      onChange={e => setBuyerFormData({...buyerFormData, merchant_id: e.target.value})}
                    >
                      <option value="">Select Merchant</option>
                      {merchants.map(m => (
                        <option key={m.id} value={m.id}>{m.name}</option>
                      ))}
                    </select>
                  </div>
                  <button type="submit" disabled={saving} className="btn-primary w-full py-4 text-lg disabled:opacity-60">
                    {saving ? 'Saving…' : (editingBuyerId ? 'Save Changes' : 'Add Buyer')}
                  </button>
                </form>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function CalendarView({ items, onToggle, onEdit, onDelete }: { 
  items: ActionItem[], 
  onToggle: (id: number, status: string) => Promise<void>,
  onEdit: (item: ActionItem) => void,
  onDelete: (id: number) => void
}) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);

  const daysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
  const firstDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay();

  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  const totalDays = daysInMonth(year, month);
  const startDay = firstDayOfMonth(year, month);

  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

  const prevMonth = () => setCurrentMonth(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentMonth(new Date(year, month + 1, 1));

  const calendarDays = [];
  for (let i = 0; i < startDay; i++) {
    calendarDays.push(null);
  }
  for (let i = 1; i <= totalDays; i++) {
    calendarDays.push(i);
  }

  const itemsForSelectedDate = items.filter(item => item.due_date === selectedDate);
  const pendingForSelectedDate = itemsForSelectedDate.filter(i => i.status === 'Pending');
  const completedForSelectedDate = itemsForSelectedDate.filter(i => i.status === 'Completed');

  const hasItems = (day: number) => {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return items.some(item => item.due_date === dateStr && item.status === 'Pending');
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div className="flex justify-between items-center px-1">
        <h2 className="text-xl font-bold">{monthNames[month]} {year}</h2>
        <div className="flex gap-2">
          <button onClick={prevMonth} className="p-2 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors">
            <ChevronLeft size={20} />
          </button>
          <button onClick={nextMonth} className="p-2 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors">
            <ChevronRight size={20} />
          </button>
        </div>
      </div>

      <div className="card p-4">
        <div className="grid grid-cols-7 gap-1 mb-2">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
            <div key={day} className="text-center text-[10px] font-bold text-gray-400 uppercase tracking-widest py-2">
              {day}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {calendarDays.map((day, idx) => {
            if (day === null) return <div key={`empty-${idx}`} className="aspect-square" />;
            
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const isSelected = selectedDate === dateStr;
            const isToday = new Date().toISOString().split('T')[0] === dateStr;
            const hasPending = hasItems(day);

            return (
              <button
                key={day}
                onClick={() => setSelectedDate(dateStr)}
                className={`relative aspect-square rounded-xl flex items-center justify-center text-sm font-semibold transition-all ${
                  isSelected 
                    ? 'bg-brand-primary text-white shadow-lg shadow-brand-primary/20 scale-105 z-10' 
                    : isToday 
                      ? 'bg-brand-primary/10 text-brand-primary' 
                      : 'hover:bg-gray-100'
                }`}
              >
                {day}
                {hasPending && !isSelected && (
                  <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-brand-accent" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex justify-between items-center px-1">
          <h3 className="font-bold text-lg">
            {selectedDate === new Date().toISOString().split('T')[0] ? 'Today' : selectedDate}
          </h3>
          <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">
            {itemsForSelectedDate.length} Items
          </span>
        </div>

        {itemsForSelectedDate.length > 0 ? (
          <div className="space-y-3">
            {pendingForSelectedDate.length > 0 && (
              <div className="space-y-2">
                {pendingForSelectedDate.map(item => (
                  <TaskCard 
                    key={item.id} 
                    item={item} 
                    onToggle={() => onToggle(item.id, item.status)} 
                    onEdit={() => onEdit(item)}
                    onDelete={() => onDelete(item.id)}
                  />
                ))}
              </div>
            )}
            {completedForSelectedDate.length > 0 && (
              <div className="space-y-2 opacity-60">
                {completedForSelectedDate.map(item => (
                  <TaskCard 
                    key={item.id} 
                    item={item} 
                    onToggle={() => onToggle(item.id, item.status)} 
                    onEdit={() => onEdit(item)}
                    onDelete={() => onDelete(item.id)}
                  />
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="card text-center py-12 text-gray-400">
            <CalendarIcon size={40} className="mx-auto mb-3 opacity-20" />
            <p>No tasks or shipments for this date</p>
          </div>
        )}
      </div>
    </motion.div>
  );
}

function TaskCard({ item, onToggle, onEdit, onDelete }: { 
  item: ActionItem, 
  onToggle: () => Promise<void> | void, 
  onEdit?: () => void,
  onDelete?: () => void,
  key?: React.Key 
}) {
  return (
    <motion.div 
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="card flex items-start gap-4 group relative"
    >
      <button 
        onClick={onToggle}
        className={`mt-1 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${
          item.status === 'Completed' ? 'bg-green-500 border-green-500 text-white' : 'border-gray-300 hover:border-brand-primary'
        }`}
      >
        {item.status === 'Completed' && <CheckCircle2 size={16} />}
      </button>
      <div className="flex-1 space-y-1">
        <div className="flex justify-between items-start pr-16">
          <p className={`font-medium ${item.status === 'Completed' ? 'line-through text-gray-400' : ''}`}>
            {item.description}
          </p>
          <span className="text-[10px] font-bold uppercase tracking-tighter bg-gray-100 px-1.5 py-0.5 rounded text-gray-500">
            {item.type}
          </span>
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
          <span className="flex items-center gap-1"><User size={12} /> {item.merchant_name}</span>
          {item.buyer_name && <span className="flex items-center gap-1"><Briefcase size={12} /> {item.buyer_name}</span>}
          {item.due_date && <span className="flex items-center gap-1"><CalendarIcon size={12} /> {item.due_date}</span>}
        </div>
      </div>
      
      <div className="absolute top-3 right-3 flex gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
        {onEdit && (
          <button 
            onClick={(e) => { e.stopPropagation(); onEdit(); }}
            className="p-1.5 text-gray-400 hover:text-brand-primary hover:bg-brand-primary/5 rounded-lg transition-colors"
            title="Edit Task"
          >
            <Edit2 size={14} />
          </button>
        )}
        {onDelete && (
          <button 
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            title="Delete Task"
          >
            <Trash2 size={14} />
          </button>
        )}
      </div>
    </motion.div>
  );
}

function MerchantDirectory({ merchants, selectedId, onSelect, items, buyers, onToggle, onAddTask, onEdit, onDelete, onEditMerchant, onDeleteMerchant, onEditBuyer, onDeleteBuyer }: {
  merchants: Merchant[],
  selectedId: number | null,
  onSelect: (id: number | null) => void,
  items: ActionItem[],
  buyers: Buyer[],
  onToggle: (id: number, status: string) => Promise<void>,
  onAddTask: (merchantId: number) => void,
  onEdit: (item: ActionItem) => void,
  onDelete: (id: number) => void,
  onEditMerchant: (merchant: Merchant) => void,
  onDeleteMerchant: (id: number) => void,
  onEditBuyer: (buyer: Buyer) => void,
  onDeleteBuyer: (id: number) => void,
}) {
  const [selectedBuyerId, setSelectedBuyerId] = useState<number | null>(null);
  
  const selectedMerchant = merchants.find(m => m.id === selectedId);
  const merchantBuyers = buyers.filter(b => b.merchant_id === selectedId);
  const pendingItems = items.filter(i => i.merchant_id === selectedId && i.status === 'Pending');
  const completedItems = items.filter(i => i.merchant_id === selectedId && i.status === 'Completed').sort((a, b) => b.id - a.id);

  const samples = pendingItems.filter(i => i.type === 'Sample Dispatch');
  const otherTasks = pendingItems.filter(i => i.type !== 'Sample Dispatch');

  if (selectedId && selectedMerchant) {
    if (selectedBuyerId) {
      const buyer = buyers.find(b => b.id === selectedBuyerId);
      const buyerPending = pendingItems.filter(i => i.buyer_id === selectedBuyerId);
      const buyerCompleted = completedItems.filter(i => i.buyer_id === selectedBuyerId);

      return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
          <button onClick={() => setSelectedBuyerId(null)} className="flex items-center gap-1 text-sm font-semibold text-gray-500 hover:text-brand-primary">
            <ChevronRight size={16} className="rotate-180" /> Back to {selectedMerchant.name}
          </button>

          <div className="flex justify-between items-end border-b border-gray-100 pb-4">
            <div>
              <h2 className="text-2xl font-bold">{buyer?.name}</h2>
              <p className="text-gray-500 text-sm font-medium">{buyer?.region} Region</p>
            </div>
            <div className="text-right">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Buyer Details</p>
            </div>
          </div>

          <section className="space-y-3">
            <div className="flex items-center gap-2 text-brand-primary font-bold px-1">
              <Clock size={18} />
              <h3>Pending for {buyer?.name} ({buyerPending.length})</h3>
            </div>
            <div className="space-y-2">
              {buyerPending.length > 0 ? (
                buyerPending.map(item => (
                  <TaskCard 
                    key={item.id} 
                    item={item} 
                    onToggle={() => onToggle(item.id, item.status)} 
                    onEdit={() => onEdit(item)}
                    onDelete={() => onDelete(item.id)}
                  />
                ))
              ) : (
                <div className="card text-center py-8 text-gray-400">No pending tasks for this buyer</div>
              )}
            </div>
          </section>

          {buyerCompleted.length > 0 && (
            <section className="space-y-3">
              <div className="flex items-center gap-2 text-green-600 font-bold px-1">
                <CheckCircle2 size={18} />
                <h3>Completed History ({buyerCompleted.length})</h3>
              </div>
              <div className="space-y-2 opacity-60">
                {buyerCompleted.map(item => (
                  <TaskCard 
                    key={item.id} 
                    item={item} 
                    onToggle={() => onToggle(item.id, item.status)} 
                    onEdit={() => onEdit(item)}
                    onDelete={() => onDelete(item.id)}
                  />
                ))}
              </div>
            </section>
          )}
        </motion.div>
      );
    }

    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
        <button onClick={() => onSelect(null)} className="flex items-center gap-1 text-sm font-semibold text-gray-500 hover:text-brand-primary">
          <ChevronRight size={16} className="rotate-180" /> Back to Directory
        </button>
        
        <div className="flex justify-between items-start">
          <div className="space-y-1">
            <h2 className="text-2xl font-bold">{selectedMerchant.name}</h2>
            <p className="text-gray-500">{selectedMerchant.email}</p>
            <button 
              onClick={() => onAddTask(selectedId)}
              className="mt-2 flex items-center gap-1.5 text-xs font-bold text-brand-primary bg-brand-primary/10 px-3 py-1.5 rounded-full hover:bg-brand-primary/20 transition-colors"
            >
              <Plus size={14} /> Add Task for {selectedMerchant.name.split(' ')[0]}
            </button>
          </div>
          <div className="bg-brand-primary/5 p-3 rounded-2xl border border-brand-primary/10">
            <User className="text-brand-primary" size={24} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="card text-center bg-brand-primary/5 border-brand-primary/10">
            <p className="text-2xl font-bold text-brand-primary">{merchantBuyers.length}</p>
            <p className="text-[10px] text-gray-500 uppercase font-bold tracking-wider">Active Buyers</p>
          </div>
          <div className="card text-center bg-brand-accent/5 border-brand-accent/10">
            <p className="text-2xl font-bold text-brand-accent">{pendingItems.length}</p>
            <p className="text-[10px] text-gray-500 uppercase font-bold tracking-wider">Pending Items</p>
          </div>
        </div>

        {/* Sample Shipments Section */}
        <section className="space-y-3">
          <div className="flex items-center gap-2 text-brand-accent font-bold px-1">
            <Package size={18} />
            <h3>Sample Shipments ({samples.length})</h3>
          </div>
          <div className="space-y-2">
            {samples.length > 0 ? (
              samples.map(item => (
                <TaskCard 
                  key={item.id} 
                  item={item} 
                  onToggle={() => onToggle(item.id, item.status)} 
                  onEdit={() => onEdit(item)}
                  onDelete={() => onDelete(item.id)}
                />
              ))
            ) : (
              <div className="card text-center py-6 text-gray-400 text-sm">No pending sample shipments</div>
            )}
          </div>
        </section>

        {/* Other Tasks Section */}
        <section className="space-y-3">
          <div className="flex items-center gap-2 text-brand-primary font-bold px-1">
            <Clock size={18} />
            <h3>Pending Work & Tasks ({otherTasks.length})</h3>
          </div>
          <div className="space-y-2">
            {otherTasks.length > 0 ? (
              otherTasks.map(item => (
                <TaskCard 
                  key={item.id} 
                  item={item} 
                  onToggle={() => onToggle(item.id, item.status)} 
                  onEdit={() => onEdit(item)}
                  onDelete={() => onDelete(item.id)}
                />
              ))
            ) : (
              <div className="card text-center py-6 text-gray-400 text-sm">No other pending work</div>
            )}
          </div>
        </section>

        {/* Buyers List */}
        <section className="space-y-3">
          <h3 className="font-bold text-lg px-1">Assigned Buyers</h3>
          <div className="grid grid-cols-1 gap-2">
            {merchantBuyers.map(b => (
              <div
                key={b.id}
                className="card flex justify-between items-center py-3 hover:border-brand-primary/30 transition-colors"
              >
                <button
                  onClick={() => setSelectedBuyerId(b.id)}
                  className="flex items-center gap-3 flex-1 text-left"
                >
                  <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center text-xs font-bold text-gray-500">
                    {b.name.charAt(0)}
                  </div>
                  <div>
                    <span className="font-medium">{b.name}</span>
                    <span className="text-[10px] font-bold uppercase text-gray-400 tracking-widest ml-2">{b.region}</span>
                  </div>
                </button>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => onEditBuyer(b)}
                    className="p-1.5 text-gray-400 hover:text-brand-primary hover:bg-brand-primary/5 rounded-lg transition-colors"
                    title="Edit Buyer"
                  >
                    <Edit2 size={14} />
                  </button>
                  <button
                    onClick={() => onDeleteBuyer(b.id)}
                    className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    title="Delete Buyer"
                  >
                    <Trash2 size={14} />
                  </button>
                  <ChevronRight size={14} className="text-gray-300 ml-1" />
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Completed History Section */}
        {completedItems.length > 0 && (
          <section className="space-y-3">
            <div className="flex items-center gap-2 text-green-600 font-bold px-1">
              <CheckCircle2 size={18} />
              <h3>Completed History ({completedItems.length})</h3>
            </div>
            <div className="space-y-2 opacity-60">
              {completedItems.slice(0, 5).map(item => (
                <TaskCard 
                  key={item.id} 
                  item={item} 
                  onToggle={() => onToggle(item.id, item.status)} 
                  onEdit={() => onEdit(item)}
                  onDelete={() => onDelete(item.id)}
                />
              ))}
            </div>
          </section>
        )}
      </motion.div>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold px-1">Merchant Directory</h2>
      <div className="grid gap-3">
        {merchants.map(m => (
          <div
            key={m.id}
            className="card flex justify-between items-center hover:border-brand-primary/30 transition-colors"
          >
            <button
              onClick={() => onSelect(m.id)}
              className="flex-1 text-left"
            >
              <p className="font-bold">{m.name}</p>
              <p className="text-xs text-gray-500">{m.email}</p>
            </button>
            <div className="flex items-center gap-1">
              {m.name !== 'Nandita' && (
                <>
                  <button
                    onClick={() => onEditMerchant(m)}
                    className="p-1.5 text-gray-400 hover:text-brand-primary hover:bg-brand-primary/5 rounded-lg transition-colors"
                    title="Edit Merchant"
                  >
                    <Edit2 size={14} />
                  </button>
                  <button
                    onClick={() => onDeleteMerchant(m.id)}
                    className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    title="Delete Merchant"
                  >
                    <Trash2 size={14} />
                  </button>
                </>
              )}
              <ChevronRight size={20} className="text-gray-300 ml-1" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
