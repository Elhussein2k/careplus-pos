import React, { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';
import { 
  LayoutDashboard, ShoppingCart, Users, LogOut, Search, 
  Plus, Pencil, Trash2, X, Eye, FilePlus, CreditCard, 
  Globe, Truck, ShoppingBag, Check, Boxes, AlertTriangle
} from 'lucide-react';
import './style.css'; 

export default function App() {
  const [session, setSession] = useState(null);
  const [userRole, setUserRole] = useState(null); 
  const [loadingProfile, setLoadingProfile] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
        setSession(session);
        if (session) fetchUserProfile(session);
        else setLoadingProfile(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
        setSession(session);
        if (session) fetchUserProfile(session);
        else {
            setUserRole(null);
            setLoadingProfile(false);
        }
    });
    return () => subscription.unsubscribe();
  }, []);

  async function fetchUserProfile(session) {
      try {
          // 1. FAILSAFE: Force Superadmin for specific email
          if (session.user.email === 'elmoussa2k@gmail.com') {
              setUserRole('superadmin');
              setLoadingProfile(false);
              return;
          }

          // 2. Normal DB Fetch
          const { data } = await supabase.from('profiles').select('role').eq('id', session.user.id).single();
          if (data) setUserRole(data.role);
          else setUserRole('manager'); // Fallback
      } catch (e) { console.error(e); } 
      finally { setLoadingProfile(false); }
  }

  if (loadingProfile) return <div style={{height:'100vh', display:'flex', alignItems:'center', justifyContent:'center'}}>Loading Profile...</div>;
  if (!session) return <LoginScreen />;
  return <MainApp session={session} userRole={userRole} />;
}

