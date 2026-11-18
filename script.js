"use strict";

const items = document.querySelector("#items");
const template = document.querySelector("#item-template");
const total = document.querySelector("#total");
const discountRate = document.querySelector("#discount-rate");
const vatRate = document.querySelector("#vat-rate");
const currency = document.querySelector("#currency");
const moneyFormatter = new Intl.NumberFormat("ru-RU", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
const draftKey = "smeta-five-minutes-draft-v1";
const senderKey = "smeta-my-details-sender-v1";
document.querySelector("#create-estimate").addEventListener("click", () => {
  document.querySelector('[name="sender"]').focus({ preventScroll: true });
  document.querySelector("#estimate-details").scrollIntoView({
    behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth",
    block: "start"
  });
});
const draftFields = {
  sender: '[name="sender"]',
  recipient: '[name="recipient"]',
  number: '[name="estimate-number"]',
  date: "#estimate-date",
  discount: "#discount-rate",
  vat: "#vat-rate",
  currency: "#currency",
  comment: "#comment"
};
let draftReady = false;
let copyTimer;
let approval = { versions: [], active: null };

function numberFromInput(value) {
  const normalized = value.trim().replace(/[\s\u00a0\u202f]/g, "").replace(",", ".");
  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(normalized)) return 0;
  const number = Number(normalized);
  return Number.isFinite(number) ? number : 0;
}

// Денежные этапы считаем в целых тиынах. Половину округляем от нуля.
function roundedInteger(value) {
  if (!Number.isFinite(value)) return 0;
  const absolute = Math.abs(value);
  const rounded = Math.sign(value) * Math.round(absolute + Number.EPSILON * absolute);
  return Number.isSafeInteger(rounded) ? rounded : 0;
}

function money(value) {
  const rounded = roundedInteger(value * 100) / 100;
  return (rounded === 0 ? "0" : moneyFormatter.format(rounded).replace(/[\u00a0\u202f]/g, " ")) + " " + currency.value;
}

function amountInWords(tiyn) {
  if (currency.value !== "₸" || !Number.isSafeInteger(tiyn) || tiyn <= 0 || tiyn > 99999999900) return "";
  const units = ["", "один", "два", "три", "четыре", "пять", "шесть", "семь", "восемь", "девять"];
  const teens = ["десять", "одиннадцать", "двенадцать", "тринадцать", "четырнадцать", "пятнадцать", "шестнадцать", "семнадцать", "восемнадцать", "девятнадцать"];
  const tens = ["", "", "двадцать", "тридцать", "сорок", "пятьдесят", "шестьдесят", "семьдесят", "восемьдесят", "девяносто"];
  const hundreds = ["", "сто", "двести", "триста", "четыреста", "пятьсот", "шестьсот", "семьсот", "восемьсот", "девятьсот"];
  function form(number, forms) {
    const last100 = number % 100;
    const last10 = number % 10;
    return forms[last100 >= 11 && last100 <= 14 ? 2 : last10 === 1 ? 0 : last10 >= 2 && last10 <= 4 ? 1 : 2];
  }
  function group(number, feminine = false) {
    const words = [hundreds[Math.floor(number / 100)]];
    const rest = number % 100;
    if (rest >= 10 && rest < 20) words.push(teens[rest - 10]);
    else {
      words.push(tens[Math.floor(rest / 10)]);
      const digit = rest % 10;
      words.push(feminine && digit === 1 ? "одна" : feminine && digit === 2 ? "две" : units[digit]);
    }
    return words.filter(Boolean).join(" ");
  }
  const tenge = Math.floor(tiyn / 100);
  const fraction = tiyn % 100;
  const parts = [];
  const millions = Math.floor(tenge / 1000000);
  const thousands = Math.floor(tenge / 1000) % 1000;
  if (millions) parts.push(group(millions), form(millions, ["миллион", "миллиона", "миллионов"]));
  if (thousands) parts.push(group(thousands, true), form(thousands, ["тысяча", "тысячи", "тысяч"]));
  if (tenge % 1000) parts.push(group(tenge % 1000));
  if (!tenge) parts.push("ноль");
  parts.push("тенге");
  if (fraction) parts.push(group(fraction), form(fraction, ["тиын", "тиына", "тиынов"]));
  const result = parts.join(" ");
  return result[0].toUpperCase() + result.slice(1);
}

