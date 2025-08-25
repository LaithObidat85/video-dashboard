// ⏱️ مدة الجلسة (ثواني)
const LOGIN_TIMEOUT = 3600; // ساعة

// ✅ دالة Toast عامة
function showToast(message, type = "success") {
  let icon = type === "success" ? "✅" : type === "danger" ? "❌" : "ℹ️";

  let container = document.getElementById("toastContainer");
  if (!container) {
    container = document.createElement("div");
    container.id = "toastContainer";
    container.className = "toast-container position-fixed top-0 start-50 translate-middle-x p-3";
    container.style.zIndex = "9999";
    document.body.appendChild(container);
  }

  const toast = document.createElement("div");
  toast.className = `toast align-items-center text-bg-${type} border-0 mb-2`;
  toast.setAttribute("role", "alert");
  toast.innerHTML = `
    <div class="d-flex">
      <div class="toast-body">${icon} ${message}</div>
      <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
    </div>`;
  container.appendChild(toast);

  new bootstrap.Toast(toast, { delay: 2500 }).show();
}

async function setupLoginGuard() {
  const section = getSectionName();
  const loggedInKey = `loggedInAt_${section}`;
  const loggedInAt = sessionStorage.getItem(loggedInKey);

  // ✅ فحص إذا كان في تسجيل خروج معلّق
  if (sessionStorage.getItem("logoutPending") === "true") {
    sessionStorage.removeItem("logoutPending");
    sessionStorage.removeItem(loggedInKey);
    showToast("✅ تم تسجيل الخروج بنجاح، الرجاء إعادة تسجيل الدخول", "success");
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
      showToast("✅ تم تسجيل الدخول بنجاح", "success");
    } else {
      showToast("❌ كلمة المرور غير صحيحة", "danger");
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
