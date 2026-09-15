// Customer mail actions: compact buttons; each email type can be sent only once per order.
(function () {
  const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwIxSZe91CJl7c-u0ndDJlFThxR3kSKtABnF6KFh2lqPIiNvaFufJonI6egPtsplbd-/exec";

  function firstName(fullName) { return String(fullName || "").trim().split(/\s+/)[0] || "לקוח יקר"; }
  function isPaid(order) {
    const s = String(order?.paymentStatus || "").toLowerCase();
    return order?.paid === true || ["paid","paid_client_return","approved","success"].includes(s) || ["paid","delivered"].includes(String(order?.adminStatus || "").toLowerCase());
  }
  function alreadySent(order, type) { return type === "thanks" ? order?.thanksEmailSent === true : order?.followupEmailSent === true; }

  async function sendMail(order, button, type) {
    const customer = order?.customer || {};
    const email = String(customer.email || "").trim();
    const thanks = type === "thanks";
    const label = thanks ? "מייל תודה" : "מייל השלמה";
    if (!email) return alert("ללקוח הזה לא שמורה כתובת אימייל.");
    if (alreadySent(order, type)) return alert(`${label} כבר נשלח להזמנה זו ולא ניתן לשלוח אותו שוב.`);
    if (!confirm(`לשלוח עכשיו ${label} ל-${firstName(customer.name)} (${email})?\nלאחר השליחה לא יהיה ניתן לשלוח אותו שוב.`)) return;

    const oldHtml = button.innerHTML;
    button.disabled = true;
    button.textContent = "שולח...";
    try {
      const body = new URLSearchParams({ email, name: String(customer.name || ""), type, shippingMethod: String(order.shippingMethod || "איסוף עצמי"), orderId: String(order.orderId || "") });
      await fetch(APPS_SCRIPT_URL, { method: "POST", mode: "no-cors", headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" }, body: body.toString() });
      if (typeof window.markCustomerEmailSent === "function") await window.markCustomerEmailSent(order._docId, type);
      button.textContent = thanks ? "תודה נשלח" : "השלמה נשלח";
      button.disabled = true;
      button.style.opacity = ".58";
    } catch (err) {
      console.error("Customer email error:", err);
      button.disabled = false;
      button.innerHTML = oldHtml;
      alert("לא הצלחנו להשלים את פעולת השליחה. נסה שוב.");
    }
  }

  function makeButton(order, type) {
    const email = String(order.customer?.email || "").trim();
    const thanks = type === "thanks";
    const sent = alreadySent(order, type);
    const button = document.createElement("button");
    button.type = "button";
    button.className = `customer-mail-btn ${thanks ? "thanks-mail-btn" : "followup-mail-btn"}`;
    button.style.cssText = "padding:2px 5px;font-size:.58rem;line-height:1.2;min-height:20px;white-space:nowrap;border-radius:4px;font-family:inherit;font-weight:700;cursor:pointer;box-shadow:none";
    if (sent) {
      button.style.cssText += ";background:#f1f3f1;color:#7a847d;border:1px solid #d6ddd8;cursor:default;opacity:.62";
      button.textContent = thanks ? "תודה נשלח" : "השלמה נשלח";
      button.disabled = true;
    } else {
      button.style.cssText += thanks
        ? ";background:#e9f7ee;color:#17663e;border:1px solid #a9d5b9"
        : ";background:#fff3ec;color:#98411f;border:1px solid #e8bea9";
      button.textContent = thanks ? "מייל תודה" : "מייל השלמה";
      button.disabled = !email;
      if (!email) button.style.opacity = ".4";
      button.addEventListener("click", () => sendMail(order, button, type));
    }
    return button;
  }

  function addButtons() {
    const body = document.getElementById("ordersBody");
    if (!body || typeof window.getFilteredOrders !== "function") return;
    const rows = Array.from(body.querySelectorAll("tr"));
    const orders = window.getFilteredOrders();
    rows.forEach((row, index) => {
      const order = orders[index];
      if (!order) return;
      const actions = row.querySelector(".row-actions");
      if (!actions) return;
      actions.style.gap = "3px";
      actions.style.flexWrap = "wrap";
      if (!actions.querySelector(".followup-mail-btn")) actions.prepend(makeButton(order, "followup"));
      if (isPaid(order) && !actions.querySelector(".thanks-mail-btn")) actions.prepend(makeButton(order, "thanks"));
    });
  }

  const observer = new MutationObserver(addButtons);
  function start() {
    const body = document.getElementById("ordersBody");
    if (!body) return setTimeout(start, 100);
    observer.observe(body, { childList: true, subtree: true });
    addButtons();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
})();
