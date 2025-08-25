// ⏱️ مدة الجلسة (ثواني)
const LOGIN_TIMEOUT = 3600; // ساعة

async function setupLoginGuard() {
  const section = getSectionName();
  const loggedInKey = `loggedInAt_${section}`;
  const loggedInAt = sessionStorage.getItem(loggedInKey);

  // ✅ فحص إذا كان في تسجيل خروج معلّق
  if (sessionStorage.getItem("logoutPending") === "true") {
    sessionStorage.removeItem("logoutPending");
    sessionStorage.removeItem(loggedInKey);
    alert("✅ تم تسجيل الخروج بنجاح، الرجاء إعادة تسجيل الدخول");
  }

  const pageContent = document.getElementById("pageContent");
  if (pageContent) pageContent.style.display = "none";

  if (loggedInAt) {
    const now = Date.now();
    const diff = (now - parseInt(loggedInAt, 10)) / 1000;
    if (diff < LOGIN_TIMEOUT) {
      if (pageContent) pageContent.style.display = "block";
      return;
    }
  }

  // 🛑 لا جلسة → عرض المودال
  const container = document.createElement("div");
  document.body.appendChild(container);
  const res = await fetch("login-modal.html");
  const html = await res.text();
  container.innerHTML = html;

  const passwordModalEl = document.getElementById("passwordModal");
  const passwordModal = new bootstrap.Modal(passwordModalEl,{backdrop:"static",keyboard:false});
  passwordModal.show();

  const passwordInput = document.getElementById("dashboardPassword");
  passwordModalEl.addEventListener("shown.bs.modal", () => passwordInput.focus());

  async function verifyPassword() {
    const password = passwordInput.value;
    const res = await fetch("/api/verify-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ section, password })
    });

    if (res.status === 200) {
      sessionStorage.setItem(loggedInKey, Date.now().toString());
      passwordModal.hide();
      if (pageContent) pageContent.style.display = "block";
    } else {
      alert("❌ كلمة المرور غير صحيحة");
      passwordInput.value = "";
      passwordInput.focus();
    }
  }

  document.getElementById("confirmDashboardAccess").addEventListener("click", verifyPassword);
  passwordInput.addEventListener("keydown", e => { if(e.key==="Enter") verifyPassword(); });
}

// 🔹 تحديد القسم حسب الصفحة
function getSectionName() {
  const path = window.location.pathname;
  if (path.includes("dashboard.html")) return "dashboard";
  if (path.includes("links.html")) return "links";
  if (path.includes("viewlinks.html")) return "viewlinks";
  if (path.includes("backups.html")) return "backups";
  if (path.includes("add.html")) return "add";
  if (path.includes("passwords.html")) return "passwords";
  if (path.includes("edit.html")) return "edit";
  if (path === "/" || path.endsWith("index.html")) return "index";
  return "general";
}

document.addEventListener("DOMContentLoaded", setupLoginGuard);
