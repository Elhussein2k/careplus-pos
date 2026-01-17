import React, { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';
import * as XLSX from 'xlsx'; 
import { GoogleGenerativeAI } from "@google/generative-ai"; 
// Import Icons
import { LayoutDashboard, ShoppingCart, Package, Users, LogOut, Search, Bell, Plus, Pencil, Trash2, FileText, RotateCcw, User, X, Upload, Printer, Check, AlertTriangle, Info } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';
import './style.css'; 

// --- 🔑 CONFIG ---
const GEMINI_API_KEY = "YOUR_GEMINI_API_KEY_HERE"; 

export default function App() {
  const [session, setSession] = useState(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => setSession(session));
    return () => subscription.unsubscribe();
  }, []);

  if (!session) return <LoginScreen />;
  return <MainApp session={session} />;
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
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setError(error.message);
    setLoading(false);
  }

  return (
    <div style={{ height: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center', background: '#f1f5f9' }}>
      <div style={{ background: 'white', padding: '40px', borderRadius: '12px', width: '100%', maxWidth: '400px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}>
        <h2 style={{ textAlign: 'center', color: '#1c2434', marginBottom: '20px', fontWeight: 'bold' }}>💊 CarePlus Admin</h2>
        {error && <div style={{ background: '#fee2e2', color: '#b91c1c', padding: '10px', borderRadius: '6px', marginBottom: '15px' }}>{error}</div>}
        <form onSubmit={handleLogin}>
          <div style={{marginBottom: '15px'}}><label style={{display:'block', marginBottom:'5px', fontWeight:'500'}}>Email</label><input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} style={{ width: '100%', padding: '12px', border: '1px solid #e2e8f0', borderRadius: '6px', outline: 'none' }} placeholder="admin@careplus.com" /></div>
          <div style={{marginBottom: '25px'}}><label style={{display:'block', marginBottom:'5px', fontWeight:'500'}}>Password</label><input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} style={{ width: '100%', padding: '12px', border: '1px solid #e2e8f0', borderRadius: '6px', outline: 'none' }} placeholder="••••••••" /></div>
          <button type="submit" disabled={loading} style={{ width: '100%', padding: '12px', background: '#3c50e0', color: 'white', border: 'none', borderRadius: '6px', fontWeight: '600', cursor: 'pointer' }}>{loading ? 'Signing In...' : 'Sign In'}</button>
        </form>
      </div>
    </div>
  );
}

// --- 🚀 MAIN APP LAYOUT ---
function MainApp({ session }) {
  const [activeTab, setActiveTab] = useState('pos'); 
  const [medicines, setMedicines] = useState([]);
  const [customers, setCustomers] = useState([]); 
  const [cart, setCart] = useState([]); 
  const [globalSearch, setGlobalSearch] = useState(""); 
  
  // App States
  const [selectedCustomer, setSelectedCustomer] = useState(null); 
  const [customerSearch, setCustomerSearch] = useState("");
  const [showCustList, setShowCustList] = useState(false);
  const [recentInvoices, setRecentInvoices] = useState([]);
  const [showReturnsModal, setShowReturnsModal] = useState(false);
  const [expandedInvoice, setExpandedInvoice] = useState(null);
  const [invoiceItems, setInvoiceItems] = useState([]);
  const [stats, setStats] = useState({ revenue: 0, transactions: 0, lowStock: 0 });
  const [chartData, setChartData] = useState([]); 
  
  // Upload & Batch States
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0); 
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [batchProduct, setBatchProduct] = useState(null);
  const [batchForm, setBatchForm] = useState({ id: null, batchNumber: '', expiry: '', cost: '', price: '', qty: '' });
  
  // Receipt State
  const [showReceipt, setShowReceipt] = useState(false);
  const [lastInvoice, setLastInvoice] = useState(null);

  // --- 🔔 CUSTOM ALERT SYSTEM (Replaces window.alert) ---
  const [alertState, setAlertState] = useState({ show: false, title: '', message: '', type: 'info', onConfirm: null });

  function showAlert(title, message, type = 'info', onConfirm = null) {
    setAlertState({ show: true, title, message, type, onConfirm });
  }
  function closeAlert() {
    setAlertState({ ...alertState, show: false });
  }
  function confirmAlert() {
    if (alertState.onConfirm) alertState.onConfirm();
    closeAlert();
  }

  useEffect(() => {
    fetchAllData();
    fetchDashboardData();
  }, []);

  async function handleLogout() { await supabase.auth.signOut(); }

  // --- DATA FETCHING ---
  async function fetchAllData() {
    let allProducts = [];
    let from = 0;
    const step = 1000;
    while (true) {
        const { data, error } = await supabase.from('products').select(`*, product_batches (id, batch_number, expiry_date, sale_price, cost_price, inventory ( id, quantity_boxes ))`).order('name').range(from, from + step - 1);
        if (error || !data || data.length === 0) break;
        allProducts = [...allProducts, ...data];
        if (data.length < step) break;
        from += step;
    }
    setMedicines(allProducts);
    const { data: custs } = await supabase.from('customers').select('*').limit(50);
    if (custs) setCustomers(custs);
  }

  async function fetchDashboardData() {
    const { data: sales } = await supabase.from('invoices').select('*').order('created_at', { ascending: false }).limit(50);
    if (!sales) return;
    const today = new Date();
    const todaysSales = sales.filter(inv => new Date(inv.created_at).toDateString() === today.toDateString());
    const totalRev = todaysSales.reduce((sum, inv) => sum + (inv.final_amount_paid || 0), 0);
    const { data: lowStockItems } = await supabase.from('inventory').select('id').lt('quantity_boxes', 5);
    setStats({ revenue: totalRev, transactions: todaysSales.length, lowStock: lowStockItems?.length || 0 });
    setRecentInvoices(sales);
    setChartData([{name:'Mon',sales:4000},{name:'Tue',sales:3000},{name:'Wed',sales:5000},{name:'Thu',sales:2780},{name:'Fri',sales:1890},{name:'Sat',sales:6390},{name:'Sun',sales:3490}]);
  }

  // --- 🧠 AI CHECKER ---
  async function checkDrugInteractions(newProduct, currentCart) {
    const newActive = newProduct.generic_name || newProduct.name;
    const currentActives = currentCart.map(item => item.generic_name || item.name);
    if (currentActives.length === 0) return null;

    const prompt = `Act as a clinical pharmacist. Patient taking: ${currentActives.join(', ')}. Adding: "${newActive}". Check for SEVERE interactions. If severe (life threatening), start with "WARNING:". Else say "Safe".`;
    try {
       const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
       const model = genAI.getGenerativeModel({ model: "gemini-pro"});
       const result = await model.generateContent(prompt);
       const text = (await result.response).text();
       if (text.startsWith("WARNING")) return text;
       return null; 
    } catch (error) { return null; }
  }

  // --- POS LOGIC (With New Alert System) ---
  async function addToCart(product, batch, inventoryId, currentStock) {
    if (currentStock <= 0) return showAlert("Out of Stock", "This item has no inventory left.", "error");
    const today = new Date().toISOString().split('T')[0];
    if (batch.expiry_date < today) return showAlert("Expired Item", "This batch has expired and cannot be sold.", "error");

    const olderBatch = product.product_batches.find(b => b.id !== batch.id && b.expiry_date < batch.expiry_date && b.expiry_date > today && (b.inventory?.[0]?.quantity_boxes || 0) > 0);
    
    // Define the final add logic
    const executeAdd = async () => {
        // AI Check
        if (GEMINI_API_KEY && GEMINI_API_KEY !== "YOUR_GEMINI_API_KEY_HERE") {
            const warning = await checkDrugInteractions(product, cart);
            if (warning) {
                showAlert("AI Safety Alert", warning, "confirm", () => performCartUpdate());
                return;
            }
        }
        performCartUpdate();
    };

    const performCartUpdate = () => {
        setCart(prev => {
            const existing = prev.find(item => item.batchId === batch.id);
            if (existing && existing.qty + 1 > currentStock) { showAlert("Limit Reached", "You cannot add more than available stock.", "error"); return prev; }
            if (existing) return prev.map(item => item.batchId === batch.id ? { ...item, qty: item.qty + 1 } : item);
            return [...prev, { productId: product.id, name: product.name, generic_name: product.generic_name, batchId: batch.id, price: batch.sale_price, expiry: batch.expiry_date, qty: 1 }];
        });
    };

    // FIFO Warning
    if (olderBatch) {
       showAlert("FIFO Warning", `An older batch exists (Exp: ${olderBatch.expiry_date}). Sell this one anyway?`, "confirm", executeAdd);
    } else {
       executeAdd();
    }
  }

  function removeFromCart(batchId) { setCart(prev => prev.filter(item => item.batchId !== batchId)); }
  
  async function handleCheckout() {
    if (cart.length === 0) return showAlert("Empty Cart", "Please add items before checkout.", "error");
    const total = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
    
    const { data: inv } = await supabase.from('invoices').insert([{ total_amount: total, final_amount_paid: total, customer_id: selectedCustomer?.id || null, status: 'COMPLETED' }]).select().single();
    for (const item of cart) {
        await supabase.from('invoice_items').insert([{ invoice_id: inv.id, batch_id: item.batchId, quantity: item.qty, unit_price: item.price, line_total: item.price * item.qty }]);
        const { data: curr } = await supabase.from('inventory').select('id, quantity_boxes').eq('batch_id', item.batchId).single();
        if (curr) await supabase.from('inventory').update({ quantity_boxes: curr.quantity_boxes - item.qty }).eq('id', curr.id);
    }

    setLastInvoice({ id: inv.id, date: new Date().toLocaleString(), customer: selectedCustomer ? selectedCustomer.full_name : "Walk-in Customer", items: [...cart], total: total });
    setShowReceipt(true);
    setCart([]); setSelectedCustomer(null); fetchAllData(); fetchDashboardData();
  }

  // --- RETURNS LOGIC ---
  async function handleExpandInvoice(invoiceId) {
      if (expandedInvoice === invoiceId) { setExpandedInvoice(null); return; }
      const { data } = await supabase.from('invoice_items').select(`*, product_batches(product:products(name), batch_number)`).eq('invoice_id', invoiceId);
      setInvoiceItems(data || []);
      setExpandedInvoice(invoiceId);
  }

  async function handleRefundItem(invoiceId, item) {
      showAlert("Confirm Return", `Refund ${item.product_batches.product.name}? This will restock the item and deduct revenue.`, "confirm", async () => {
          try {
              const { data: inv } = await supabase.from('inventory').select('id, quantity_boxes').eq('batch_id', item.batch_id).single();
              if (inv) await supabase.from('inventory').update({ quantity_boxes: inv.quantity_boxes + 1 }).eq('id', inv.id);
              await supabase.from('invoices').insert([{ total_amount: -Math.abs(item.unit_price), final_amount_paid: -Math.abs(item.unit_price), status: 'REFUNDED' }]);
              showAlert("Success", "Refund processed successfully.", "success");
              fetchAllData(); fetchDashboardData(); setShowReturnsModal(false);
          } catch (err) { showAlert("Error", err.message, "error"); }
      });
  }

  // --- UPLOAD LOGIC ---
  async function handleFileUpload(event) {
    const file = event.target.files[0]; if (!file) return; setUploading(true); setUploadProgress(0);
    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            const data = new Uint8Array(e.target.result); const workbook = XLSX.read(data, { type: 'array' });
            const sheet = workbook.Sheets[workbook.SheetNames[0]]; const rawRows = XLSX.utils.sheet_to_json(sheet, { header: 1 });
            let headerRowIndex = -1;
            for(let i=0; i<30; i++) { if(JSON.stringify(rawRows[i]).toLowerCase().includes("trade name")) { headerRowIndex = i; break; } }
            if (headerRowIndex === -1) throw new Error("Header not found");
            const rows = XLSX.utils.sheet_to_json(sheet, { range: headerRowIndex });
            const tenantId = '11111111-1111-1111-1111-111111111111';
            const { data: existingProds } = await supabase.from('products').select('id, name');
            const productMap = new Map(); if (existingProds) existingProds.forEach(p => productMap.set(p.name.toLowerCase().trim(), p.id));
            const { data: cats } = await supabase.from('categories').select('id').eq('name', 'General Import').maybeSingle();
            let categoryId = cats?.id; if (!categoryId) { const { data: newCat } = await supabase.from('categories').insert([{ tenant_id: tenantId, name: 'General Import', description: 'Bulk' }]).select().single(); categoryId = newCat.id; }
            
            const CHUNK_SIZE = 50; let inserted = 0; let updated = 0; const totalRows = rows.length;
            
            for (let i = 0; i < totalRows; i += CHUNK_SIZE) {
                const chunk = rows.slice(i, i + CHUNK_SIZE); const inserts = []; const updates = [];
                chunk.forEach(row => {
                    const getVal = (keys) => { for (let k of Object.keys(row)) { for (let kw of keys) { if (k.toLowerCase().replace(/[^a-z0-9]/g, '').includes(kw.toLowerCase().replace(/[^a-z0-9]/g, ''))) return row[k]; } } return null; };
                    let name = getVal(['Trade Name', 'Product Name']); const generic = getVal(['Scientific Name', 'Generic name']); if (!name && generic) name = generic; if (!name) return;
                    const pData = { tenant_id: tenantId, category_id: categoryId, name, generic_name: generic || null, manufacturer: getVal(['Manufacturer']) || null, strength: getVal(['Strength']) || null, registration_number: getVal(['Register Number']) || null, package_size: getVal(['Package Size']) || null, public_price: getVal(['Price']) ? parseFloat(String(getVal(['Price'])).replace(/[^\d.]/g, '')) : null };
                    if (productMap.has(name.toLowerCase().trim())) updates.push({...pData, id: productMap.get(name.toLowerCase().trim())}); else inserts.push(pData);
                });
                if (inserts.length) { await supabase.from('products').insert(inserts); inserted += inserts.length; }
                if (updates.length) { await Promise.all(updates.map(u => supabase.from('products').update(u).eq('id', u.id))); updated += updates.length; }
                setUploadProgress(Math.min(Math.round(((i + CHUNK_SIZE) / totalRows) * 100), 100));
            }
            showAlert("Upload Complete", `Sync Successful.\nNew Items: ${inserted}\nUpdated Items: ${updated}`, "success");
            fetchAllData(); setUploading(false);
        } catch (err) { showAlert("Upload Failed", err.message, "error"); setUploading(false); }
    };
    reader.readAsArrayBuffer(file);
  }

  function openBatchModal(p) { setBatchProduct(p); setBatchForm({ id: null, batchNumber: `BN-${Math.floor(Math.random()*10000)}`, expiry: '', cost: '', price: p.public_price || '', qty: '' }); setShowBatchModal(true); }
  function editBatch(b) { setBatchForm({ id: b.id, batchNumber: b.batch_number, expiry: b.expiry_date, cost: b.cost_price, price: b.sale_price, qty: b.inventory?.[0]?.quantity_boxes || 0 }); setShowBatchModal(true); }
  async function handleSaveBatch() {
      if(!batchForm.expiry || !batchForm.price || !batchForm.qty) return showAlert("Missing Info", "Please fill all fields.", "error");
      try {
          const tenantId = '11111111-1111-1111-1111-111111111111';
          if (batchForm.id) {
              await supabase.from('product_batches').update({ batch_number: batchForm.batchNumber, expiry_date: batchForm.expiry, sale_price: batchForm.price, cost_price: batchForm.cost }).eq('id', batchForm.id);
              const { data: inv } = await supabase.from('inventory').select('id').eq('batch_id', batchForm.id).single();
              if (inv) await supabase.from('inventory').update({ quantity_boxes: batchForm.qty }).eq('id', inv.id);
          } else {
              const { data: b } = await supabase.from('product_batches').insert([{ tenant_id: tenantId, product_id: batchProduct.id, batch_number: batchForm.batchNumber, expiry_date: batchForm.expiry, cost_price: batchForm.cost || 0, sale_price: batchForm.price }]).select().single();
              await supabase.from('inventory').insert([{ tenant_id: tenantId, batch_id: b.id, quantity_boxes: batchForm.qty, quantity_units: 0 }]);
          }
          showAlert("Success", "Stock updated successfully.", "success"); setShowBatchModal(false); fetchAllData();
      } catch (e) { showAlert("Error", e.message, "error"); }
  }

  // Filters
  const filteredPOS = medicines.filter(m => m.name.toLowerCase().includes(globalSearch.toLowerCase()));
  const filteredInventory = medicines.filter(m => m.name.toLowerCase().includes(globalSearch.toLowerCase()));
  const filteredCustomers = customers.filter(c => c.full_name.toLowerCase().includes(customerSearch.toLowerCase()));
  const cartTotal = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);

  return (
    <div className="app-layout">
      {/* SIDEBAR */}
      <aside className="sidebar">
        <div className="logo-area"><span style={{color:'#3c50e0'}}>💊</span> CarePlus</div>
        <nav className="nav-links">
          <div className={`nav-item ${activeTab === 'dashboard' ? 'active' : ''}`} onClick={() => setActiveTab('dashboard')}><LayoutDashboard size={20} className="nav-icon"/> Dashboard</div>
          <div className={`nav-item ${activeTab === 'pos' ? 'active' : ''}`} onClick={() => setActiveTab('pos')}><ShoppingCart size={20} className="nav-icon"/> POS Terminal</div>
          <div className={`nav-item ${activeTab === 'inventory' ? 'active' : ''}`} onClick={() => setActiveTab('inventory')}><Package size={20} className="nav-icon"/> Inventory</div>
          <div className="nav-item"><Users size={20} className="nav-icon"/> Customers</div>
        </nav>
        <div style={{padding: '20px'}}><div className="nav-item" onClick={handleLogout} style={{color: '#ef4444'}}><LogOut size={20} className="nav-icon"/> Sign Out</div></div>
      </aside>

      {/* MAIN CONTENT */}
      <main className="main-content">
        <header className="top-bar">
          <div className="search-wrapper">
            <Search size={18} color="#64748b"/>
            <input className="search-input" placeholder="Search medicines..." value={globalSearch} onChange={(e) => setGlobalSearch(e.target.value)} />
          </div>
          <div style={{display:'flex', gap:'20px', alignItems:'center'}}>
            <button className="btn-primary" style={{background:'var(--warning)'}} onClick={() => setShowReturnsModal(true)}>
               <RotateCcw size={18} /> Returns
            </button>
            <div style={{textAlign:'right'}}><div style={{fontSize:'0.9rem', fontWeight:'600'}}>Thomas Anree</div><div style={{fontSize:'0.75rem', color:'#64748b'}}>Pharmacist</div></div>
            <div style={{width:40, height:40, background:'#e2e8f0', borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center'}}>👤</div>
          </div>
        </header>

        <div className="content-scroll">
          
          {/* DASHBOARD */}
          {activeTab === 'dashboard' && (
            <div className="stats-grid">
               <div className="stat-card"><div>Revenue</div><h2>${stats.revenue.toFixed(2)}</h2></div>
               <div className="stat-card"><div>Transactions</div><h2>{stats.transactions}</h2></div>
               <div className="stat-card"><div>Low Stock</div><h2 style={{color:'red'}}>{stats.lowStock}</h2></div>
            </div>
          )}

          {/* INVENTORY TABLE */}
          {activeTab === 'inventory' && (
             <>
               <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'1.5rem'}}>
                  <h2>Inventory List</h2>
                  <div style={{display:'flex', gap:'10px', alignItems:'center'}}>
                     {uploading && <span style={{fontSize:'0.8rem', color:'#3c50e0', fontWeight:'bold'}}>Processing... {uploadProgress}%</span>}
                     <button className="btn-primary" onClick={() => document.getElementById('upload').click()}><Upload size={18}/> Import Excel</button>
                     <input id="upload" type="file" hidden accept=".xlsx" onChange={handleFileUpload} />
                  </div>
               </div>
               
               {/* PROGRESS BAR */}
               {uploading && (
                  <div className="progress-container">
                     <div className="progress-fill" style={{width: `${uploadProgress}%`}}>{uploadProgress}%</div>
                  </div>
               )}

               <div className="table-container" style={{marginTop:'15px'}}>
                 <table className="modern-table">
                   <thead><tr><th>Product Name</th><th>Generic</th><th>Price</th><th>Stock Status</th><th>Action</th></tr></thead>
                   <tbody>
                     {filteredInventory.slice(0, 100).map(m => {
                        const hasStock = m.product_batches?.some(b => b.inventory?.[0]?.quantity_boxes > 0);
                        return (
                         <tr key={m.id}>
                           <td><div style={{fontWeight:'600'}}>{m.name}</div><div style={{fontSize:'0.8rem', color:'#64748b'}}>{m.registration_number || 'N/A'}</div></td>
                           <td>{m.generic_name || '-'}</td>
                           <td style={{fontWeight:'bold'}}>${m.public_price}</td>
                           <td>{hasStock ? <span className="status-badge status-active">In Stock</span> : <span className="status-badge status-danger">Out of Stock</span>}</td>
                           <td>
                             <div style={{display:'flex'}}>
                               <button className="action-btn btn-edit" onClick={() => openBatchModal(m)}><Pencil size={16} /></button>
                               <button className="action-btn btn-delete"><Trash2 size={16} /></button>
                             </div>
                           </td>
                         </tr>
                        )
                     })}
                   </tbody>
                 </table>
               </div>
             </>
          )}

          {/* POS TERMINAL */}
          {activeTab === 'pos' && (
             <div className="pos-layout">
                <div className="pos-products">
                   <div style={{marginBottom:'15px', fontWeight:'bold', fontSize:'1.1rem'}}>Select Products</div>
                   <div className="product-grid">
                      {filteredPOS.slice(0, 100).map(med => med.product_batches?.map(batch => {
                         const stock = batch.inventory?.[0]?.quantity_boxes || 0;
                         return (
                           <div key={batch.id} className={`product-card ${stock === 0 ? 'out-stock' : ''}`} onClick={() => addToCart(med, batch, null, stock)}>
                              <div style={{fontWeight:'bold', fontSize:'0.95rem'}}>{med.name.substring(0, 25)}...</div>
                              <div style={{fontSize:'0.85rem', color:'#64748b'}}>{med.generic_name?.substring(0, 20)}</div>
                              <div className="batch-tag">{batch.batch_number}</div>
                              <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginTop:'10px'}}>
                                 <span className="price-tag">${batch.sale_price}</span>
                                 <span style={{fontSize:'0.8rem', color: stock < 10 ? 'red' : 'green'}}>{stock} Left</span>
                              </div>
                           </div>
                         )
                      }))}
                   </div>
                </div>

                <div className="pos-cart">
                   <div className="pos-customer-section">
                      {selectedCustomer ? (
                         <div className="selected-customer-card">
                            <span style={{display:'flex', alignItems:'center', gap:'8px'}}><User size={18}/> {selectedCustomer.full_name}</span>
                            <button onClick={() => setSelectedCustomer(null)} style={{background:'none', border:'none', cursor:'pointer', color:'#ef4444'}}><X size={18}/></button>
                         </div>
                      ) : (
                         <div className="customer-search-box">
                            <Search size={16} color="#94a3b8"/>
                            <input placeholder="Search Customer..." value={customerSearch} onChange={(e) => {setCustomerSearch(e.target.value); setShowCustList(true)}} />
                            {showCustList && customerSearch && (
                               <div className="customer-dropdown">
                                  {filteredCustomers.map(c => (
                                     <div key={c.id} className="customer-item" onClick={() => {setSelectedCustomer(c); setShowCustList(false); setCustomerSearch("")}}>
                                        {c.full_name} <span style={{fontSize:'0.8rem', color:'#94a3b8'}}>({c.phone})</span>
                                     </div>
                                  ))}
                               </div>
                            )}
                         </div>
                      )}
                   </div>

                   <div className="cart-header">Current Order</div>
                   <div className="cart-items">
                      {cart.length === 0 ? <div style={{textAlign:'center', padding:'20px', color:'#94a3b8'}}>Cart is empty</div> : 
                        cart.map(item => (
                          <div key={item.batchId} className="cart-item">
                             <div><div style={{fontWeight:'600'}}>{item.name.substring(0,15)}...</div><div style={{fontSize:'0.8rem', color:'#64748b'}}>${item.price} x {item.qty}</div></div>
                             <div style={{fontWeight:'bold'}}>${(item.price * item.qty).toFixed(2)}</div>
                          </div>
                        ))
                      }
                   </div>
                   <div className="cart-footer">
                      <div style={{display:'flex', justifyContent:'space-between', marginBottom:'10px', fontSize:'1.1rem', fontWeight:'bold'}}>
                         <span>Total</span><span>${cartTotal.toFixed(2)}</span>
                      </div>
                      <button className="pay-btn" onClick={handleCheckout} disabled={cart.length === 0}>Pay Now (F12)</button>
                   </div>
                </div>
             </div>
          )}

        </div>
      </main>

      {/* --- CUSTOM ALERT SYSTEM --- */}
      {alertState.show && (
        <div className="alert-overlay">
           <div className="alert-box">
              <div className={`alert-icon icon-${alertState.type === 'error' ? 'error' : alertState.type === 'success' ? 'success' : 'confirm'}`}>
                 {alertState.type === 'error' ? <AlertTriangle/> : alertState.type === 'success' ? <Check/> : <Info/>}
              </div>
              <div className="alert-title">{alertState.title}</div>
              <div className="alert-message">{alertState.message}</div>
              <div className="alert-actions">
                 {alertState.type === 'confirm' && <button className="btn-alert btn-cancel" onClick={closeAlert}>Cancel</button>}
                 <button className="btn-alert btn-confirm" onClick={confirmAlert}>{alertState.type === 'confirm' ? 'Confirm' : 'OK'}</button>
              </div>
           </div>
        </div>
      )}

      {/* --- RECEIPT MODAL --- */}
      {showReceipt && lastInvoice && (
        <div className="modal-overlay receipt-overlay">
           <div className="receipt-paper">
              <div className="receipt-header">
                 <div className="receipt-logo">🏥 CarePlus</div>
                 <div className="receipt-info">Riyadh Branch - #10293</div>
                 <div className="receipt-info">VAT No: 300012345600003</div>
                 <div className="receipt-info">{lastInvoice.date}</div>
              </div>
              <div className="receipt-divider"></div>
              <div style={{marginBottom:'10px'}}>
                 <div><strong>Inv #:</strong> {lastInvoice.id.slice(0,8)}</div>
                 <div><strong>Cust:</strong> {lastInvoice.customer}</div>
              </div>
              <div className="receipt-divider"></div>
              {lastInvoice.items.map((item, i) => (
                 <div key={i} className="receipt-item-row">
                    <span>{item.qty}x {item.name.substring(0,18)}</span>
                    <span>{(item.price * item.qty).toFixed(2)}</span>
                 </div>
              ))}
              <div className="receipt-divider"></div>
              <div className="receipt-total-row">
                 <span>TOTAL</span>
                 <span>${lastInvoice.total.toFixed(2)}</span>
              </div>
              <div className="receipt-footer">
                 <div className="qr-box">[ QR CODE ]</div>
                 <div style={{fontSize:'0.7rem'}}>Thank you for your visit!</div>
              </div>
              <div style={{textAlign:'center', marginTop:'20px'}} className="close-receipt-btn">
                 <button onClick={() => window.print()} className="btn-primary" style={{display:'inline-flex', marginRight:'10px'}}><Printer size={16}/> Print</button>
                 <button onClick={() => setShowReceipt(false)} style={{padding:'10px', border:'none', background:'#eee', borderRadius:'6px', cursor:'pointer'}}>Close</button>
              </div>
           </div>
        </div>
      )}

      {/* --- RETURNS MODAL --- */}
      {showReturnsModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{width:'600px'}}>
             <div style={{display:'flex', justifyContent:'space-between', marginBottom:'20px'}}>
                <h3>Returns Manager</h3>
                <button onClick={() => setShowReturnsModal(false)} style={{border:'none', background:'none', cursor:'pointer'}}><X/></button>
             </div>
             <div style={{maxHeight:'400px', overflowY:'auto'}}>
                {recentInvoices.map(inv => (
                   <div key={inv.id}>
                      <div className="invoice-row" onClick={() => handleExpandInvoice(inv.id)}>
                         <span>Inv #{inv.id.slice(0,8)}</span>
                         <span>{new Date(inv.created_at).toLocaleDateString()}</span>
                         <span style={{fontWeight:'bold', color: inv.total_amount < 0 ? 'red' : 'green'}}>${inv.total_amount}</span>
                      </div>
                      {expandedInvoice === inv.id && (
                         <div className="invoice-details">
                            {invoiceItems.map(item => (
                               <div key={item.id} className="return-item-row">
                                  <span>{item.product_batches?.product?.name || "Unknown"} (x{item.quantity})</span>
                                  <button className="btn-refund" onClick={() => handleRefundItem(inv.id, item)}>Refund</button>
                               </div>
                            ))}
                         </div>
                      )}
                   </div>
                ))}
             </div>
          </div>
        </div>
      )}

      {/* --- STOCK MODAL --- */}
      {showBatchModal && (
        <div className="modal-overlay">
          <div className="modal-content">
             <h3>Manage Stock: {batchProduct?.name}</h3>
             <div style={{background: '#f8fafc', padding: '15px', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '20px'}}>
                <h4 style={{marginTop: 0, color: '#334155'}}>{batchForm.id ? '✏️ Edit Batch' : '➕ Add New Batch'}</h4>
                <div style={{marginBottom: '10px'}}><label style={{display:'block', fontSize:'0.8rem', color:'#64748b'}}>Batch Number</label><input type="text" value={batchForm.batchNumber} onChange={e => setBatchForm({...batchForm, batchNumber: e.target.value})} style={{width: '100%', padding: '6px', border: '1px solid #cbd5e1', borderRadius: '4px'}} /></div>
                <div style={{display:'flex', gap:'10px', marginBottom:'10px'}}><div style={{flex: 1}}><label style={{display:'block', fontSize:'0.8rem', color:'#64748b'}}>Expiry</label><input type="date" value={batchForm.expiry} onChange={e => setBatchForm({...batchForm, expiry: e.target.value})} style={{width: '100%', padding: '6px', border: '1px solid #cbd5e1', borderRadius: '4px'}} /></div><div style={{flex: 1}}><label style={{display:'block', fontSize:'0.8rem', color:'#64748b'}}>Quantity</label><input type="number" value={batchForm.qty} onChange={e => setBatchForm({...batchForm, qty: e.target.value})} style={{width: '100%', padding: '6px', border: '1px solid #cbd5e1', borderRadius: '4px'}} /></div></div>
                <div style={{display:'flex', gap:'10px', marginBottom:'10px'}}><div style={{flex: 1}}><label style={{display:'block', fontSize:'0.8rem', color:'#64748b'}}>Cost</label><input type="number" value={batchForm.cost} onChange={e => setBatchForm({...batchForm, cost: e.target.value})} style={{width: '100%', padding: '6px', border: '1px solid #cbd5e1', borderRadius: '4px'}} /></div><div style={{flex: 1}}><label style={{display:'block', fontSize:'0.8rem', color:'#64748b'}}>Sale Price</label><input type="number" value={batchForm.price} onChange={e => setBatchForm({...batchForm, price: e.target.value})} style={{width: '100%', padding: '6px', border: '1px solid #cbd5e1', borderRadius: '4px'}} /></div></div>
                <div style={{textAlign:'right'}}><button className="btn-primary" onClick={handleSaveBatch}>Save Changes</button></div>
             </div>
             <div style={{marginTop:'20px', textAlign:'right'}}>
               <button onClick={() => setShowBatchModal(false)} style={{marginLeft:'10px', padding:'10px', border:'none', background:'none', cursor:'pointer'}}>Cancel</button>
             </div>
          </div>
        </div>
      )}

    </div>
  );
}