import { el } from './util.js';

// Diálogo de formulário. fields: [{ name, label, type, options, required, wide, placeholder, rows }]
// onSubmit recebe os valores; se lançar erro, a mensagem aparece no diálogo e ele continua aberto.
export function formDialog({ title, fields, values = {}, submitLabel = 'Salvar', onSubmit }) {
  const dlg = el('dialog', { class: 'modal', 'aria-labelledby': 'dlg-title' });
  const status = el('p', { class: 'meta', role: 'status' });
  const input = (f) => {
    const v = values[f.name] == null ? (f.value == null ? '' : f.value) : values[f.name];
    if (f.type === 'select') return el('select', { name: f.name, required: !!f.required }, ...f.options.map((o) => el('option', { value: o, selected: String(v) === String(o) }, o === '' ? 'Não informada' : o)));
    if (f.type === 'textarea') { const t = el('textarea', { name: f.name, rows: String(f.rows || 4), required: !!f.required, placeholder: f.placeholder || null }); t.value = v; return t; }
    return el('input', { name: f.name, type: f.type || 'text', value: v, required: !!f.required, placeholder: f.placeholder || null, step: f.step || null, min: f.min || null });
  };
  const form = el('form', { method: 'dialog' },
    el('h2', { id: 'dlg-title' }, title),
    el('div', { class: 'formgrid' }, ...fields.map((f) => el('label', { class: f.wide ? 'wide' : null }, f.label + (f.required ? ' *' : ''), input(f)))),
    status,
    el('div', { class: 'formfoot' },
      el('button', { class: 'btn', type: 'button', onclick: () => dlg.close() }, 'Cancelar'),
      el('button', { class: 'btn primary', type: 'submit' }, submitLabel)));
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(form));
    status.textContent = 'Salvando…';
    try { await onSubmit(data); dlg.close(); } catch (err) { status.textContent = err.message; }
  });
  dlg.append(form);
  dlg.addEventListener('close', () => dlg.remove());
  document.body.append(dlg);
  dlg.showModal();
  const first = form.querySelector('input,select,textarea');
  if (first) first.focus();
  return dlg;
}

let toastTimer;
export function toast(msg) {
  document.querySelectorAll('.toast').forEach((t) => t.remove());
  const t = el('div', { class: 'toast', role: 'status' }, msg);
  document.body.append(t);
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.remove(), 3200);
}

// Dica flutuante compartilhada pelos gráficos (hover e foco).
let tipEl;
export function tip(target, text) {
  const show = (x, y) => {
    if (!tipEl) { tipEl = el('div', { class: 'tip', role: 'tooltip' }); document.body.append(tipEl); }
    tipEl.textContent = text;
    tipEl.style.display = 'block';
    const r = tipEl.getBoundingClientRect();
    tipEl.style.left = Math.min(window.innerWidth - r.width - 8, Math.max(8, x + 12)) + 'px';
    tipEl.style.top = Math.max(8, y - r.height - 12) + 'px';
  };
  const hide = () => { if (tipEl) tipEl.style.display = 'none'; };
  target.addEventListener('mousemove', (e) => show(e.clientX, e.clientY));
  target.addEventListener('mouseleave', hide);
  target.addEventListener('focus', () => { const b = target.getBoundingClientRect(); show(b.left + b.width / 2, b.top); });
  target.addEventListener('blur', hide);
  return target;
}