function recalculate() {
  let sum = 0;
  for (const row of items.rows) {
    const product = numberFromInput(row.querySelector(".quantity").value) * numberFromInput(row.querySelector(".price").value);
    const safeAmount = roundedInteger(product * 100);
    row.querySelector(".amount").textContent = money(safeAmount / 100);
    row.querySelector(".price").setAttribute("aria-label", "Цена, " + currency.value);
    sum += safeAmount;
  }
  if (!Number.isSafeInteger(sum)) sum = 0;
  const discountPercent = numberFromInput(discountRate.value);
  const vatPercent = numberFromInput(vatRate.value);
  const discount = roundedInteger(sum * (discountPercent / 100));
  const discounted = sum - discount;
  const vat = roundedInteger(discounted * (vatPercent / 100));
  document.querySelector("#subtotal").textContent = money(sum / 100);
  document.querySelector("#discount-amount").textContent = money(discount / 100);
  document.querySelector("#discounted-amount").textContent = money(discounted / 100);
  document.querySelector("#vat-amount").textContent = money(vat / 100);
  document.querySelector("#discount-row").hidden = discountPercent === 0;
  document.querySelector("#discounted-row").hidden = discountPercent === 0;
  document.querySelector("#vat-row").hidden = vatPercent === 0;
  const finalTiyn = discounted + vat;
  total.textContent = money(finalTiyn / 100);
  const words = document.querySelector("#total-words");
  words.textContent = amountInWords(finalTiyn);
  words.hidden = !words.textContent;
}

function addItem(focus = true) {
  const row = template.content.firstElementChild.cloneNode(true);
  items.append(row);
  recalculate();
  if (focus) row.querySelector(".item-name").focus();
  saveDraft();
  return row;
}

document.querySelector("#add-item").addEventListener("click", () => addItem());
items.addEventListener("input", recalculate);
discountRate.addEventListener("input", recalculate);
vatRate.addEventListener("input", recalculate);
currency.addEventListener("change", recalculate);
items.addEventListener("click", (event) => {
  const button = event.target.closest(".remove");
  if (!button) return;
  const row = button.closest("tr");
  const nextRow = row.nextElementSibling || row.previousElementSibling;
  row.remove();
  recalculate();
  saveDraft();
  if (nextRow) nextRow.querySelector(".item-name").focus();
  else document.querySelector("#add-item").focus();
});
items.addEventListener("keydown", (event) => {
  if (event.key !== "Enter" || event.isComposing || event.target.tagName !== "INPUT") return;
  if (event.target.closest("tr") === items.lastElementChild) {
    event.preventDefault();
    addItem();
  }
});

const today = new Date();
document.querySelector("#estimate-date").value = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
addItem(false);

function preparePrint() {
  if (document.body.classList.contains("printing-version")) return;
  recalculate();
  saveDraft();
  renderApproval();
  const number = document.querySelector('[name="estimate-number"]').value.trim() || "—";
  const date = document.querySelector("#estimate-date").value;
  const formattedDate = date ? date.split("-").reverse().join(".") : "—";
  document.querySelector("#print-title").textContent = `Смета № ${number} от ${formattedDate}`;

  // Текстовые копии позволяют печатать длинные значения без обрезки полями.
  for (const field of document.querySelectorAll('input, select, textarea:not(#whatsapp-text)')) {
    let value = field.nextElementSibling;
    if (!value || !value.classList.contains("print-value")) {
      value = document.createElement("span");
      value.className = "print-value";
      field.after(value);
    }
    value.textContent = field.classList.contains("price")
      ? money(numberFromInput(field.value))
      : field.value || "—";
  }
}

document.querySelector("#save-pdf").addEventListener("click", () => {
  preparePrint();
  window.print();
});
window.addEventListener("beforeprint", preparePrint);

function collectDraft() {
  const fields = {};
  for (const [key, selector] of Object.entries(draftFields)) {
    fields[key] = document.querySelector(selector).value;
  }
  return {
    fields,
    items: Array.from(items.rows, (row) => ({
      name: row.querySelector(".item-name").value,
      quantity: row.querySelector(".quantity").value,
      unit: row.querySelector("select").value,
      price: row.querySelector(".price").value
    }))
  };
}

