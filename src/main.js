import './style.css';
import { configurationError, supabase } from './supabase.js';

const $ = (selector) => document.querySelector(selector);
const rp = (value) => new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  maximumFractionDigits: 0,
}).format(value);
const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
}[char]));

const STATUS = ['Diterima', 'Dicuci', 'Selesai', 'Diambil'];
const NEXT = {
  Diterima: ['Dicuci', 'Mulai cuci'],
  Dicuci: ['Selesai', 'Tandai selesai'],
  Selesai: ['Diambil', 'Serahkan ke pelanggan'],
};
const LABEL = { pesanan: 'pesanan', pelanggan: 'pelanggan', layanan: 'layanan' };
const COLORS = {
  Diterima: 'var(--s-diterima, #b7791f)',
  Dicuci: 'var(--s-dicuci, #1f6f9c)',
  Selesai: 'var(--s-selesai, #2f855a)',
  Diambil: 'var(--s-diambil, #6b7785)',
};

let data = { pelanggan: [], layanan: [], pesanan: [] };
let view = 'pesanan';
let editing = null;
let authVersion = 0;
let currentSession = null;

function showMessage(target, text = '') {
  $(target).textContent = text;
}

function openAuthDialog() {
  showMessage('#auth-message');
  $('#auth-dialog').showModal();
}

async function showSignedIn(session) {
  const version = ++authVersion;
  currentSession = session;
  if (!session) {
    data = { pelanggan: [], layanan: [], pesanan: [] };
    $('#account-action').textContent = 'Masuk';
    $('#tabs').hidden = true;
    $('#edit-cta').hidden = false;
    $('#tambah').hidden = true;
    $('#app-view').hidden = false;
    $('#judul').textContent = 'Papan pesanan';
    $('#board').hidden = false;
    $('#tabel').hidden = true;
    showMessage('#app-message');
    try {
      const orders = await loadPublic();
      if (version === authVersion) {
        data = { pelanggan: [], layanan: [], pesanan: orders };
        renderBoard(false);
      }
    } catch (error) {
      if (version === authVersion) {
        showMessage('#app-message', `Papan gagal dimuat: ${error.message}`);
      }
    }
    return;
  }

  if ($('#auth-dialog').open) $('#auth-dialog').close();
  $('#account-action').textContent = 'Keluar';
  $('#app-view').hidden = false;
  $('#tabs').hidden = false;
  $('#edit-cta').hidden = true;
  $('#tambah').hidden = false;
  showMessage('#app-message');

  try {
    const loadedData = await load();
    if (version === authVersion) {
      data = loadedData;
      render();
    }
  } catch (error) {
    if (version === authVersion) {
      showMessage('#app-message', `Data gagal dimuat: ${error.message}`);
    }
  }
}

async function load() {
  const [customers, services, orders] = await Promise.all([
    supabase.from('pelanggan').select('id,nama,noHp:no_hp,alamat').order('id'),
    supabase.from('layanan').select('id,nama,harga').order('id'),
    supabase.from('pesanan').select(
      'id,pelangganId:pelanggan_id,layananId:layanan_id,berat,status,total,tanggalMasuk:tanggal_masuk,tanggalSelesai:tanggal_selesai',
    ).order('id', { ascending: false }),
  ]);
  for (const result of [customers, services, orders]) {
    if (result.error?.code === 'PGRST205') {
      const missingTable = ['pelanggan', 'layanan', 'pesanan']
        .find((table) => result.error.message.includes(`public.${table}`));
      if (missingTable) {
        throw new Error(`Tabel public.${missingTable} belum tersedia. Jalankan supabase/schema.sql di Supabase SQL Editor.`);
      }
    }
    if (result.error) throw result.error;
  }
  return {
    pelanggan: customers.data,
    layanan: services.data,
    pesanan: orders.data,
  };
}

async function loadPublic() {
  const { data: orders, error } = await supabase.from('pesanan_publik')
    .select('id,pelangganNama:pelanggan_nama,layananNama:layanan_nama,berat,status,total,tanggalMasuk:tanggal_masuk')
    .order('id', { ascending: false });
  if (error?.code === 'PGRST205' || error?.message?.includes('pesanan_publik')) {
    throw new Error('View publik belum dibuat. Jalankan supabase/public-board-migration.sql di Supabase SQL Editor.');
  }
  if (error) throw error;
  return orders;
}

const nameOf = (list, id) => (list.find((item) => item.id === id) || {}).nama || 'Data dihapus';

