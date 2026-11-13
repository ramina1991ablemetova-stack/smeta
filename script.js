"use strict";

const items = document.querySelector("#items");
const template = document.querySelector("#item-template");
const total = document.querySelector("#total");
const discountRate = document.querySelector("#discount-rate");
const vatRate = document.querySelector("#vat-rate");
const currency = document.querySelector("#currency");
const moneyFormatter = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 });

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
  for (const field of document.querySelectorAll("input, select, textarea")) {
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