function saveDraft() {
  if (!draftReady) return;
  invalidateApproval();
  renderApproval();
  document.querySelector("#manual-copy").hidden = true;
  clearTimeout(copyTimer);
  document.querySelector("#copy-status").textContent = "";
  try {
    localStorage.setItem(senderKey, document.querySelector(draftFields.sender).value);
    localStorage.setItem(draftKey, JSON.stringify({ ...collectDraft(), approval }));
    document.querySelector("#draft-status").textContent = "Черновик сохранён в этом браузере";
    return true;
  } catch {
    document.querySelector("#draft-status").textContent = "Не удалось сохранить черновик. Проверьте, разрешено ли хранение данных в браузере.";
    return false;
  }
}

function restoreDraft() {
  try {
    const stored = localStorage.getItem(draftKey);
    if (!stored) return;
    const draft = JSON.parse(stored);
    if (!draft || !draft.fields || !Array.isArray(draft.items) ||
        !Object.keys(draftFields).every((key) => typeof draft.fields[key] === "string") ||
        !["₸", "₽", "$", "€"].includes(draft.fields.currency) ||
        !draft.items.every((item) => item &&
          ["name", "quantity", "unit", "price"].every((key) => typeof item[key] === "string") &&
          ["шт", "час", "услуга"].includes(item.unit))) {
      throw new Error("Invalid draft");
    }
    for (const [key, selector] of Object.entries(draftFields)) {
      document.querySelector(selector).value = draft.fields[key];
    }
    items.replaceChildren();
    for (const item of draft.items) {
      const row = addItem(false);
      row.querySelector(".item-name").value = item.name;
      row.querySelector(".quantity").value = item.quantity;
      row.querySelector("select").value = item.unit;
      row.querySelector(".price").value = item.price;
    }
    recalculate();
    document.querySelector("#draft-status").textContent = "Черновик восстановлен";
    if (draft.approval) {
      if (!validApproval(draft.approval)) throw new Error("Invalid approval history");
      approval = draft.approval;
      invalidateApproval();
    }
  } catch {
    document.querySelector("#draft-status").textContent = "Не удалось восстановить черновик. Можно продолжить с новой сметой.";
  }
}

document.querySelector("main").addEventListener("input", (event) => {
  if (event.target.id !== "whatsapp-text") saveDraft();
});
document.querySelector("main").addEventListener("change", (event) => {
  if (event.target.id !== "whatsapp-text") saveDraft();
});

document.querySelector("#new-estimate").addEventListener("click", () => {
  if (!window.confirm("Создать новую смету? Текущий черновик будет заменён.")) return;
  approval.active = null;
  const numberField = document.querySelector(draftFields.number);
  const currentNumber = numberField.value.trim();
  const match = currentNumber.match(/^(.*?)(\d+)$/);
  const nextNumber = match
    ? match[1] + (BigInt(match[2]) + 1n).toString().padStart(match[2].length, "0")
    : "1";
  resetEstimate(nextNumber);
});

document.querySelector("#clear-estimate").addEventListener("click", () => {
  if (!window.confirm("Удалить все позиции текущей сметы? Остальные поля, настройки и история согласований сохранятся.")) return;
  items.replaceChildren();
  addItem();
});

function resetEstimate(number = "") {
  approval.active = null;
  for (const [key, selector] of Object.entries(draftFields)) {
    if (key !== "sender") document.querySelector(selector).value = "";
  }
  document.querySelector(draftFields.number).value = number;
  const now = new Date();
  document.querySelector("#estimate-date").value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  discountRate.value = "0";
  vatRate.value = "0";
  currency.value = "₸";
  document.querySelector("#reviewer").value = "";
  document.querySelector("#review-comment").value = "";
  document.querySelector("#approval-error").textContent = "";
  document.querySelector("#whatsapp-text").value = "";
  items.replaceChildren();
  addItem();
}

