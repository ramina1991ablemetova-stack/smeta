"use strict";

const items = document.querySelector("#items");
const template = document.querySelector("#item-template");
const total = document.querySelector("#total");
const discountRate = document.querySelector("#discount-rate");
const vatRate = document.querySelector("#vat-rate");
const currency = document.querySelector("#currency");
const moneyFormatter = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 });
const draftKey = "smeta-five-minutes-draft-v1";
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

function numberFromInput(value) {
  const normalized = value.trim().replace(/[\s\u00a0\u202f]/g, "").replace(",", ".");
  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(normalized)) return 0;
  const number = Number(normalized);
  return Number.isFinite(number) ? number : 0;
}

function money(value) {
  const rounded = Number.isFinite(value) ? Math.round(value) : 0;
  return moneyFormatter.format(rounded === 0 ? 0 : rounded).replace(/[\u00a0\u202f]/g, " ") + " " + currency.value;
}

function recalculate() {
  let sum = 0;
  for (const row of items.rows) {
    const product = numberFromInput(row.querySelector(".quantity").value) * numberFromInput(row.querySelector(".price").value);
    const safeAmount = Number.isFinite(product) ? product : 0;
    row.querySelector(".amount").textContent = money(safeAmount);
    row.querySelector(".price").setAttribute("aria-label", "Цена, " + currency.value);
    sum += safeAmount;
  }
  if (!Number.isFinite(sum)) sum = 0;
  const discountPercent = numberFromInput(discountRate.value);
  const vatPercent = numberFromInput(vatRate.value);
  const discount = sum * (discountPercent / 100);
  const discounted = sum - discount;
  const vat = discounted * (vatPercent / 100);
  document.querySelector("#subtotal").textContent = money(sum);
  document.querySelector("#discount-amount").textContent = money(discount);
  document.querySelector("#discounted-amount").textContent = money(discounted);
  document.querySelector("#vat-amount").textContent = money(vat);
  document.querySelector("#discount-row").hidden = discountPercent === 0;
  document.querySelector("#discounted-row").hidden = discountPercent === 0;
  document.querySelector("#vat-row").hidden = vatPercent === 0;
  total.textContent = money(discounted + vat);
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
  recalculate();
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
    value.textContent = field.value || "—";
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
  document.querySelector("#manual-copy").hidden = true;
  clearTimeout(copyTimer);
  document.querySelector("#copy-status").textContent = "";
  try {
    localStorage.setItem(draftKey, JSON.stringify(collectDraft()));
    document.querySelector("#draft-status").textContent = "Черновик сохранён в этом браузере";
  } catch {
    document.querySelector("#draft-status").textContent = "Не удалось сохранить черновик. Проверьте, разрешено ли хранение данных в браузере.";
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
  const numberField = document.querySelector(draftFields.number);
  const currentNumber = numberField.value.trim();
  const match = currentNumber.match(/^(.*?)(\d+)$/);
  const nextNumber = match
    ? match[1] + (BigInt(match[2]) + 1n).toString().padStart(match[2].length, "0")
    : "1";
  for (const selector of Object.values(draftFields)) document.querySelector(selector).value = "";
  numberField.value = nextNumber;
  const now = new Date();
  document.querySelector("#estimate-date").value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  discountRate.value = "0";
  vatRate.value = "0";
  currency.value = "₸";
  items.replaceChildren();
  addItem();
});

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
draftReady = true;