function render() {
  document.querySelectorAll('.tabs button').forEach((button) => {
    button.setAttribute('aria-selected', String(button.dataset.view === view));
  });
  $('#judul').textContent = view[0].toUpperCase() + view.slice(1);
  $('#tambah').textContent = `Tambah ${LABEL[view]}`;
  $('#board').hidden = view !== 'pesanan';
  $('#tabel').hidden = view === 'pesanan';
  if (view === 'pesanan') renderBoard();
  else renderTable();
}

function renderBoard(editable = true) {
  $('#board').innerHTML = STATUS.map((status) => {
    const orders = data.pesanan.filter((order) => order.status === status);
    return `<section class="col" style="--c:${COLORS[status]}">
      <header><h3>${status}</h3><span class="count">${orders.length}</span></header>
      ${orders.length ? orders.map((order) => renderOrder(order, editable)).join('') : '<p class="empty">Belum ada pesanan</p>'}
    </section>`;
  }).join('');
}

function renderOrder(order, editable) {
  const next = NEXT[order.status];
  const customerName = editable ? nameOf(data.pelanggan, order.pelangganId) : order.pelangganNama;
  const serviceName = editable ? nameOf(data.layanan, order.layananId) : order.layananNama;
  return `<article class="order">
    <div class="who">${esc(customerName)}</div>
    <div class="meta">${esc(serviceName)}, ${esc(order.berat)} kg</div>
    <div class="total">${rp(order.total)}</div>
    <div class="date">Masuk ${esc(order.tanggalMasuk)}</div>
    ${editable ? `<div class="actions">
      ${next ? `<button class="primary" data-act="next" data-id="${order.id}">${next[1]}</button>` : ''}
      <button class="plain" data-act="edit" data-kind="pesanan" data-id="${order.id}">Ubah</button>
      <button class="plain danger" data-act="del" data-kind="pesanan" data-id="${order.id}">Hapus</button>
    </div>` : ''}
  </article>`;
}

function renderTable() {
  const rows = data[view];
  if (!rows.length) {
    $('#tabel').innerHTML = `<p class="table-empty">Belum ada ${LABEL[view]}. Pakai tombol Tambah ${LABEL[view]} untuk mulai.</p>`;
    return;
  }
  const headings = view === 'pelanggan' ? ['Nama', 'Nomor HP', 'Alamat'] : ['Nama layanan', 'Harga per kg'];
  const cells = (row) => view === 'pelanggan'
    ? [esc(row.nama), esc(row.noHp), esc(row.alamat)]
    : [esc(row.nama), rp(row.harga)];
  $('#tabel').innerHTML = `<table>
    <thead><tr>${headings.map((heading) => `<th>${heading}</th>`).join('')}<th>Aksi</th></tr></thead>
    <tbody>${rows.map((row) => `<tr>${cells(row).map((cell) => `<td>${cell}</td>`).join('')}
      <td class="row-actions">
        <button class="plain" data-act="edit" data-kind="${view}" data-id="${row.id}">Ubah</button>
        <button class="plain danger" data-act="del" data-kind="${view}" data-id="${row.id}">Hapus</button>
      </td></tr>`).join('')}</tbody></table>`;
}

function field(label, name, type, value, extra = '') {
  return `<label>${label}<input name="${name}" type="${type}" value="${esc(value)}" ${extra}></label>`;
}

function select(label, name, options, value) {
  return `<label>${label}<select name="${name}" required>
    <option value="">Pilih...</option>
    ${options.map(([optionValue, text]) => `<option value="${optionValue}" ${String(optionValue) === String(value) ? 'selected' : ''}>${esc(text)}</option>`).join('')}
  </select></label>`;
}

function openForm(kind, item) {
  editing = { kind, item };
  const value = item || {};
  let html;
  if (kind === 'pelanggan') {
    html = field('Nama', 'nama', 'text', value.nama, 'required maxlength="120"') +
      field('Nomor HP', 'noHp', 'tel', value.noHp, 'maxlength="40"') +
      field('Alamat', 'alamat', 'text', value.alamat, 'maxlength="250"');
  } else if (kind === 'layanan') {
    html = field('Nama layanan', 'nama', 'text', value.nama, 'required maxlength="120"') +
      field('Harga per kg (Rp)', 'harga', 'number', value.harga, 'required min="1" step="100"');
  } else {
    html = select('Pelanggan', 'pelangganId', data.pelanggan.map((customer) => [customer.id, customer.nama]), value.pelangganId) +
      select('Layanan', 'layananId', data.layanan.map((service) => [service.id, `${service.nama} (${rp(service.harga)}/kg)`]), value.layananId) +
      field('Berat (kg)', 'berat', 'number', value.berat, 'required min="0.1" step="0.1"') +
      (item ? select('Status', 'status', STATUS.map((status) => [status, status]), value.status) : '');
  }
  $('#dlg-judul').textContent = `${item ? 'Ubah' : 'Tambah'} ${LABEL[kind]}`;
  $('#dlg-isi').innerHTML = html;
  showMessage('#dlg-error');
  $('#dlg').showModal();
}