function whatsappText() {
  recalculate();
  const draft = collectDraft();
  const fields = draft.fields;
  const date = fields.date ? fields.date.split("-").reverse().join(".") : "—";
  const lines = [`Смета № ${fields.number.trim() || "—"} от ${date}`];
  if (fields.sender.trim()) lines.push(`От кого: ${fields.sender}`);
  if (fields.recipient.trim()) lines.push(`Для кого: ${fields.recipient}`);
  lines.push("", "Позиции:");
  draft.items.forEach((item, index) => {
    const quantity = numberFromInput(item.quantity);
    const price = numberFromInput(item.price);
    lines.push(`${index + 1}. ${item.name.trim() || "Без названия"} — ${quantity} ${item.unit} × ${money(price)} = ${items.rows[index].querySelector(".amount").textContent}`);
  });
  lines.push("", `Сумма: ${document.querySelector("#subtotal").textContent}`);
  if (numberFromInput(fields.discount) !== 0) {
    lines.push(`Скидка (${numberFromInput(fields.discount)}%): ${document.querySelector("#discount-amount").textContent}`);
    lines.push(`Сумма со скидкой: ${document.querySelector("#discounted-amount").textContent}`);
  }
  if (numberFromInput(fields.vat) !== 0) lines.push(`НДС (${numberFromInput(fields.vat)}%): ${document.querySelector("#vat-amount").textContent}`);
  lines.push(`Итого к оплате: ${total.textContent}`);
  const words = document.querySelector("#total-words");
  if (!words.hidden) lines.push(words.textContent);
  if (fields.comment.trim()) lines.push("", `Комментарий: ${fields.comment}`);
  return lines.join("\n");
}

document.querySelector("#copy-whatsapp").addEventListener("click", async () => {
  const text = whatsappText();
  const status = document.querySelector("#copy-status");
  clearTimeout(copyTimer);
  status.textContent = "";
  document.querySelector("#manual-copy").hidden = true;
  try {
    await navigator.clipboard.writeText(text);
    status.textContent = "Скопировано ✓";
    copyTimer = setTimeout(() => { status.textContent = ""; }, 2000);
  } catch {
    document.querySelector("#manual-copy").hidden = false;
    const field = document.querySelector("#whatsapp-text");
    field.value = text;
    field.focus();
    field.select();
    status.textContent = "Автоматическое копирование недоступно. Скопируйте текст из поля ниже.";
  }
});

restoreDraft();
restoreMyDetails();
draftReady = true;
renderApproval();

function restoreMyDetails() {
  const sender = document.querySelector(draftFields.sender);
  try {
    const saved = localStorage.getItem(senderKey);
    // Существующий черновик сохраняет свои реквизиты; пустая форма использует мои.
    if (!sender.value && saved !== null) sender.value = saved;
    if (saved === null) localStorage.setItem(senderKey, sender.value);
    invalidateApproval();
  } catch {
    document.querySelector("#draft-status").textContent = "Не удалось загрузить или сохранить мои реквизиты. Проверьте, разрешено ли хранение данных в браузере.";
  }
}

function currentVersion() {
  return approval.versions.find((version) => version.version === approval.active);
}

function invalidateApproval() {
  const version = currentVersion();
  if (version && JSON.stringify(version.draft) !== JSON.stringify(collectDraft())) approval.active = null;
}

function validApproval(state) {
  if (!state || !Array.isArray(state.versions)) return false;
  const valid = state.versions.every((v, index) => v && v.version === index + 1 &&
    typeof v.text === "string" && typeof v.total === "string" &&
    typeof v.createdAt === "string" && Number.isFinite(Date.parse(v.createdAt)) &&
    v.draft && v.draft.fields && Array.isArray(v.draft.items) &&
    ["pending", "approved", "returned"].includes(v.status) &&
    (v.status === "pending" ? v.decision === null : v.decision &&
      v.decision.version === v.version && typeof v.decision.reviewer === "string" &&
      typeof v.decision.comment === "string" && typeof v.decision.at === "string" &&
      Number.isFinite(Date.parse(v.decision.at))));
  return valid && (state.active === null || state.versions.some((v) => v.version === state.active));
}

function decisionText(version) {
  if (!version.decision) return "";
  const d = version.decision;
  return (version.status === "approved" ? "Согласовано (демо)" : "Возвращено на доработку (демо)") +
    "\nВерсия " + d.version + " · Проверяющий: " + d.reviewer +
    "\nДата и время: " + new Date(d.at).toLocaleString("ru-RU") + "\nКомментарий: " + d.comment;
}

