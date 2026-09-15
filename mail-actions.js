// Customer mail actions: each email type can be sent only once per order.
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
    const label = thanks ? "מייל תודה ואישור הזמנה" : "מייל השלמת הזמנה";
    if (!email) return alert("ללקוח הזה לא שמורה כתובת אימייל.");
    if (alreadySent(order, type)) return alert(`${label} כבר סומן כנשלח להזמנה זו.`);
    if (!confirm(`לשלוח עכשיו ${label} ל-${firstName(customer.name)} (${email})?\n\nלאחר השליחה הכפתור יינעל כדי למנוע שליחה כפולה.`)) return;

    const oldHtml = button.innerHTML;
    button.disabled = true;
    button.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> שולח...';
    try {
      const body = new URLSearchParams({
        email,
        name: String(customer.name || ""),
        type,
        shippingMethod: String(order.shippingMethod || "איסוף עצמי"),
        orderId: String(order.orderId || "")
      });
      await fetch(APPS_SCRIPT_URL, {
        method: "POST",
        mode: "no-cors",
        headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
        body: body.toString()
      });
      if (typeof window.markCustomerEmailSent === "function") await window.markCustomerEmailSent(order._docId, type);
      button.innerHTML = '<i class="fa-solid fa-circle-check"></i> נשלח';
      button.disabled = true;
      button.style.opacity = ".78";
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
    button.className = `btn customer-mail-btn ${thanks ? "thanks-mail-btn" : "followup-mail-btn"}`;
    if (sent) {
      button.style.cssText = "padding:7px 10px;font-size:.72rem;white-space:nowrap;background:#eef2ef;color:#5d6b61;border:1px solid #cbd4cd;border-radius:7px;cursor:default";
      button.innerHTML = thanks ? '<i class="fa-solid fa-circle-check"></i> מייל תודה נשלח' : '<i class="fa-solid fa-circle-check"></i> מייל השלמה נשלח';
      button.disabled = true;
    } else {
      button.style.cssText = thanks
        ? "padding:7px 10px;font-size:.72rem;white-space:nowrap;background:#16784b;color:#fff;border:1px solid #0f613b;border-radius:7px"
        : "padding:7px 10px;font-size:.72rem;white-space:nowrap;background:#fff0e8;color:#a53a16;border:1px solid #efb99f;border-radius:7px";
      button.innerHTML = thanks ? '<i class="fa-solid fa-gift"></i> מייל תודה / אושר' : '<i class="fa-solid fa-envelope-open-text"></i> מייל השלמת הזמנה';
      button.disabled = !email;
      if (!email) button.style.opacity = ".45";
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
