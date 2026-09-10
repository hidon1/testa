const UNIT_PRICE = 130;
const DELIVERY_PRICE = 45;
const PRODUCT_CATALOG = {
  sef: { id: 1, sku: "SEF-001", name: "סט ספרדי מהודר", shortName: "סט ספרדי" },
  ash: { id: 2, sku: "ASH-001", name: "סט אשכנזי מהודר", shortName: "סט אשכנזי" },
  yem: { id: 3, sku: "YEM-001", name: "סט ספרדי עם אתרוג תימני", shortName: "סט עם אתרוג תימני" }
};

let editingUnknownItems = [];
let toastTimer;

function byId(id) {
  return document.getElementById(id);
}

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, character => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  }[character]));
}

function numberValue(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function normalizeItems(order) {
  const rawItems = Array.isArray(order.items) && order.items.length
    ? order.items
    : [{
        id: order.productId,
        sku: order.sku,
        name: order.etrogType || order.product || order.productType || order.type || order["סוג אתרוג"] || "סט ארבעת המינים",
        qty: order.quantity || order.qty || 1,
        price: order.price || UNIT_PRICE
      }];

  return rawItems.map(item => ({
    id: item.id,
    sku: String(item.sku || ""),
    name: String(item.name || item.productName || item.type || "סט ארבעת המינים"),
    qty: Math.max(1, numberValue(item.qty ?? item.quantity, 1)),
    price: Math.max(0, numberValue(item.price, UNIT_PRICE))
  }));
}

function productKey(item) {
  const sku = String(item?.sku || "").toUpperCase();
  const name = String(item?.name || item || "");
  if (sku.startsWith("YEM") || name.includes("תימני")) return "yem";
  if (sku.startsWith("ASH") || name.includes("אשכנז")) return "ash";
  if (sku.startsWith("SEF") || name.includes("ספרדי")) return "sef";
  return "other";
}

function qty(order) {
  return normalizeItems(order).reduce((sum, item) => sum + item.qty, 0);
}

function productSearchText(order) {
  return normalizeItems(order).map(item => `${item.name} ${item.sku}`).join(" ");
}

function productSummaryText(order) {
  return normalizeItems(order).map(item => `${item.name} × ${item.qty}`).join(" | ");
}

function totalForOrder(order) {
  const savedTotal = Number(order.totalPrice);
  if (Number.isFinite(savedTotal)) return savedTotal;
  const itemsTotal = normalizeItems(order).reduce((sum, item) => sum + item.price * item.qty, 0);
  return itemsTotal + ((order.shippingMethod || "איסוף עצמי") === "משלוח" ? DELIVERY_PRICE : 0);
}

function formatDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "-" : date.toLocaleString("he-IL");
}

function paymentState(order) {
  const status = String(order.paymentStatus || "").toLowerCase();
  const paid = order.paid === true || ["paid", "paid_client_return", "approved", "success"].includes(status);
  if (paid) return { key: "paid", label: "שולם", icon: "fa-circle-check", attemptFailed: false };
  const attemptFailed = ["payment_failed", "failed", "failure", "declined", "cancelled"].includes(status)
    || order.orderStatus === "not_completed"
    || order.lastPaymentAttemptStatus === "failed";
  return { key: "pending", label: "ממתין לתשלום", icon: "fa-clock", attemptFailed };
}

function orderMatchesProduct(order, key) {
  return key === "all" || normalizeItems(order).some(item => productKey(item) === key);
}

function getFilteredOrders() {
  const term = byId("search").value.trim().toLowerCase();
  const payment = byId("paymentFilter").value;
  const product = byId("productFilter").value;
  const shipping = byId("shippingFilter").value;

  return (window.orders || []).filter(order => {
    const customer = order.customer || {};
    const state = paymentState(order);
    const searchable = [
      order.receiptNumber,
      order.orderId,
      customer.name,
      customer.phone,
      customer.email,
      customer.city,
      productSearchText(order)
    ].some(value => String(value || "").toLowerCase().includes(term));

    return (!term || searchable)
      && (payment === "all" || state.key === payment)
      && orderMatchesProduct(order, product)
      && (shipping === "all" || (order.shippingMethod || "איסוף עצמי") === shipping);
  });
}

function clearFilters() {
  byId("search").value = "";
  byId("paymentFilter").value = "all";
  byId("productFilter").value = "all";
  byId("shippingFilter").value = "all";
  render();
}

function setProductFilter(key) {
  const select = byId("productFilter");
  select.value = select.value === key ? "all" : key;
  render();
}