function renderApproval() {
  const version = currentVersion();
  const labels = { pending: "На согласовании", approved: "Согласовано (демо)", returned: "Возвращено на доработку" };
  document.querySelector("#approval-status").textContent = version
    ? labels[version.status] + " · Версия " + version.version : "Требуется согласование текущего КП";
  const pending = version && version.status === "pending";
  document.querySelector("#request-approval").disabled = Boolean(version && version.status !== "returned");
  document.querySelector("#approve-version").disabled = !pending;
  document.querySelector("#return-version").disabled = !pending;
  document.querySelector("#decision-version").textContent = pending
    ? "Решение для сохранённой версии " + version.version + ". Итог: " + version.total
    : "Для нового решения запросите согласование текущего КП.";
  const stamp = document.querySelector("#approval-stamp");
  stamp.hidden = !version || version.status !== "approved";
  stamp.textContent = stamp.hidden ? "" : decisionText(version);
  const history = document.querySelector("#approval-history");
  history.replaceChildren();
  for (const saved of [...approval.versions].reverse()) {
    const details = document.createElement("details");
    const summary = document.createElement("summary");
    summary.textContent = "Версия " + saved.version + " · " + labels[saved.status] + " · " + saved.total;
    const content = document.createElement("p");
    content.className = "version-content";
    content.textContent = "Запрошено: " + new Date(saved.createdAt).toLocaleString("ru-RU") + "\n\n" + saved.text + "\n\n" + decisionText(saved);
    const print = document.createElement("button");
    print.type = "button";
    print.textContent = "PDF версии " + saved.version;
    print.addEventListener("click", () => printVersion(saved));
    details.append(summary, content, print);
    history.append(details);
  }
  if (!approval.versions.length) history.textContent = "Сохранённых версий пока нет.";
}

function persistApproval(next) {
  const previous = approval;
  approval = next;
  if (!saveDraft()) {
    approval = previous;
    renderApproval();
    document.querySelector("#approval-error").textContent = "Не удалось сохранить согласование в браузере. Изменение не записано. Проверьте доступность хранилища и повторите.";
    return false;
  }
  document.querySelector("#approval-error").textContent = "";
  return true;
}

document.querySelector("#request-approval").addEventListener("click", () => {
  invalidateApproval();
  const active = currentVersion();
  if (active && active.status !== "returned") return;
  const text = whatsappText();
  const version = {
    version: approval.versions.length + 1, draft: collectDraft(), text, total: total.textContent,
    createdAt: new Date().toISOString(), status: "pending", decision: null
  };
  if (persistApproval({ versions: [...approval.versions, version], active: version.version })) {
    document.querySelector("#reviewer").value = "";
    document.querySelector("#review-comment").value = "";
    document.querySelector("#reviewer").focus();
  }
});

function decideVersion(status) {
  invalidateApproval();
  const version = currentVersion();
  if (!version || version.status !== "pending") { renderApproval(); return; }
  const reviewer = document.querySelector("#reviewer");
  const comment = document.querySelector("#review-comment");
  if (!reviewer.value.trim() || !comment.value.trim()) {
    document.querySelector("#approval-error").textContent = "Введите имя проверяющего и комментарий к решению.";
    (!reviewer.value.trim() ? reviewer : comment).focus();
    return;
  }
  const decided = { ...version, status, decision: {
    version: version.version, reviewer: reviewer.value.trim(), comment: comment.value.trim(), at: new Date().toISOString()
  } };
  persistApproval({ ...approval, versions: approval.versions.map((v) => v.version === version.version ? decided : v) });
}

document.querySelector("#approve-version").addEventListener("click", () => decideVersion("approved"));
document.querySelector("#return-version").addEventListener("click", () => decideVersion("returned"));

function printVersion(version) {
  const area = document.querySelector("#version-print");
  area.replaceChildren();
  const title = document.createElement("h1");
  title.textContent = "КП · Версия " + version.version;
  const content = document.createElement("div");
  content.className = "version-content";
  content.textContent = version.text;
  area.append(title, content);
  if (version.decision) {
    const stamp = document.createElement("p");
    stamp.className = "approval-stamp";
    stamp.textContent = decisionText(version);
    area.append(stamp);
  }
  area.hidden = false;
  document.body.classList.add("printing-version");
  try { window.print(); } finally { resetVersionPrint(); }
}

function resetVersionPrint() {
  document.body.classList.remove("printing-version");
  document.querySelector("#version-print").hidden = true;
}
window.addEventListener("afterprint", resetVersionPrint);
