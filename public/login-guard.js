// ⏱️ المدة المسموح بها قبل إعادة طلب كلمة المرور (بالثواني)
const LOGIN_TIMEOUT = 3600; // 60 دقيقة  

// ✅ دالة Toast مدمجة
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

  // ✅ أخفي المحتوى من البداية
  const pageContent = document.getElementById("pageContent");
  if (pageContent) pageContent.style.display = "none";

  if (loggedInAt) {
    const now = Date.now();
    const diff = (now - parseInt(loggedInAt, 10)) / 1000;
    if (diff < LOGIN_TIMEOUT) {
      // ✅ دخول صالح → أظهر المحتوى
      if (pageContent) {
        pageContent.style.display = "block";
        if (typeof hideOverlay === "function") hideOverlay(); // ← إخفاء شاشة التحميل
        if (typeof loadPasswords === "function") {
          loadPasswords(); // ⬅️ تحميل كلمات المرور إذا كنا في passwords.html
        }
      }
      return;
    }
  }

  // 🛑 إذا لا توجد جلسة → أظهر المودال
  const container = document.createElement("div");
  document.body.appendChild(container);

  const res = await fetch("login-modal.html");
  const html = await res.text();
  container.innerHTML = html;

  const passwordModalEl = document.getElementById("passwordModal");
  const passwordModal = new bootstrap.Modal(passwordModalEl, {
    backdrop: "static",
    keyboard: false
  });
  passwordModal.show();

  // ✅ إخفاء شاشة التحميل بمجرد عرض المودال
  if (typeof hideOverlay === "function") hideOverlay();

  // إخفاء زر الإغلاق العلوي ✖
  document.querySelectorAll("#passwordModal .btn-close")
    .forEach(btn => btn.style.display = "none");

  // زر إلغاء → إذا كنت في index يخفي المودال فقط + Toast، غير ذلك يرجعك للرئيسية
  const cancelBtn = document.querySelector("#passwordModal .btn-secondary");
  if (cancelBtn) {
    cancelBtn.addEventListener("click", () => {
      if (getSectionName() === "index") {
        const modalInstance = bootstrap.Modal.getInstance(passwordModalEl);
        if (modalInstance) {
          modalInstance.hide(); // ✅ يغلق المودال بشكل صحيح
          showToast("ℹ️ تم إلغاء تسجيل الدخول", "info");
        }
      } else {
        window.location.href = "index.html"; 
      }
    });
  }

  const passwordInput = document.getElementById("dashboardPassword");

  passwordModalEl.addEventListener("shown.bs.modal", () => {
    passwordInput.focus();
  });

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

      // ✅ إظهار المحتوى بعد تسجيل الدخول
      if (pageContent) {
        pageContent.style.display = "block";
        if (typeof hideOverlay === "function") hideOverlay(); 
        if (typeof loadPasswords === "function") {
          loadPasswords();
        }
      }
    } else {
      showToast("❌ كلمة المرور غير صحيحة", "danger");
      passwordInput.value = "";
      passwordInput.focus();
    }
  }

  document.getElementById("confirmDashboardAccess")
    .addEventListener("click", verifyPassword);

  passwordInput.addEventListener("keydown", function (e) {
    if (e.key === "Enter") verifyPassword();
  });
}

// 🔹 دالة تحدد اسم القسم حسب الصفحة
function getSectionName() {
  const path = window.location.pathname;

  if (path.includes("dashboard.html")) return "dashboard";
  if (path.includes("links.html")) return "links";
  if (path.includes("viewlinks.html")) return "viewlinks";
  if (path.includes("backups.html")) return "backups";
  if (path.includes("add.html")) return "add";
  if (path.includes("passwords.html")) return "passwords";
  if (path.includes("edit.html")) return "edit";
  if (path === "/" || path.endsWith("index.html") || window.location.hash) return "index";

  return "general";
}

// ✅ عند تحميل الصفحة نفذ الحماية
document.addEventListener("DOMContentLoaded", setupLoginGuard);