function sameDay(value, comparison = new Date()) {
  if (!value) return false;
  const date = new Date(value);
  return !Number.isNaN(date.getTime()) && date.toDateString() === comparison.toDateString();
}

function countProductUnits(orders, key) {
  return orders.reduce((total, order) => total + normalizeItems(order)
    .filter(item => productKey(item) === key)
    .reduce((sum, item) => sum + item.qty, 0), 0);
}

function renderProductLines(order) {
  return `<div class="product-lines">${normalizeItems(order).map(item => `
    <div class="product-line"><span>${esc(item.name)}</span><strong>× ${item.qty}</strong></div>
  `).join("")}</div>`;
}

async function togglePaid(id, current, button) {
  button.disabled = true;
  try {
    await window.setPaid(id, !current);
    showToast(!current ? "ההזמנה סומנה כשולמה" : "ההזמנה הוחזרה לממתין לתשלום");
  } catch (error) {
    console.error(error);
    alert("לא ניתן היה לעדכן את מצב התשלום.");
  } finally {
    button.disabled = false;
  }
}

function render() {
  const allOrders = window.orders || [];
  const filteredOrders = getFilteredOrders();
  const states = allOrders.map(paymentState);
  const activeProduct = byId("productFilter").value;

  byId("totalOrders").textContent = allOrders.length;
  byId("todayOrders").textContent = allOrders.filter(order => sameDay(order.date || order.createdAt)).length;
  byId("totalUnits").textContent = allOrders.reduce((sum, order) => sum + qty(order), 0);
  byId("paidCount").textContent = states.filter(state => state.key === "paid").length;
  byId("pendingCount").textContent = states.filter(state => state.key === "pending").length;
  byId("sefUnits").textContent = countProductUnits(allOrders, "sef");
  byId("ashUnits").textContent = countProductUnits(allOrders, "ash");
  byId("yemUnits").textContent = countProductUnits(allOrders, "yem");
  document.querySelectorAll(".product-stat").forEach(card => card.classList.toggle("active", card.dataset.productKey === activeProduct));
  byId("visibleCount").textContent = `מציג ${filteredOrders.length} מתוך ${allOrders.length}`;

  byId("ordersBody").innerHTML = filteredOrders.length ? filteredOrders.map(order => {
    const state = paymentState(order);
    const shipping = order.shippingMethod || "איסוף עצמי";
    const customer = order.customer || {};
    const paid = state.key === "paid";
    const receipt = Number(order.receiptNumber);

    return `<tr>
      <td>
        <span class="receipt-number${receipt ? "" : " no-receipt"}">${receipt ? `#${String(receipt).padStart(3, "0")}` : "טרם הופקה"}</span>
        <div class="receipt-order-id">${esc(order.orderId || "-")}</div>
      </td>
      <td>${esc(formatDate(order.date || order.createdAt))}</td>
      <td><strong>${esc(customer.name || "-")}</strong><div class="mini">${esc(customer.city || "")}</div></td>
      <td>${esc(customer.phone || "-")}<div class="mini">${esc(customer.email || "")}</div></td>
      <td><strong>${qty(order)}</strong></td>
      <td>${renderProductLines(order)}</td>
      <td><span class="badge ${shipping === "משלוח" ? "delivery" : "pickup"}">${esc(shipping)}</span></td>
      <td class="money">₪${totalForOrder(order).toLocaleString("he-IL")}</td>
      <td>
        <div class="pay-state ${state.key}"><i class="fa-solid ${state.icon}"></i>${esc(state.label)}</div>
        ${state.attemptFailed ? '<span class="payment-attempt-note">ניסיון התשלום האחרון לא הושלם</span>' : ""}
        <div style="margin-top:7px"><button class="btn btn-ghost" style="padding:6px 9px;font-size:.78rem" onclick="togglePaid('${esc(order._docId)}',${paid},this)">${paid ? "סמן ממתין לתשלום" : "סמן שולם ידנית"}</button></div>
      </td>
      <td>${esc(customer.notes || order.notes || "-")}</td>
      <td><div class="row-actions">
        <button class="icon-btn" title="עריכת ההזמנה" aria-label="עריכת ההזמנה" onclick="openEditOrder('${esc(order._docId)}')"><i class="fa-solid fa-pen"></i></button>
        <button class="row-delete-btn" onclick="deleteOrder('${esc(order._docId)}')"><i class="fa-solid fa-trash"></i> מחיקה</button>
      </div></td>
    </tr>`;
  }).join("") : '<tr><td class="empty" colspan="11">לא נמצאו הזמנות תואמות.</td></tr>';
}

function exportExcel(allRows) {
  const rows = allRows ? (window.orders || []) : getFilteredOrders();
  if (!rows.length) {
    alert("אין נתונים לייצוא.");
    return;
  }

  const data = rows.map(order => {
    const customer = order.customer || {};
    const state = paymentState(order);
    const items = normalizeItems(order);
    const unitsFor = key => items.filter(item => productKey(item) === key).reduce((sum, item) => sum + item.qty, 0);
    return {
      "מספר קבלה": Number(order.receiptNumber) || "",
      "מספר הזמנה": order.orderId || "",
      "תאריך": formatDate(order.date || order.createdAt),
      "שם לקוח": customer.name || "",
      "טלפון": customer.phone || "",
      "אימייל": customer.email || "",
      "פירוט מוצרים": productSummaryText(order),
      "סט ספרדי": unitsFor("sef"),
      "סט אשכנזי": unitsFor("ash"),
      "סט עם אתרוג תימני": unitsFor("yem"),
      "כמות כוללת": qty(order),
      "אופן קבלה": order.shippingMethod || "איסוף עצמי",
      "עיר": customer.city || "",
      "רחוב": customer.street || "",
      "בית": customer.houseNumber || customer.house || "",
      "דירה": customer.apartmentNumber || customer.apartment || "",
      "סכום": totalForOrder(order),
      "סטטוס תשלום": state.label,
      "הערות": customer.notes || order.notes || ""
    };
  });

  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "הזמנות");
  XLSX.writeFile(workbook, allRows ? "orders-all.xlsx" : "orders-filtered.xlsx");
}

function toLocalInput(value) {
  const date = value ? new Date(value) : new Date();
  const safeDate = Number.isNaN(date.getTime()) ? new Date() : date;
  const pad = number => String(number).padStart(2, "0");
  return `${safeDate.getFullYear()}-${pad(safeDate.getMonth() + 1)}-${pad(safeDate.getDate())}T${pad(safeDate.getHours())}:${pad(safeDate.getMinutes())}`;
}

function setFormQuantities(items) {
  const totals = { sef: 0, ash: 0, yem: 0 };
  editingUnknownItems = [];
  items.forEach(item => {
    const key = productKey(item);
    if (key in totals) totals[key] += item.qty;
    else editingUnknownItems.push(item);
  });
  byId("fQtySef").value = totals.sef;
  byId("fQtyAsh").value = totals.ash;
  byId("fQtyYem").value = totals.yem;
  const unknownNote = byId("unknownItemsNote");
  unknownNote.classList.toggle("visible", editingUnknownItems.length > 0);
  unknownNote.textContent = editingUnknownItems.length ? `פריטים ישנים שנשמרים בהזמנה: ${editingUnknownItems.map(item => `${item.name} × ${item.qty}`).join(", ")}` : "";
}

function getFormItems() {
  const quantities = {
    sef: Math.max(0, numberValue(byId("fQtySef").value)),
    ash: Math.max(0, numberValue(byId("fQtyAsh").value)),
    yem: Math.max(0, numberValue(byId("fQtyYem").value))
  };
  const selectedItems = Object.entries(quantities)
    .filter(([, quantity]) => quantity > 0)
    .map(([key, quantity]) => ({ ...PRODUCT_CATALOG[key], qty: quantity, price: UNIT_PRICE }));
  return [...selectedItems, ...editingUnknownItems];
}

function openNewOrder() {
  byId("orderForm").reset();
  byId("editDocId").value = "";
  byId("editOrderId").value = "";
  setFormQuantities([{ ...PRODUCT_CATALOG.sef, qty: 1, price: UNIT_PRICE }]);
  byId("fDate").value = toLocalInput();
  byId("fShipping").value = "איסוף עצמי";
  byId("fPaid").checked = false;
  toggleAddress();
  refreshFormTotal();
  byId("orderModal").classList.add("active");
}

function openEditOrder(id) {
  const order = (window.orders || []).find(item => item._docId === id);
  if (!order) return;
  const customer = order.customer || {};
  byId("editDocId").value = id;
  byId("editOrderId").value = order.orderId || "";
  byId("fName").value = customer.name || "";
  byId("fPhone").value = customer.phone || "";
  byId("fEmail").value = customer.email || "";
  setFormQuantities(normalizeItems(order));
  byId("fShipping").value = order.shippingMethod || "איסוף עצמי";
  byId("fDate").value = toLocalInput(order.date || order.createdAt);
  byId("fCity").value = customer.city || "";
  byId("fStreet").value = customer.street || "";
  byId("fHouse").value = customer.houseNumber || customer.house || "";
  byId("fApartment").value = customer.apartmentNumber || customer.apartment || "";
  byId("fNotes").value = customer.notes || order.notes || "";
  byId("fPaid").checked = paymentState(order).key === "paid";
  toggleAddress();
  refreshFormTotal();
  byId("orderModal").classList.add("active");
}

function closeOrderModal() {
  byId("orderModal").classList.remove("active");
}

function toggleAddress() {
  document.querySelectorAll(".address").forEach(element => {
    element.style.display = byId("fShipping").value === "משלוח" ? "grid" : "none";
  });
}

function refreshFormTotal() {
  const itemsTotal = getFormItems().reduce((sum, item) => sum + item.qty * item.price, 0);
  const delivery = byId("fShipping").value === "משלוח" ? DELIVERY_PRICE : 0;
  byId("formTotal").textContent = `₪${(itemsTotal + delivery).toLocaleString("he-IL")}`;
}

function manualOrderId() {
  return `MAN-${Date.now()}`;
}

async function saveOrder(event) {
  event.preventDefault();
  const items = getFormItems();
  if (!items.length) {
    alert("יש לבחור לפחות סט אחד.");
    return;
  }
  const shipping = byId("fShipping").value;
  const paid = byId("fPaid").checked;
  const totalPrice = items.reduce((sum, item) => sum + item.qty * item.price, 0) + (shipping === "משלוח" ? DELIVERY_PRICE : 0);
  const payload = {
    orderId: byId("editOrderId").value || manualOrderId(),
    customer: {
      name: byId("fName").value.trim(),
      phone: byId("fPhone").value.trim(),
      email: byId("fEmail").value.trim(),
      notes: byId("fNotes").value.trim(),
      city: byId("fCity").value.trim(),
      street: byId("fStreet").value.trim(),
      houseNumber: byId("fHouse").value.trim(),
      apartmentNumber: byId("fApartment").value.trim()
    },
    items,
    productTypes: items.map(item => item.name),
    productSummary: items.map(item => ({ sku: item.sku, name: item.name, qty: item.qty })),
    paid,
    paymentStatus: paid ? "paid" : "waiting_for_payment",
    orderStatus: paid ? "completed" : "waiting_for_payment",
    shippingMethod: shipping,
    totalPrice,
    date: byId("fDate").value ? new Date(byId("fDate").value).toISOString() : new Date().toISOString(),
    manual: true
  };

  const saveButton = byId("saveOrderBtn");
  saveButton.disabled = true;
  try {
    if (byId("editDocId").value) await window.dbUpdateOrder(byId("editDocId").value, payload);
    else await window.dbCreateOrder(payload);
    closeOrderModal();
    showToast("ההזמנה נשמרה בהצלחה");
  } catch (error) {
    console.error(error);
    alert("לא ניתן היה לשמור את ההזמנה.");
  } finally {
    saveButton.disabled = false;
  }
}

async function deleteOrder(id) {
  if (!confirm("למחוק את שורת ההזמנה הזאת? הפעולה אינה ניתנת לביטול.")) return;
  try {
    await window.dbDeleteOrder(id);
    showToast("שורת ההזמנה נמחקה");
  } catch (error) {
    console.error(error);
    alert("לא ניתן היה למחוק את ההזמנה.");
  }
}

async function resetAllOrders(button) {
  const ids = (window.orders || []).map(order => order._docId).filter(Boolean);
  if (!ids.length) {
    alert("המערכת כבר ריקה.");
    return;
  }
  if (!confirm(`פעולה זו תמחק את כל ${ids.length} ההזמנות מהמערכת. להמשיך?`)) return;
  if (prompt('לאישור סופי, יש לכתוב את המילה "איפוס"') !== "איפוס") {
    alert("האיפוס בוטל.");
    return;
  }
  button.disabled = true;
  try {
    await window.dbDeleteAllOrders(ids);
    showToast("כל ההזמנות נמחקו והמערכת אופסה");
  } catch (error) {
    console.error(error);
    alert("האיפוס לא הושלם. יש לרענן ולבדוק אילו שורות נשארו.");
  } finally {
    button.disabled = false;
  }
}

function showToast(message) {
  const toast = byId("toast");
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 2600);
}

window.render = render;
render();
