from pathlib import Path
p=Path('index.html')
s=p.read_text(encoding='utf-8')
marker='RESET-RECEIPT-NUMBERING-2026-09-03'
if marker in s:
    raise SystemExit(0)

# Header: keep manual order button and add full reset control.
old='<div class="header-actions"><button class="btn btn-primary" onclick="openNewOrder()"><i class="fa-solid fa-plus"></i> הזמנה ידנית חדשה</button></div>'
new='''<div class="header-actions"><button class="btn btn-primary" onclick="openNewOrder()"><i class="fa-solid fa-plus"></i> הזמנה ידנית חדשה</button><button id="resetAllBtn" class="btn btn-danger" onclick="resetAllOrders()" title="מחיקת כל ההזמנות והתחלת המספור מחדש"><i class="fa-solid fa-trash-can-arrow-up"></i> איפוס המערכת</button></div>'''
if old not in s:
    raise SystemExit('header actions pattern not found')
s=s.replace(old,new,1)

# Make first column explicitly receipt/order numbering.
s=s.replace('<th>מספר הזמנה</th><th>תאריך</th>','<th>מס׳ קבלה / הזמנה</th><th>תאריך</th>',1)

# Add visible receipt styling and reset warning styling.
css='''\n    /* RESET-RECEIPT-NUMBERING-2026-09-03 */\n    .receipt-number{display:inline-flex;align-items:center;justify-content:center;min-width:64px;padding:6px 11px;border-radius:999px;background:#153b2a;color:#fff;font-weight:900;font-size:.95rem;letter-spacing:.02em}\n    .receipt-order-id{margin-top:5px;color:var(--muted);font-size:.76rem;font-weight:700}\n    #resetAllBtn{background:#fff1f1;color:#b62f2f;border:1px solid #edc2c2;box-shadow:none}\n    #resetAllBtn:hover{background:#ffe5e5;color:#982222}\n'''
s=s.replace('</style>',css+'\n  </style>',1)

# Add persistent numbering to Firebase module and expose bulk delete.
old_import='import { getFirestore, collection, doc, addDoc, updateDoc, deleteDoc, onSnapshot, query, orderBy } from "https://www.gstatic.com/firebasejs/12.14.0/firebase-firestore.js";'
if old_import not in s:
    raise SystemExit('firebase import pattern not found')

old_snapshot="""  const q=query(collection(db,'orders'),orderBy('date','desc'));
  onSnapshot(q,snap=>{window.orders=snap.docs.map(d=>({_docId:d.id,...d.data()}));window.render()},err=>{console.error(err);document.getElementById('ordersBody').innerHTML='<tr><td class=\"empty\" colspan=\"10\">שגיאה בטעינת הנתונים מ־Firebase.</td></tr>'});
  window.dbCreateOrder=payload=>addDoc(collection(db,'orders'),payload);
  window.dbUpdateOrder=(id,payload)=>updateDoc(doc(db,'orders',id),payload);
  window.dbDeleteOrder=id=>deleteDoc(doc(db,'orders',id));
  window.setPaid=(id,isPaid)=>updateDoc(doc(db,'orders',id),{paid:isPaid,paymentStatus:isPaid?'paid':'unpaid',paidUpdatedAt:new Date().toISOString()});"""
