// Adds a Gmail follow-up button to every order row that has an email address.
// The draft is opened in Gmail with the customer's email, first name, subject and body pre-filled.
(function () {
  const SUBJECT = "נשאר רק להשלים את ההזמנה שלך | שוק ארבעת המינים";

  function firstName(fullName) {
    return String(fullName || "").trim().split(/\s+/)[0] || "לקוח יקר";
  }

  function buildBody(name) {
    return `שלום ${firstName(name)},

שמנו לב שהתחלת לבצע הזמנה באתר שוק ארבעת המינים, אך ההזמנה עדיין לא הושלמה.

יכול להיות שפשוט לא הספקת לסיים, ויכול להיות שנתקלת בבעיה בתהליך התשלום — אנחנו כאן כדי לעזור.

הסט שבחרת עדיין מחכה לך

ארבעת המינים מהודרים, שירות אישי ומשלוחים לכל הארץ.

[להשלמת ההזמנה]

נתקלת בבעיה או שיש לך שאלה?
אפשר לפנות אלינו ישירות בוואטסאפ ונשמח לסייע בהשלמת ההזמנה.

[דברו איתנו בוואטסאפ]

בברכת חג סוכות שמח,
שוק ארבעת המינים

אם כבר השלמת את ההזמנה, אפשר להתעלם מהודעה זו.`;
  }

  function openGmail(order) {
    const customer = order && order.customer ? order.customer : {};
    const email = String(customer.email || "").trim();
    if (!email) {
      alert("ללקוח הזה לא שמורה כתובת אימייל.");
      return;
    }
    const url = "https://mail.google.com/mail/?view=cm&fs=1"
      + "&to=" + encodeURIComponent(email)
      + "&su=" + encodeURIComponent(SUBJECT)
      + "&body=" + encodeURIComponent(buildBody(customer.name));
    window.open(url, "_blank", "noopener");
  }

  function addButtons() {
    const body = document.getElementById("ordersBody");
    if (!body || typeof window.getFilteredOrders !== "function") return;
    const rows = Array.from(body.querySelectorAll("tr"));
    const orders = window.getFilteredOrders();
    rows.forEach((row, index) => {
      const order = orders[index];
      if (!order || row.querySelector(".gmail-followup-btn")) return;
      const actions = row.querySelector(".row-actions");
      if (!actions) return;
      const email = String(order.customer?.email || "").trim();
      const button = document.createElement("button");
      button.type = "button";
      button.className = "btn btn-ghost gmail-followup-btn";
      button.style.cssText = "padding:6px 8px;font-size:.72rem;white-space:nowrap;color:#b42323";
      button.innerHTML = '<i class="fa-solid fa-envelope"></i> מייל השלמת הזמנה';
      button.title = email ? `פתיחת Gmail אל ${email}` : "אין כתובת אימייל ללקוח";
      button.disabled = !email;
      if (!email) button.style.opacity = ".45";
      button.addEventListener("click", () => openGmail(order));
      actions.prepend(button);
    });
  }

  window.openCustomerFollowupGmail = openGmail;

  const observer = new MutationObserver(() => addButtons());
  function start() {
    const body = document.getElementById("ordersBody");
    if (!body) return setTimeout(start, 100);
    observer.observe(body, { childList: true, subtree: true });
    addButtons();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