// --- 🔐 LOGIN SCREEN ---
function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function handleLogin(e) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) { setError(error.message); setLoading(false); }
  }

  return (
    <div style={{ height: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center', background: '#f1f5f9' }}>
      <div style={{ background: 'white', padding: '40px', borderRadius: '12px', width: '400px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}>
        <h2 style={{ textAlign: 'center', marginBottom: '20px', color:'#1e293b' }}>💊 CarePlus Login</h2>
        {error && <div style={{background: '#fee2e2', color: '#b91c1c', padding: '10px', borderRadius: '6px', marginBottom: '15px', fontSize: '0.9rem'}}>{error}</div>}
        <form onSubmit={handleLogin}>
          <div style={{marginBottom: '15px'}}><label style={{display:'block', marginBottom:'5px', color:'#64748b'}}>Email</label><input type="email" required value={email} onChange={e => setEmail(e.target.value)} style={{ width: '100%', padding: '10px', border:'1px solid #e2e8f0', borderRadius:'6px' }} /></div>
          <div style={{marginBottom: '25px'}}><label style={{display:'block', marginBottom:'5px', color:'#64748b'}}>Password</label><input type="password" required value={password} onChange={e => setPassword(e.target.value)} style={{ width: '100%', padding: '10px', border:'1px solid #e2e8f0', borderRadius:'6px' }} /></div>
          <button type="submit" disabled={loading} className="btn-primary" style={{width:'100%', justifyContent:'center'}}>{loading ? 'Signing In...' : 'Sign In'}</button>
        </form>
      </div>
    </div>
  );
}

// --- 🚀 MAIN APP ---
function MainApp({ session, userRole }) {
  const [activeTab, setActiveTab] = useState(userRole === 'pharmacist' ? 'pos' : (userRole === 'superadmin' ? 'superadmin' : 'dashboard'));
  
  // States
  const [suppliers, setSuppliers] = useState([]);
  const [supplierCategories, setSupplierCategories] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [tenants, setTenants] = useState([]); 
  const [inventory, setInventory] = useState([]); // Basic Inventory Mock
  
  // Modals & Forms
  const [showSupplierModal, setShowSupplierModal] = useState(false);
  const [showViewSupplier, setShowViewSupplier] = useState(false); // View Modal
  const [supplierForm, setSupplierForm] = useState({});
  
  const [showPurchaseWizard, setShowPurchaseWizard] = useState(false);
  const [purchaseForm, setPurchaseForm] = useState({ supplierId: '', invoiceNo: '', items: [], paymentMode: '', date: new Date().toISOString().split('T')[0] });
  const [purchaseStep, setPurchaseStep] = useState(1);
  
  const [showTenantWizard, setShowTenantWizard] = useState(false);
  const [tenantForm, setTenantForm] = useState({ name: '', email: '', plan: 'STANDARD' });

  useEffect(() => {
    // MOCK DATA LOAD
    setSuppliers([
        { id: 1, name: 'Global Meds', email: 'info@global.com', mobile: '0501234567', country: 'Saudi Arabia', city: 'Riyadh', status: true, category: 'Registered', brand: 'Pfizer' },
        { id: 2, name: 'Fast Pharma', email: 'ali@fast.com', mobile: '0559876543', country: 'UAE', city: 'Dubai', status: false, category: 'Unregistered', brand: 'Novartis' }
    ]);
    setPurchases([
        { id: 101, invoiceNo: 'INV-001', supplier: 'Global Meds', date: '2025-01-20', amount: 5000, createdBy: 'Dr. House' }
    ]);
    setTenants([
        { id: 'uuid-1', company_name: 'CarePlus Riyadh', plan: 'ENTERPRISE', status: 'ACTIVE', revenue: 12400 },
        { id: 'uuid-2', company_name: 'City Pharmacy', plan: 'STANDARD', status: 'ACTIVE', revenue: 8200 }
    ]);
    setInventory([
        { id: 1, name: 'Panadol Extra', stock: 150, price: 12.50 },
        { id: 2, name: 'Augmentin 1g', stock: 40, price: 45.00 }
    ]);
    setSupplierCategories(['Registered', 'Unregistered', 'International']);
  }, []);

  async function handleLogout() { await supabase.auth.signOut(); }

  // --- LOGIC: SUPPLIERS ---
  const handleSaveSupplier = () => {
      if(supplierForm.id) setSuppliers(prev => prev.map(s => s.id === supplierForm.id ? supplierForm : s));
      else setSuppliers(prev => [...prev, { ...supplierForm, id: Date.now(), status: true }]);
      setShowSupplierModal(false);
  };
  
  const toggleSupplierStatus = (id) => {
      setSuppliers(prev => prev.map(s => s.id === id ? { ...s, status: !s.status } : s));
  }

  // --- LOGIC: PURCHASES ---
  const addPurchaseItem = (item) => {
      const total = (parseFloat(item.cost) * parseInt(item.qty));
      const vatVal = total * (parseFloat(item.vat || 0) / 100);
      setPurchaseForm(prev => ({ ...prev, items: [...prev.items, { ...item, total, vatValue: vatVal, final: total + vatVal }] }));
  };
  
  const submitPurchase = () => {
      const total = purchaseForm.items.reduce((s,i)=>s+i.final,0);
      setPurchases(prev=>[...prev, {id: Date.now(), invoiceNo: 'NEW', supplier: 'Global', date: purchaseForm.date, amount: total, createdBy:'Me'}]); 
      setShowPurchaseWizard(false);
  };

  // --- LOGIC: TENANTS ---
  const handleCreateTenant = () => {
      setTenants(prev => [...prev, { id: Date.now(), company_name: tenantForm.name, plan: tenantForm.plan, status: 'ACTIVE', revenue: 0 }]);
      setShowTenantWizard(false);
      alert("Pharmacy Created Successfully!");
  };

  // --- RENDER CONTENT ---
  const renderContent = () => {
    // 1. SUPERADMIN - SUBSCRIPTIONS
    if (activeTab === 'superadmin') return (
        <div style={{padding: '2rem'}}>
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'2rem'}}>
                <h2>🌍 Subscription Management</h2>
                <button className="btn-primary" onClick={() => setShowTenantWizard(true)}>
                    <Globe size={18}/> Create New Pharmacy
                </button>
            </div>
            <div className="form-grid" style={{gridTemplateColumns:'repeat(3, 1fr)', marginBottom:'30px'}}>
                <div style={{background:'#1e293b', color:'white', padding:'20px', borderRadius:'8px'}}><h3>{tenants.length}</h3><p>Active Pharmacies</p></div>
                <div style={{background:'#1e293b', color:'white', padding:'20px', borderRadius:'8px'}}><h3>${tenants.reduce((s,t)=>s+t.revenue,0).toLocaleString()}</h3><p>Total Revenue</p></div>
            </div>
            <div className="table-container">
                <table className="modern-table">
                    <thead><tr><th>Pharmacy Name</th><th>Plan</th><th>Status</th><th>Revenue</th><th>Actions</th></tr></thead>
                    <tbody>
                        {tenants.map(t => (
                            <tr key={t.id}>
                                <td style={{fontWeight:'bold'}}>{t.company_name}</td>
                                <td><span className="role-badge" style={{background:'#3c50e0', color:'white'}}>{t.plan}</span></td>
                                <td><span className="role-badge" style={{background:'#10b981', color:'white'}}>{t.status}</span></td>
                                <td>${t.revenue.toLocaleString()}</td>
                                <td><button className="btn-primary" style={{padding:'5px 10px', fontSize:'0.7rem'}}>Manage</button></td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );

    // 2. SUPPLIERS
    if (activeTab === 'suppliers') return (
        <div style={{padding: '20px'}}>
            <div style={{display:'flex', justifyContent:'space-between', marginBottom:'20px'}}>
                <h2>Supplier Management</h2>
                <div style={{display:'flex', gap:'10px'}}>
                   <button className="btn-primary" style={{background:'#64748b'}}>Categories</button>
                   <button className="btn-primary" onClick={() => { setSupplierForm({}); setShowSupplierModal(true); }}><Plus size={18}/> Add Supplier</button>
                </div>
            </div>
            <div className="table-container">
                <table className="modern-table">
                    <thead><tr><th>Name</th><th>Email</th><th>Mobile</th><th>Country</th><th>Status</th><th>Actions</th></tr></thead>
                    <tbody>
                        {suppliers.map(s => (
                            <tr key={s.id} style={{opacity: s.status ? 1 : 0.5}}>
                                <td><b>{s.name}</b><br/><small>{s.category}</small></td>
                                <td>{s.email}</td>
                                <td>{s.mobile}</td>
                                <td>{s.country}</td>
                                <td>
                                    <label className="switch">
                                        <input type="checkbox" checked={s.status} onChange={() => toggleSupplierStatus(s.id)}/>
                                        <span className="slider"></span>
                                    </label>
                                </td>
                                <td>
                                    <button onClick={() => { setSupplierForm(s); setShowViewSupplier(true); }} style={{border:'none', background:'none', cursor:'pointer', marginRight:'10px'}}><Eye size={18} color="#64748b"/></button>
                                    <button onClick={() => { setSupplierForm(s); setShowSupplierModal(true); }} style={{border:'none', background:'none', cursor:'pointer'}}><Pencil size={18} color="#3c50e0"/></button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );

    // 3. PURCHASES
    if (activeTab === 'purchases') return (
        <div style={{padding: '20px'}}>
            <div style={{display:'flex', justifyContent:'space-between', marginBottom:'20px'}}>
                <h2>Purchase Management</h2>
                <button className="btn-primary" onClick={() => { setShowPurchaseWizard(true); setPurchaseStep(1); }}><FilePlus size={18}/> New Purchase</button>
            </div>
            <div className="table-container">
                <table className="modern-table">
                    <thead><tr><th>Invoice #</th><th>Supplier</th><th>Date</th><th>Amount</th><th>Created By</th></tr></thead>
                    <tbody>
                        {purchases.map(p => (
                            <tr key={p.id}>
                                <td>{p.invoiceNo}</td><td>{p.supplier}</td><td>{p.date}</td><td><b>${p.amount?.toFixed(2)}</b></td><td>{p.createdBy}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );

    // 4. POS (Available to All)
    if (activeTab === 'pos') return (
         <div className="pos-layout">
            <div className="pos-products">
               <div style={{padding:'20px', fontWeight:'bold'}}>Select Products</div>
               <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(200px, 1fr))', gap:'15px', padding:'20px'}}>
                  {inventory.map(m => (
                      <div key={m.id} className="product-card">
                          <strong>{m.name}</strong><br/>
                          <span style={{color:'#64748b'}}>{m.stock} Left</span>
                          <div style={{marginTop:'10px', fontWeight:'bold', color:'#3c50e0'}}>${m.price}</div>
                      </div>
                  ))}
               </div>
            </div>
            <div className="pos-cart">
               <div style={{padding:'20px', borderBottom:'1px solid #eee', fontWeight:'bold'}}>Current Cart</div>
               <div style={{flex:1, display:'flex', alignItems:'center', justifyContent:'center', color:'#aaa'}}>Cart is Empty</div>
               <div style={{padding:'20px', borderTop:'1px solid #eee'}}><button className="btn-primary" style={{width:'100%', justifyContent:'center'}}>Pay Now</button></div>
            </div>
         </div>
    );

    return <div style={{padding:'2rem'}}>Select a module.</div>;
  };

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <div className="logo-area"><span style={{color:'#3c50e0'}}>💊</span> CarePlus</div>
        <nav className="nav-links">
          {/* SUPERADMIN ONLY */}
          {userRole === 'superadmin' && (
              <>
                <div className="nav-divider">PLATFORM</div>
                <div className={`nav-item ${activeTab==='superadmin'?'active':''}`} onClick={()=>setActiveTab('superadmin')}><Globe size={18} className="nav-icon"/> Subscriptions</div>
              </>
          )}

          {/* EVERYONE SEES POS */}
          <div className="nav-divider">OPERATIONS</div>
          <div className={`nav-item ${activeTab==='pos'?'active':''}`} onClick={()=>setActiveTab('pos')}><ShoppingCart size={18} className="nav-icon"/> POS Terminal</div>
          
          {/* MANAGER & SUPERADMIN ONLY */}
          {['superadmin', 'manager'].includes(userRole) && (
              <>
                <div className={`nav-item ${activeTab==='purchases'?'active':''}`} onClick={()=>setActiveTab('purchases')}><ShoppingBag size={18} className="nav-icon"/> Purchases</div>
                <div className="nav-divider">MANAGEMENT</div>
                <div className={`nav-item ${activeTab==='suppliers'?'active':''}`} onClick={()=>setActiveTab('suppliers')}><Truck size={18} className="nav-icon"/> Suppliers</div>
              </>
          )}
        </nav>
        
        {/* LOGOUT */}
        <div style={{padding: '20px', borderTop:'1px solid #333a48'}}>
            <div className="nav-item" onClick={handleLogout} style={{color: '#ef4444'}}><LogOut size={18} className="nav-icon"/> Sign Out</div>
        </div>
      </aside>
      
      <main className="main-content">
        <header className="top-bar">
             <h3>{activeTab === 'pos' ? 'POS Terminal' : activeTab.toUpperCase()}</h3>
             <span className={`role-badge role-${userRole}`}>{userRole ? userRole.toUpperCase() : 'LOADING'}</span>
        </header>
        <div className="content-scroll">{renderContent()}</div>
      </main>

      {/* MODAL: SUPPLIER VIEW/EDIT */}
      {(showSupplierModal || showViewSupplier) && (
        <div className="modal-overlay">
            <div className="modal-content">
                <div className="modal-header">
                    <h3>{showViewSupplier ? 'Supplier Details' : (supplierForm.id ? 'Edit Supplier' : 'Add Supplier')}</h3>
                    <button className="close-btn" onClick={()=>{setShowSupplierModal(false); setShowViewSupplier(false)}}><X/></button>
                </div>
                {showViewSupplier ? (
                    // VIEW MODE
                    <div style={{lineHeight:'2rem'}}>
                        <p><strong>Name:</strong> {supplierForm.name}</p>
                        <p><strong>Email:</strong> {supplierForm.email}</p>
                        <p><strong>Mobile:</strong> {supplierForm.mobile}</p>
                        <p><strong>Address:</strong> {supplierForm.addr1}, {supplierForm.city}</p>
                        <p><strong>Brand:</strong> {supplierForm.brand}</p>
                        <div style={{marginTop:'20px', textAlign:'right'}}>
                             <button className="btn-primary" onClick={()=>{setShowViewSupplier(false); setShowSupplierModal(true)}}>Edit This Profile</button>
                        </div>
                    </div>
                ) : (
                    // EDIT/ADD MODE
                    <>
                        <div className="form-grid">
                            <div className="form-group"><label>Name</label><input value={supplierForm.name || ''} onChange={e=>setSupplierForm({...supplierForm, name:e.target.value})}/></div>
                            <div className="form-group"><label>Email</label><input value={supplierForm.email || ''} onChange={e=>setSupplierForm({...supplierForm, email:e.target.value})}/></div>
                            <div className="form-group"><label>Mobile</label><input value={supplierForm.mobile || ''} onChange={e=>setSupplierForm({...supplierForm, mobile:e.target.value})}/></div>
                            <div className="form-group"><label>Category</label><select value={supplierForm.category} onChange={e=>setSupplierForm({...supplierForm, category:e.target.value})}><option>Select...</option>{supplierCategories.map(c=><option key={c}>{c}</option>)}</select></div>
                            <div className="form-group"><label>Address</label><input value={supplierForm.addr1 || ''} onChange={e=>setSupplierForm({...supplierForm, addr1:e.target.value})}/></div>
                            <div className="form-group"><label>City</label><input value={supplierForm.city || ''} onChange={e=>setSupplierForm({...supplierForm, city:e.target.value})}/></div>
                            <div className="form-group"><label>Brand</label><input value={supplierForm.brand || ''} onChange={e=>setSupplierForm({...supplierForm, brand:e.target.value})}/></div>
                        </div>
                        <div style={{textAlign:'right', marginTop:'20px'}}><button className="btn-primary" onClick={handleSaveSupplier}>Save</button></div>
                    </>
                )}
            </div>
        </div>
      )}

      {/* MODAL: PURCHASE WIZARD */}
      {showPurchaseWizard && (
        <div className="modal-overlay">
            <div className="modal-content" style={{width:'900px'}}>
                <div className="modal-header"><h3>New Invoice (Step {purchaseStep}/3)</h3><button className="close-btn" onClick={()=>setShowPurchaseWizard(false)}><X/></button></div>
                {purchaseStep === 1 && (
                    <>
                        <div className="form-grid" style={{gridTemplateColumns:'1fr 1fr 1fr'}}>
                             <div className="form-group"><label>Supplier</label><select onChange={e=>setPurchaseForm({...purchaseForm, supplierId:e.target.value})}><option>Select...</option>{suppliers.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
                             <div className="form-group"><label>Invoice #</label><input onChange={e=>setPurchaseForm({...purchaseForm, supplierInvoiceNo:e.target.value})}/></div>
                             <div className="form-group"><label>Date</label><input type="date" value={purchaseForm.date} onChange={e=>setPurchaseForm({...purchaseForm, date:e.target.value})}/></div>
                        </div>
                        <div style={{background:'#f8fafc', padding:'15px', borderRadius:'8px', margin:'20px 0'}}>
                            <h4>Add Item</h4>
                            <div className="form-grid" style={{gridTemplateColumns:'2fr 1fr 1fr 1fr 1fr auto'}}>
                                <input placeholder="Item" id="p_item"/><input placeholder="Exp" type="date" id="p_exp"/><input placeholder="Cost" type="number" id="p_cost"/><input placeholder="Qty" type="number" id="p_qty"/><input placeholder="VAT%" type="number" id="p_vat"/>
                                <button className="btn-primary" onClick={()=>{ addPurchaseItem({ name: document.getElementById('p_item').value, cost: document.getElementById('p_cost').value, qty: document.getElementById('p_qty').value, vat: document.getElementById('p_vat').value }); }}><Plus/></button>
                            </div>
                        </div>
                        <table className="modern-table"><thead><tr><th>Item</th><th>Cost</th><th>Qty</th><th>Total</th></tr></thead><tbody>{purchaseForm.items.map((it, i)=><tr key={i}><td>{it.name}</td><td>{it.cost}</td><td>{it.qty}</td><td>{it.final.toFixed(2)}</td></tr>)}</tbody></table>
                        <div style={{marginTop:'20px', textAlign:'right'}}><button className="btn-primary" onClick={()=>setPurchaseStep(2)}>Next</button></div>
                    </>
                )}
                {purchaseStep === 2 && (
                    <div style={{textAlign:'center', padding:'30px'}}>
                        <h3>Select Payment</h3>
                        <div style={{display:'flex', gap:'10px', justifyContent:'center', margin:'20px 0'}}>{['Cash', 'Card', 'Transfer'].map(m=><button key={m} onClick={()=>setPurchaseForm({...purchaseForm, paymentMode:m})} style={{padding:'15px', border:'1px solid #ddd'}}>{m}</button>)}</div>
                        <button className="btn-primary" disabled={!purchaseForm.paymentMode} onClick={()=>setPurchaseStep(3)}>Next</button>
                    </div>
                )}
                {purchaseStep === 3 && (
                    <div>
                        <div style={{border:'1px solid #ddd', padding:'20px'}}><h2>Invoice Preview</h2><p>Total: ${purchaseForm.items.reduce((s,i)=>s+i.final,0).toFixed(2)}</p></div>
                        <div style={{marginTop:'20px', textAlign:'right'}}><button className="btn-primary" onClick={submitPurchase}>Submit</button></div>
                    </div>
                )}
            </div>
        </div>
      )}

      {/* MODAL: TENANT WIZARD */}
      {showTenantWizard && (
          <div className="modal-overlay">
              <div className="modal-content">
                  <div className="modal-header"><h3>Create Pharmacy Tenant</h3><button className="close-btn" onClick={()=>setShowTenantWizard(false)}><X/></button></div>
                  <div className="form-grid">
                      <div className="form-group"><label>Pharmacy Name</label><input onChange={e=>setTenantForm({...tenantForm, name:e.target.value})}/></div>
                      <div className="form-group"><label>Admin Email</label><input type="email" onChange={e=>setTenantForm({...tenantForm, email:e.target.value})}/></div>
                      <div className="form-group"><label>Plan</label><select onChange={e=>setTenantForm({...tenantForm, plan:e.target.value})}><option>STANDARD</option><option>ENTERPRISE</option></select></div>
                  </div>
                  <div style={{textAlign:'right', marginTop:'20px'}}><button className="btn-primary" onClick={handleCreateTenant}>Create</button></div>
              </div>
          </div>
      )}
    </div>
  );
}