new_snapshot="""  const q=query(collection(db,'orders'),orderBy('date','desc'));
  let receiptNumberingBusy=false;
  async function ensureReceiptNumbers(list){
    if(receiptNumberingBusy)return;
    const missing=[...list].filter(o=>!(Number(o.receiptNumber)>0)).sort((a,b)=>new Date(a.date||0)-new Date(b.date||0));
    if(!missing.length)return;
    receiptNumberingBusy=true;
    try{
      let next=Math.max(0,...list.map(o=>Number(o.receiptNumber)||0))+1;
      for(const o of missing){
        await updateDoc(doc(db,'orders',o._docId),{receiptNumber:next++,receiptAssignedAt:new Date().toISOString()});
      }
    }finally{receiptNumberingBusy=false}
  }
  onSnapshot(q,snap=>{window.orders=snap.docs.map(d=>({_docId:d.id,...d.data()}));window.render();ensureReceiptNumbers(window.orders).catch(console.error)},err=>{console.error(err);document.getElementById('ordersBody').innerHTML='<tr><td class=\"empty\" colspan=\"10\">שגיאה בטעינת הנתונים מ־Firebase.</td></tr>'});
  window.dbCreateOrder=payload=>addDoc(collection(db,'orders'),payload);
  window.dbUpdateOrder=(id,payload)=>updateDoc(doc(db,'orders',id),payload);
  window.dbDeleteOrder=id=>deleteDoc(doc(db,'orders',id));
  window.dbDeleteAllOrders=async()=>{
    const all=[...(window.orders||[])];
    for(let i=0;i<all.length;i+=50){
      const group=all.slice(i,i+50);
      await Promise.all(group.map(o=>deleteDoc(doc(db,'orders',o._docId))));
    }
  };
  window.setPaid=(id,isPaid)=>updateDoc(doc(db,'orders',id),{paid:isPaid,paymentStatus:isPaid?'paid':'unpaid',paidUpdatedAt:new Date().toISOString()});"""
if old_snapshot not in s:
    raise SystemExit('firebase block pattern not found')
s=s.replace(old_snapshot,new_snapshot,1)

# Search by receipt number too.
s=s.replace("const searchOk=!term||[o.orderId,c.name,c.phone,c.city].some", "const searchOk=!term||[o.receiptNumber,o.orderId,c.name,c.phone,c.city].some",1)

# Replace first cell with a clear persistent receipt number and the technical/order id below it.
old_cell='<td class="order-id">${esc(o.orderId||\'-\')}</td>'
new_cell='<td class="order-id"><span class="receipt-number">#${String(Number(o.receiptNumber)||0).padStart(3,\'0\')}</span><div class="receipt-order-id">${esc(o.orderId||\'-\')}</div></td>'
if old_cell not in s:
    raise SystemExit('order cell pattern not found')
s=s.replace(old_cell,new_cell,1)

# Add safe full-system reset function after single-row delete.
needle="""  async function deleteOrder(id){const o=(window.orders||[]).find(x=>x._docId===id);if(!o)return;if(!confirm(`למחוק לצמיתות את ההזמנה ${o.orderId||''}?`))return;try{await window.dbDeleteOrder(id);showToast('ההזמנה נמחקה')}catch(err){console.error(err);alert('לא הצלחנו למחוק את ההזמנה.')}}"""
addition="""
  async function resetAllOrders(){
    const count=(window.orders||[]).length;
    if(!count){alert('אין כרגע הזמנות למחיקה. המערכת כבר ריקה והמספור הבא יתחיל מ־1.');return}
    if(!confirm(`איפוס המערכת ימחק לצמיתות את כל ${count} ההזמנות. האם להמשיך?`))return;
    const approval=prompt('למניעת מחיקה בטעות, הקלד בדיוק: איפוס');
    if(approval!=='איפוס'){alert('האיפוס בוטל. לא נמחק דבר.');return}
    const btn=document.getElementById('resetAllBtn');if(btn){btn.disabled=true;btn.innerHTML='<i class=\"fa-solid fa-spinner fa-spin\"></i> מאפס...'}
    try{
      await window.dbDeleteAllOrders();
      showToast('כל ההזמנות נמחקו. ההזמנה הבאה תקבל קבלה מס׳ 1');
    }catch(err){console.error(err);alert('לא הצלחנו להשלים את איפוס המערכת. נסה שוב.');}
    finally{if(btn){btn.disabled=false;btn.innerHTML='<i class=\"fa-solid fa-trash-can-arrow-up\"></i> איפוס המערכת'}}
  }
"""
if needle not in s:
    raise SystemExit('deleteOrder pattern not found')
s=s.replace(needle,needle+addition,1)

p.write_text(s,encoding='utf-8')