function toDatabaseRecord(kind, formData) {
  if (kind === 'pelanggan') {
    return { nama: String(formData.get('nama')).trim(), no_hp: String(formData.get('noHp') || '').trim(), alamat: String(formData.get('alamat') || '').trim() };
  }
  if (kind === 'layanan') {
    return { nama: String(formData.get('nama')).trim(), harga: Number(formData.get('harga')) };
  }
  const record = {
    pelanggan_id: Number(formData.get('pelangganId')),
    layanan_id: Number(formData.get('layananId')),
    berat: Number(formData.get('berat')),
  };
  if (formData.has('status')) record.status = formData.get('status');
  return record;
}

async function saveForm(event) {
  event.preventDefault();
  const formData = new FormData(event.currentTarget);
  const { kind, item } = editing;
  const record = toDatabaseRecord(kind, formData);
  let result = supabase.from(kind);
  result = item
    ? await result.update(record).eq('id', item.id)
    : await result.insert(record);
  if (result.error) throw result.error;
  $('#dlg').close();
  data = await load();
  render();
}

$('#auth-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const formData = new FormData(event.currentTarget);
  const credentials = {
    email: String(formData.get('email')).trim(),
    password: formData.get('password'),
  };
  showMessage('#auth-message', 'Memeriksa akun...');

  try {
    const result = await supabase.auth.signInWithPassword(credentials);
    if (result.error) {
      showMessage('#auth-message', result.error.message);
    } else {
      showMessage('#auth-message');
    }
  } catch (error) {
    showMessage('#auth-message', error.message);
  }
});

$('#auth-cancel').addEventListener('click', () => $('#auth-dialog').close());

$('#f').addEventListener('submit', async (event) => {
  try {
    await saveForm(event);
    showMessage('#app-message');
  } catch (error) {
    showMessage('#dlg-error', error.message);
  }
});

$('#batal').addEventListener('click', () => $('#dlg').close());

$('#account-action').addEventListener('click', async () => {
  if (!currentSession) {
    openAuthDialog();
    return;
  }
  try {
    const { error } = await supabase.auth.signOut();
    if (error) showMessage('#app-message', error.message);
  } catch (error) {
    showMessage('#app-message', error.message);
  }
});

$('#edit-cta').addEventListener('click', openAuthDialog);

document.addEventListener('click', async (event) => {
  const target = event.target;
  const tab = target.closest('.tabs button');
  if (tab) {
    view = tab.dataset.view;
    return render();
  }
  if (target.closest('#tambah')) return openForm(view, null);

  const button = target.closest('[data-act]');
  if (!button || !currentSession) return;
  const id = Number(button.dataset.id);
  const kind = button.dataset.kind;
  try {
    if (button.dataset.act === 'edit') {
      openForm(kind, data[kind].find((item) => item.id === id));
    } else if (button.dataset.act === 'del') {
      if (!confirm('Hapus data ini? Tindakan ini tidak bisa dibatalkan.')) return;
      const { error } = await supabase.from(kind).delete().eq('id', id);
      if (error?.code === '23503' && kind === 'pelanggan') {
        throw new Error('Pelanggan masih memiliki pesanan. Hapus pesanan terkait terlebih dahulu.');
      }
      if (error?.code === '23503' && kind === 'layanan') {
        throw new Error('Layanan masih digunakan pesanan. Hapus pesanan terkait terlebih dahulu.');
      }
      if (error) throw error;
      data = await load();
      render();
    } else if (button.dataset.act === 'next') {
      const order = data.pesanan.find((item) => item.id === id);
      const { error } = await supabase.from('pesanan').update({ status: NEXT[order.status][0] }).eq('id', id);
      if (error) throw error;
      data = await load();
      render();
    }
    showMessage('#app-message');
  } catch (error) {
    showMessage('#app-message', error.message);
  }
});

if (supabase) {
  supabase.auth.onAuthStateChange((_event, session) => {
    setTimeout(() => void showSignedIn(session), 0);
  });
} else {
  $('#app-view').hidden = false;
  $('#account-action').disabled = true;
  $('#edit-cta').hidden = true;
  $('#tambah').hidden = true;
  showMessage('#auth-message', configurationError);
  showMessage('#app-message', configurationError);
}
