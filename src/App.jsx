import React, { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';
import './style.css';

export default function App() {
  const [session, setSession] = useState(null);

  useEffect(() => {
    // 1. Check if user is already logged in
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    // 2. Listen for login/logout events
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  // IF NO SESSION -> SHOW LOGIN SCREEN
  if (!session) {
    return <LoginScreen />;
  }

  // IF SESSION EXISTS -> SHOW MAIN APP
  return <MainApp session={session} />;
}

// --- COMPONENT: LOGIN SCREEN ---
function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function handleLogin(e) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) setError(error.message);
    setLoading(false);
  }

  return (
    <div style={{ height: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center', background: '#f1f5f9' }}>
      <div style={{ background: 'white', padding: '40px', borderRadius: '10px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)', width: '100%', maxWidth: '400px' }}>
        <h2 style={{ textAlign: 'center', color: '#1e293b', marginBottom: '20px' }}>🏥 CarePlus Login</h2>
        
        {error && <div style={{ background: '#fee2e2', color: '#b91c1c', padding: '10px', borderRadius: '6px', marginBottom: '15px', fontSize: '0.9em' }}>{error}</div>}

        <form onSubmit={handleLogin}>
          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500' }}>Email</label>
            <input 
              type="email" 
              required
              value={email} 
              onChange={(e) => setEmail(e.target.value)}
              style={{ width: '100%', padding: '10px', border: '1px solid #cbd5e1', borderRadius: '6px' }}
              placeholder="admin@careplus.com"
            />
          </div>
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500' }}>Password</label>
            <input 
              type="password" 
              required
              value={password} 
              onChange={(e) => setPassword(e.target.value)}
              style={{ width: '100%', padding: '10px', border: '1px solid #cbd5e1', borderRadius: '6px' }}
              placeholder="••••••••"
            />
          </div>
          <button 
            type="submit" 
            disabled={loading}
            style={{ width: '100%', padding: '12px', background: '#2563eb', color: 'white', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}
          >
            {loading ? 'Signing In...' : 'Sign In'}
          </button>
        </form>
        <div style={{ textAlign: 'center', marginTop: '20px', fontSize: '0.8em', color: '#64748b' }}>
          Authorized Personnel Only
        </div>
      </div>
    </div>
  );
}

// --- COMPONENT: MAIN POS APP (The code we built earlier) ---
function MainApp({ session }) {
  const [activeTab, setActiveTab] = useState('pos'); 
  const [medicines, setMedicines] = useState([]);
  const [customers, setCustomers] = useState([]); 
  const [cart, setCart] = useState([]); 
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState(null); 
  const [customerSearch, setCustomerSearch] = useState("");
  const [showCustList, setShowCustList] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [notification, setNotification] = useState({ message: '', type: '', visible: false });
  const [showReceipt, setShowReceipt] = useState(false);
  const [lastInvoice, setLastInvoice] = useState(null);
  const [stats, setStats] = useState({ revenue: 0, transactions: 0, lowStock: 0 });
  const [recentInvoices, setRecentInvoices] = useState([]);

  useEffect(() => {
    fetchData();
    if (activeTab === 'dashboard') fetchDashboardData();
  }, [activeTab]);

  function showToast(message, type = 'success') {
    setNotification({ message, type, visible: true });
    setTimeout(() => setNotification(prev => ({ ...prev, visible: false })), 3000);
  }

  async function handleLogout() {
    await supabase.auth.signOut();
  }

  async function fetchData() {
    const { data: prods } = await supabase
      .from('products')
      .select(`*, product_batches (id, batch_number, expiry_date, sale_price, inventory ( id, quantity_boxes ))`)
      .order('name');
    if (prods) setMedicines(prods);

    const { data: custs } = await supabase.from('customers').select('*').limit(20);
    if (custs) setCustomers(custs);
  }

  async function fetchDashboardData() {
    const { data: sales } = await supabase.from('invoices').select('*').order('created_at', { ascending: false }).limit(50);
    const todayStr = new Date().toISOString().split('T')[0];
    const safeSales = sales || [];
    const todaysSales = safeSales.filter(inv => inv.created_at && inv.created_at.startsWith(todayStr));
    const totalRev = todaysSales.reduce((sum, inv) => sum + (inv.final_amount_paid || 0), 0);
    const { data: lowStockItems } = await supabase.from('inventory').select('id').lt('quantity_boxes', 5);
    
    setStats({ revenue: totalRev, transactions: todaysSales.length, lowStock: lowStockItems?.length || 0 });
    setRecentInvoices(safeSales);
  }

  function addToCart(product, batch, inventoryId, currentStock) {
    if (currentStock <= 0) return showToast("❌ Out of Stock!", "error");
    const today = new Date().toISOString().split('T')[0];
    if (batch.expiry_date < today) return showToast(`⛔ EXPIRED ITEM! (Exp: ${batch.expiry_date})`, "error");

    const interactions = product.interaction_data || []; 
    const conflict = cart.find(cartItem => interactions.includes(cartItem.name) || cartItem.interactionData?.includes(product.name));

    if (conflict) showToast(`⚠️ INTERACTION ALERT: ${product.name} conflicts with ${conflict.name}!`, "error");
    else if (!cart.find(item => item.batchId === batch.id)) showToast(`🛒 Added ${product.name}`);

    setCart(prev => {
      const existing = prev.find(item => item.batchId === batch.id);
      if (existing && existing.qty + 1 > currentStock) { showToast("⚠️ Stock limit reached!", "error"); return prev; }
      if (existing) return prev.map(item => item.batchId === batch.id ? { ...item, qty: item.qty + 1 } : item);
      return [...prev, { productId: product.id, name: product.name, interactionData: product.interaction_data || [], batchId: batch.id, batchNumber: batch.batch_number, inventoryId: inventoryId, price: batch.sale_price, qty: 1 }];
    });
  }

  function removeFromCart(batchId) { setCart(prev => prev.filter(item => item.batchId !== batchId)); }

  async function handleCheckout() {
    if (cart.length === 0) return showToast("⚠️ Cart is empty!", "error");
    setProcessing(true);
    const cartTotal = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
    try {
      const { data: invoice, error: invError } = await supabase.from('invoices').insert([{ total_amount: cartTotal, final_amount_paid: cartTotal, customer_id: selectedCustomer ? selectedCustomer.id : null, status: 'COMPLETED' }]).select().single();
      if (invError) throw invError;
      for (const item of cart) {
        await supabase.from('invoice_items').insert([{ invoice_id: invoice.id, batch_id: item.batchId, quantity: item.qty, unit_price: item.price, line_total: item.price * item.qty }]);
        const { data: currentInv } = await supabase.from('inventory').select('quantity_boxes').eq('id', item.inventoryId).single();
        await supabase.from('inventory').update({ quantity_boxes: currentInv.quantity_boxes - item.qty }).eq('id', item.inventoryId);
      }
      setLastInvoice({ id: invoice.id, date: new Date().toLocaleString(), items: [...cart], total: cartTotal, customer: selectedCustomer ? selectedCustomer.full_name : "Walk-in Customer" });
      setShowReceipt(true); setCart([]); setSelectedCustomer(null); setCustomerSearch(""); fetchData(); 
    } catch (error) { showToast("❌ Checkout Failed: " + error.message, "error"); } finally { setProcessing(false); }
  }

  const filteredMedicines = medicines.filter(m => m.name.toLowerCase().includes(searchTerm.toLowerCase()));
  const filteredCustomers = customers.filter(c => c.full_name.toLowerCase().includes(customerSearch.toLowerCase()));
  const cartTotal = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <div className="nav-bar">
        <div style={{ fontWeight: 'bold', fontSize: '1.2rem', marginRight: '20px' }}>🏥 CarePlus</div>
        <div className={`nav-item ${activeTab === 'pos' ? 'active' : ''}`} onClick={() => setActiveTab('pos')}>POS Terminal</div>
        <div className={`nav-item ${activeTab === 'dashboard' ? 'active' : ''}`} onClick={() => setActiveTab('dashboard')}>Manager Dashboard</div>
        <div style={{ flex: 1 }}></div>
        <button onClick={handleLogout} style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.3)', color: 'white', padding: '5px 10px', borderRadius: '4px', cursor: 'pointer' }}>Sign Out</button>
      </div>

      <div style={{ flex: 1, overflow: 'hidden' }}>
        {activeTab === 'dashboard' && (
          <div className="dashboard-container" style={{ overflowY: 'auto', height: '100%' }}>
            <h2>📊 Today's Performance</h2>
            <div className="stats-grid">
              <div className="stat-card money"><div className="stat-label">Total Revenue</div><div className="stat-value" style={{ color: '#10b981' }}>${stats.revenue.toFixed(2)}</div></div>
              <div className="stat-card blue"><div className="stat-label">Transactions</div><div className="stat-value">{stats.transactions}</div></div>
              <div className="stat-card danger"><div className="stat-label">Low Stock Items</div><div className="stat-value" style={{ color: '#ef4444' }}>{stats.lowStock}</div></div>
            </div>
            <h3>Recent Invoices</h3>
            <table className="med-table">
              <thead><tr><th>Invoice ID</th><th>Time</th><th>Amount</th><th>Status</th></tr></thead>
              <tbody>{recentInvoices.map(inv => (<tr key={inv.id}><td>#{inv.id.slice(0,8)}</td><td>{inv.created_at ? new Date(inv.created_at).toLocaleTimeString() : 'N/A'}</td><td style={{ fontWeight: 'bold' }}>${inv.final_amount_paid}</td><td><span className="batch-badge">{inv.status}</span></td></tr>))}</tbody>
            </table>
          </div>
        )}
        {activeTab === 'pos' && (
          <div className="pos-container">
            <div className={`toast-container ${notification.visible ? 'show' : ''} ${notification.type === 'error' ? 'error' : ''}`}>{notification.message}</div>
            {showReceipt && lastInvoice && (
              <div className="modal-overlay"><div className="receipt-paper"><div className="receipt-header"><h3>CAREPLUS PHARMACY</h3><small>Riyadh Branch - #10293</small><br/><small>VAT No: 300012345600003</small></div><div className="receipt-body"><div>Date: {lastInvoice.date}</div><div>Inv #: {lastInvoice.id.slice(0,8)}</div><div>Cust: {lastInvoice.customer}</div><div className="receipt-divider"></div>{lastInvoice.items.map((item, idx) => (<div key={idx} className="receipt-row"><span>{item.qty}x {item.name.substring(0,15)}</span><span>{(item.price * item.qty).toFixed(2)}</span></div>))}<div className="receipt-divider"></div><div className="receipt-row" style={{fontWeight: 'bold'}}><span>TOTAL</span><span>${lastInvoice.total.toFixed(2)}</span></div></div><div className="receipt-footer"><div className="qr-placeholder">[ ZATCA QR CODE ]</div><p><small>Thank you for your visit!</small></p><button className="close-receipt-btn" onClick={() => setShowReceipt(false)}>Print & Close</button></div></div></div>
            )}
            <div className="product-panel">
              <div className="header"><h2>🛒 Catalog</h2></div>
              <input type="text" className="search-bar" placeholder="🔍 Scan barcode..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
              <div className="product-grid">{filteredMedicines.map(med => med.product_batches?.map(batch => { const stock = batch.inventory?.[0]?.quantity_boxes || 0; const invId = batch.inventory?.[0]?.id; return (<div key={batch.id} className={`product-card ${stock === 0 ? 'out-stock' : ''}`} onClick={() => addToCart(med, batch, invId, stock)}><div style={{fontWeight: 'bold'}}>{med.name}</div><div style={{fontSize: '0.9em', color: '#64748b'}}>{med.strength}</div><div className="batch-badge">{batch.batch_number}</div><div style={{marginTop: '10px', display: 'flex', justifyContent: 'space-between'}}><span style={{fontWeight: 'bold', color: '#2563eb'}}>${batch.sale_price}</span><span style={{color: stock < 5 ? 'red' : 'green'}}>{stock} left</span></div></div>) }))}</div>
            </div>
            <div className="cart-panel">
              <div className="cart-header"><h3>Current Order</h3></div>
              <div style={{ padding: '15px', borderBottom: '1px solid #e2e8f0', position: 'relative' }}>{selectedCustomer ? (<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#ecfdf5', padding: '10px', borderRadius: '6px', border: '1px solid #10b981' }}><div><div style={{fontWeight: 'bold', color: '#065f46'}}>👤 {selectedCustomer.full_name}</div></div><button onClick={() => setSelectedCustomer(null)} style={{background: 'none', border: 'none', cursor: 'pointer'}}>✕</button></div>) : (<><input type="text" placeholder="Find Patient..." style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1' }} value={customerSearch} onChange={(e) => { setCustomerSearch(e.target.value); setShowCustList(true); }} />{showCustList && customerSearch && (<div style={{ position: 'absolute', top: '55px', left: '15px', right: '15px', background: 'white', border: '1px solid #e2e8f0', borderRadius: '6px', zIndex: 10 }}>{filteredCustomers.map(c => (<div key={c.id} style={{ padding: '10px', cursor: 'pointer' }} onClick={() => { setSelectedCustomer(c); setShowCustList(false); setCustomerSearch(""); }}><strong>{c.full_name}</strong></div>))}</div>)}</>)}</div>
              <div className="cart-items">{cart.map(item => (<div key={item.batchId} className="cart-item"><div><strong>{item.name}</strong></div><div style={{display: 'flex', alignItems: 'center'}}><span style={{marginRight: '10px'}}>x{item.qty}</span><strong>${(item.price * item.qty).toFixed(2)}</strong><button className="remove-btn" onClick={() => removeFromCart(item.batchId)}>×</button></div></div>))}</div>
              <div className="cart-footer"><div className="total-row"><span>Total</span><span>${cartTotal.toFixed(2)}</span></div><button className="pay-btn" disabled={cart.length === 0 || processing} onClick={handleCheckout}>{processing ? "Processing..." : "Pay Now (F12)"}</button></div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}