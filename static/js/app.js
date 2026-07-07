const loginPage = document.getElementById('loginPage');
const dashboardPage = document.getElementById('dashboardPage');
const loginForm = document.getElementById('loginForm');
const loginError = document.getElementById('loginError');

// ---- LOGIN (sungguhan, connect ke database) ----
loginForm.addEventListener('submit', async function (e) {
  e.preventDefault();
  const username = document.getElementById('username').value.trim();
  const password = document.getElementById('password').value.trim();

  if (!username || !password) {
    loginError.textContent = 'Username dan password wajib diisi!';
    return;
  }

  loginError.textContent = 'Memeriksa...';

  try {
    const response = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    const result = await response.json();

    if (result.success) {
      loginError.textContent = '';
      document.getElementById('userName').textContent = result.nama;
      document.getElementById('userRole').textContent = result.role.toUpperCase();
      document.getElementById('userAvatar').textContent = result.nama.charAt(0).toUpperCase();
      loginPage.classList.add('hidden');
      dashboardPage.classList.remove('hidden');
      loadDataSiswa();
    } else {
      loginError.textContent = result.message;
    }
  } catch (err) {
    loginError.textContent = 'Gagal terhubung ke server!';
  }
});

// ---- LOGOUT ----
document.getElementById('logoutBtn').addEventListener('click', function (e) {
  e.preventDefault();
  dashboardPage.classList.add('hidden');
  loginPage.classList.remove('hidden');
  loginForm.reset();
});

// ---- NAVIGASI SIDEBAR (SPA sederhana) ----
const navItems = document.querySelectorAll('.nav-item[data-view]');
const views = document.querySelectorAll('.view');

navItems.forEach(function (item) {
  item.addEventListener('click', function (e) {
    e.preventDefault();
    const target = item.getAttribute('data-view');

    navItems.forEach(function (i) { i.classList.remove('active'); });
    item.classList.add('active');

    views.forEach(function (v) {
      v.classList.toggle('hidden', v.id !== 'view-' + target);
    });

    document.querySelector('.sidebar').classList.remove('open');

    if (target === 'guru') {
      loadDataGuru();
    }
  });
});

// ---- TOGGLE SIDEBAR (mobile) ----
document.getElementById('hamburgerBtn').addEventListener('click', function () {
  document.querySelector('.sidebar').classList.toggle('open');
});

// ---- MEMUAT DATA SISWA DARI DATABASE ----
async function loadDataSiswa() {
  try {
    const response = await fetch('/api/siswa');
    const result = await response.json();

    if (result.success) {
      renderTabelSiswa(result.data);
      updateStatistik(result.data);
    }
  } catch (err) {
    console.error('Gagal memuat data siswa:', err);
  }
}

// ---- MENAMPILKAN DATA KE TABEL ----
function renderTabelSiswa(data) {
  const tbody = document.getElementById('tableSiswaBody');

  if (data.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" class="empty-row">Belum ada data</td></tr>';
    return;
  }

tbody.innerHTML = data.map(function (s) {
  return `
    <tr>
      <td>${s.nama}</td>
      <td>${s.nisn}</td>
      <td>${s.jk || '-'}</td>
      <td>${s.kelas || '-'}</td>
      <td>${s.jurusan || '-'}</td>
      <td>${s.no_hp || '-'}</td>
      <td>
        <button class="icon-btn foto" title="Upload Foto" data-nisn="${s.nisn}">📷</button>
        <button class="icon-btn edit" title="Edit" data-nisn="${s.nisn}">✏️</button>
        <button class="icon-btn delete" title="Hapus" data-nisn="${s.nisn}">🗑️</button>
      </td>
    </tr>
  `;
}).join('');

  document.getElementById('filterCount').textContent = data.length + ' Data Ditemukan';
  document.getElementById('filterInfoText').textContent =
    'Menampilkan 1 - ' + data.length + ' dari ' + data.length + ' data';

  // ---- PASANG EVENT LISTENER UNTUK TOMBOL EDIT & HAPUS ----
  document.querySelectorAll('.icon-btn.edit').forEach(function (btn) {
    btn.addEventListener('click', function () {
      bukaModalEdit(btn.getAttribute('data-nisn'), data);
    });
  });

  document.querySelectorAll('.icon-btn.delete').forEach(function (btn) {
    btn.addEventListener('click', function () {
      hapusSiswa(btn.getAttribute('data-nisn'));
    });
  });

  document.querySelectorAll('.icon-btn.foto').forEach(function (btn) {
  btn.addEventListener('click', function () {
    bukaModalFoto(btn.getAttribute('data-nisn'));
  });
});
}

// ---- UPDATE ANGKA STATISTIK DI CARD ----
function updateStatistik(data) {
  document.getElementById('statTotalSiswa').textContent = data.length;

  const kelasUnik = new Set(data.map(function (s) { return s.kelas; }).filter(Boolean));
  document.getElementById('statKelasAktif').textContent = kelasUnik.size;

  const jurusanUnik = new Set(data.map(function (s) { return s.jurusan; }).filter(Boolean));
  document.getElementById('statJurusan').textContent = jurusanUnik.size;

  const fotoLengkap = data.filter(function (s) { return s.foto_url; }).length;
  document.getElementById('statFoto').textContent = fotoLengkap;
}

// ---- MODAL TAMBAH / EDIT SISWA ----
const modalSiswa = document.getElementById('modalSiswa');
const formSiswa = document.getElementById('formSiswa');
const formSiswaError = document.getElementById('formSiswaError');

function bukaModalTambah() {
  document.getElementById('modalSiswaTitle').textContent = 'Tambah Siswa Baru';
  formSiswa.reset();
  document.getElementById('siswaIdEdit').value = '';
  document.getElementById('inputNisn').disabled = false;
  formSiswaError.textContent = '';
  modalSiswa.classList.remove('hidden');
}

function bukaModalEdit(nisn, semuaData) {
  const siswa = semuaData.find(function (s) { return s.nisn === nisn; });
  if (!siswa) return;

  document.getElementById('modalSiswaTitle').textContent = 'Edit Data Siswa';
  document.getElementById('siswaIdEdit').value = siswa.nisn;

  document.getElementById('inputNama').value = siswa.nama || '';
  document.getElementById('inputNisn').value = siswa.nisn || '';
  document.getElementById('inputNisn').disabled = true;
  document.getElementById('inputJk').value = siswa.jk || 'L';
  document.getElementById('inputTglLahir').value = siswa.tgl_lahir || '';
  document.getElementById('inputNamaAyah').value = siswa.nama_ayah || '';
  document.getElementById('inputNamaIbu').value = siswa.nama_ibu || '';
  document.getElementById('inputNoHp').value = siswa.no_hp || '';
  document.getElementById('inputKelas').value = siswa.kelas || '';
  document.getElementById('inputJurusan').value = siswa.jurusan || '';
  document.getElementById('inputAlamat').value = siswa.alamat || '';
  document.getElementById('inputKodePos').value = siswa.kode_pos || '';

  formSiswaError.textContent = '';
  modalSiswa.classList.remove('hidden');
}

function tutupModalSiswa() {
  modalSiswa.classList.add('hidden');
}

document.getElementById('btnTambahSiswa').addEventListener('click', bukaModalTambah);
document.getElementById('closeModalSiswa').addEventListener('click', tutupModalSiswa);
document.getElementById('cancelModalSiswa').addEventListener('click', tutupModalSiswa);

// ---- SUBMIT FORM (Tambah / Edit Siswa) ----
formSiswa.addEventListener('submit', async function (e) {
  e.preventDefault();

  const nisnEdit = document.getElementById('siswaIdEdit').value;

  const payload = {
    nama: document.getElementById('inputNama').value.trim(),
    nisn: document.getElementById('inputNisn').value.trim(),
    jk: document.getElementById('inputJk').value,
    tglLahir: document.getElementById('inputTglLahir').value,
    namaAyah: document.getElementById('inputNamaAyah').value.trim(),
    namaIbu: document.getElementById('inputNamaIbu').value.trim(),
    noHp: document.getElementById('inputNoHp').value.trim(),
    kelas: document.getElementById('inputKelas').value.trim(),
    jurusan: document.getElementById('inputJurusan').value.trim(),
    alamat: document.getElementById('inputAlamat').value.trim(),
    kodePos: document.getElementById('inputKodePos').value.trim()
  };

  formSiswaError.textContent = 'Menyimpan...';

  try {
    let response;
    if (nisnEdit) {
      response = await fetch('/api/siswa/' + nisnEdit, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    } else {
      response = await fetch('/api/siswa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    }

    const result = await response.json();

    if (result.success) {
      tutupModalSiswa();
      loadDataSiswa();
    } else {
      formSiswaError.textContent = result.message;
    }
  } catch (err) {
    formSiswaError.textContent = 'Gagal terhubung ke server!';
  }
});

// ---- HAPUS DATA SISWA ----
async function hapusSiswa(nisn) {
  const konfirmasi = confirm('Yakin ingin menghapus data siswa ini? Data yang dihapus tidak bisa dikembalikan.');
  if (!konfirmasi) return;

  try {
    const response = await fetch('/api/siswa/' + nisn, { method: 'DELETE' });
    const result = await response.json();

    if (result.success) {
      loadDataSiswa();
    } else {
      alert('Gagal menghapus: ' + result.message);
    }
  } catch (err) {
    alert('Gagal terhubung ke server!');
  }
}
// ---- MODAL UPLOAD FOTO ----
const modalFoto = document.getElementById('modalFoto');
const formFoto = document.getElementById('formFoto');
const formFotoError = document.getElementById('formFotoError');

function bukaModalFoto(nisn) {
  document.getElementById('fotoNisn').value = nisn;
  document.getElementById('inputFoto').value = '';
  formFotoError.textContent = '';
  modalFoto.classList.remove('hidden');
}

document.getElementById('closeModalFoto').addEventListener('click', function () {
  modalFoto.classList.add('hidden');
});
document.getElementById('cancelModalFoto').addEventListener('click', function () {
  modalFoto.classList.add('hidden');
});

// ---- SUBMIT UPLOAD FOTO ----
formFoto.addEventListener('submit', async function (e) {
  e.preventDefault();

  const nisn = document.getElementById('fotoNisn').value;
  const fileInput = document.getElementById('inputFoto');

  if (!fileInput.files.length) {
    formFotoError.textContent = 'Pilih file dulu!';
    return;
  }

  const formData = new FormData();
  formData.append('foto', fileInput.files[0]);

  formFotoError.textContent = 'Mengupload...';

  try {
    const response = await fetch('/api/siswa/' + nisn + '/foto', {
      method: 'POST',
      body: formData   // TIDAK pakai header Content-Type, browser atur otomatis untuk FormData
    });
    const result = await response.json();

    if (result.success) {
      modalFoto.classList.add('hidden');
      loadDataSiswa();
    } else {
      formFotoError.textContent = result.message;
    }
  } catch (err) {
    formFotoError.textContent = 'Gagal terhubung ke server!';
  }
});
// ---- EXPORT PDF DATA SISWA ----
document.getElementById('btnExportSiswaPdf').addEventListener('click', function () {
  const kelas = document.getElementById('exportFilterKelas').value;
  const jurusan = document.getElementById('exportFilterJurusan').value;

  const url = `/api/export/siswa/pdf?kelas=${kelas}&jurusan=${jurusan}`;
  window.open(url, '_blank');   // buka PDF di tab baru
});
// ---- EXPORT EXCEL DATA SISWA (dengan preview) ----
document.getElementById('btnExportSiswaExcel').addEventListener('click', async function () {
  const kelas = document.getElementById('exportFilterKelas').value;
  const jurusan = document.getElementById('exportFilterJurusan').value;

  try {
    const response = await fetch('/api/siswa');
    const result = await response.json();
    if (!result.success) return;

    // Filter data di sisi JavaScript, sesuai pilihan kelas/jurusan
    let data = result.data;
    if (kelas !== 'all') data = data.filter(function (s) { return s.kelas === kelas; });
    if (jurusan !== 'all') data = data.filter(function (s) { return s.jurusan === jurusan; });

    tampilkanPreview(
      'Preview Data Siswa',
      ['Nama', 'NISN', 'L/P', 'Kelas', 'Jurusan', 'No HP'],
      data.map(function (s) { return [s.nama, s.nisn, s.jk, s.kelas, s.jurusan, s.no_hp]; }),
      '/api/export/siswa/excel?kelas=' + kelas + '&jurusan=' + jurusan
    );
  } catch (err) {
    alert('Gagal memuat preview!');
  }
});

// ---- EXPORT PDF DATA GURU ----
document.getElementById('btnExportGuruPdf').addEventListener('click', function () {
  window.open('/api/export/guru/pdf', '_blank');
});

// ---- EXPORT EXCEL DATA GURU (dengan preview) ----
document.getElementById('btnExportGuruExcel').addEventListener('click', async function () {
  try {
    const response = await fetch('/api/guru');
    const result = await response.json();
    if (!result.success) return;

    tampilkanPreview(
      'Preview Data Guru',
      ['NIP', 'Nama Guru', 'Mata Pelajaran', 'Kelas Ajar', 'Jurusan Ajar'],
      result.data.map(function (g) { return [g.nip, g.nama, g.mapel, g.kelas_ajar, g.jurusan_ajar]; }),
      '/api/export/guru/excel'
    );
  } catch (err) {
    alert('Gagal memuat preview!');
  }
});
// ---- MODAL PREVIEW EXPORT (dipakai bareng untuk Siswa & Guru) ----
const modalPreview = document.getElementById('modalPreview');
let urlDownloadAktif = '';   // menyimpan URL download yang sedang aktif di preview

function tampilkanPreview(judul, headers, rows, downloadUrl) {
  document.getElementById('modalPreviewTitle').textContent = judul;
  urlDownloadAktif = downloadUrl;

  const thead = document.getElementById('tabelPreviewHead');
  thead.innerHTML = '<tr>' + headers.map(function (h) { return '<th>' + h + '</th>'; }).join('') + '</tr>';

  const tbody = document.getElementById('tabelPreviewBody');
  if (rows.length === 0) {
    tbody.innerHTML = '<tr><td colspan="' + headers.length + '" class="empty-row">Belum ada data</td></tr>';
  } else {
    tbody.innerHTML = rows.map(function (row) {
      return '<tr>' + row.map(function (cell) { return '<td>' + (cell || '-') + '</td>'; }).join('') + '</tr>';
    }).join('');
  }

  document.getElementById('previewInfo').textContent = 'Total: ' + rows.length + ' data akan diexport.';
  modalPreview.classList.remove('hidden');
}

document.getElementById('closeModalPreview').addEventListener('click', function () {
  modalPreview.classList.add('hidden');
});
document.getElementById('cancelModalPreview').addEventListener('click', function () {
  modalPreview.classList.add('hidden');
});

document.getElementById('btnDownloadFromPreview').addEventListener('click', function () {
  window.open(urlDownloadAktif, '_blank');
  modalPreview.classList.add('hidden');
});
// ---- MEMUAT DATA GURU DARI DATABASE ----
async function loadDataGuru() {
  try {
    const response = await fetch('/api/guru');
    const result = await response.json();

    if (result.success) {
      renderTabelGuru(result.data);
    }
  } catch (err) {
    console.error('Gagal memuat data guru:', err);
  }
}

// ---- MENAMPILKAN DATA GURU KE TABEL ----
function renderTabelGuru(data) {
  const tbody = document.getElementById('tableGuruBody');

  if (data.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="empty-row">Belum ada data</td></tr>';
    document.getElementById('filterCountGuru').textContent = '0 Data Guru';
    document.getElementById('filterInfoGuru').textContent = 'Menampilkan 0 - 0 dari 0 data';
    return;
  }

  tbody.innerHTML = data.map(function (g) {
    return `
      <tr>
        <td>${g.nip}</td>
        <td>${g.nama}</td>
        <td>${g.mapel || '-'}</td>
        <td>${g.kelas_ajar || '-'}</td>
        <td>${g.jurusan_ajar || '-'}</td>
        <td>
          <button class="icon-btn edit" title="Edit" data-nip="${g.nip}">✏️</button>
          <button class="icon-btn delete" title="Hapus" data-nip="${g.nip}">🗑️</button>
        </td>
      </tr>
    `;
  }).join('');

  document.getElementById('filterCountGuru').textContent = data.length + ' Data Guru';
  document.getElementById('filterInfoGuru').textContent =
    'Menampilkan 1 - ' + data.length + ' dari ' + data.length + ' data';

  document.querySelectorAll('#tableGuruBody .icon-btn.edit').forEach(function (btn) {
    btn.addEventListener('click', function () {
      bukaModalEditGuru(btn.getAttribute('data-nip'), data);
    });
  });

  document.querySelectorAll('#tableGuruBody .icon-btn.delete').forEach(function (btn) {
    btn.addEventListener('click', function () {
      hapusGuru(btn.getAttribute('data-nip'));
    });
  });
}

// ---- MODAL TAMBAH / EDIT GURU ----
const modalGuru = document.getElementById('modalGuru');
const formGuru = document.getElementById('formGuru');
const formGuruError = document.getElementById('formGuruError');
let nipEditAktif = '';   // menyimpan NIP yang sedang diedit (kosong = mode tambah)

function bukaModalTambahGuru() {
  document.getElementById('modalGuruTitle').textContent = 'Tambah Guru Baru';
  formGuru.reset();
  nipEditAktif = '';
  document.getElementById('inputNip').disabled = false;
  formGuruError.textContent = '';
  modalGuru.classList.remove('hidden');
}

function bukaModalEditGuru(nip, semuaData) {
  const guru = semuaData.find(function (g) { return g.nip === nip; });
  if (!guru) return;

  document.getElementById('modalGuruTitle').textContent = 'Edit Data Guru';
  nipEditAktif = guru.nip;

  document.getElementById('inputNip').value = guru.nip || '';
  document.getElementById('inputNip').disabled = true;
  document.getElementById('inputNamaGuru').value = guru.nama || '';
  document.getElementById('inputMapel').value = guru.mapel || '';
  document.getElementById('inputKelasAjar').value = guru.kelas_ajar || '';
  document.getElementById('inputJurusanAjar').value = guru.jurusan_ajar || '';

  formGuruError.textContent = '';
  modalGuru.classList.remove('hidden');
}

function tutupModalGuru() {
  modalGuru.classList.add('hidden');
}

document.getElementById('btnTambahGuru').addEventListener('click', bukaModalTambahGuru);
document.getElementById('closeModalGuru').addEventListener('click', tutupModalGuru);
document.getElementById('cancelModalGuru').addEventListener('click', tutupModalGuru);

// ---- SUBMIT FORM (Tambah / Edit Guru) ----
formGuru.addEventListener('submit', async function (e) {
  e.preventDefault();

  const payload = {
    nip: document.getElementById('inputNip').value.trim(),
    nama: document.getElementById('inputNamaGuru').value.trim(),
    mapel: document.getElementById('inputMapel').value.trim(),
    kelasAjar: document.getElementById('inputKelasAjar').value.trim(),
    jurusanAjar: document.getElementById('inputJurusanAjar').value.trim()
  };

  formGuruError.textContent = 'Menyimpan...';

  try {
    let response;
    if (nipEditAktif) {
      response = await fetch('/api/guru/' + nipEditAktif, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    } else {
      response = await fetch('/api/guru', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    }

    const result = await response.json();

    if (result.success) {
      tutupModalGuru();
      loadDataGuru();
    } else {
      formGuruError.textContent = result.message;
    }
  } catch (err) {
    formGuruError.textContent = 'Gagal terhubung ke server!';
  }
});

// ---- HAPUS DATA GURU ----
async function hapusGuru(nip) {
  const konfirmasi = confirm('Yakin ingin menghapus data guru ini?');
  if (!konfirmasi) return;

  try {
    const response = await fetch('/api/guru/' + nip, { method: 'DELETE' });
    const result = await response.json();

    if (result.success) {
      loadDataGuru();
    } else {
      alert('Gagal menghapus: ' + result.message);
    }
  } catch (err) {
    alert('Gagal terhubung ke server!');
  }
}

// ---- MODAL PENGATURAN KOP & TTD ----
const modalKop = document.getElementById('modalKop');
const formKop = document.getElementById('formKop');
const formKopError = document.getElementById('formKopError');

document.getElementById('btnPengaturanKop').addEventListener('click', async function () {
  try {
    const response = await fetch('/api/config');
    const result = await response.json();

    if (result.success) {
      const cfg = result.data;
      document.getElementById('cfgKop1').value = cfg.kop_instansi_1 || '';
      document.getElementById('cfgKop2').value = cfg.kop_instansi_2 || '';
      document.getElementById('cfgKop3').value = cfg.kop_instansi_3 || '';
      document.getElementById('cfgAlamat').value = cfg.kop_alamat || '';
      document.getElementById('cfgTtdKota').value = cfg.ttd_kota || '';
      document.getElementById('cfgTtdJabatan').value = cfg.ttd_jabatan || '';
      document.getElementById('cfgTtdNama').value = cfg.ttd_nama || '';
      document.getElementById('cfgTtdNip').value = cfg.ttd_nip || '';
    }

    formKopError.textContent = '';
    modalKop.classList.remove('hidden');
  } catch (err) {
    alert('Gagal memuat konfigurasi!');
  }
});

document.getElementById('closeModalKop').addEventListener('click', function () {
  modalKop.classList.add('hidden');
});
document.getElementById('cancelModalKop').addEventListener('click', function () {
  modalKop.classList.add('hidden');
});

// ---- SUBMIT FORM KONFIGURASI ----
formKop.addEventListener('submit', async function (e) {
  e.preventDefault();

  const payload = {
    kop_instansi_1: document.getElementById('cfgKop1').value.trim(),
    kop_instansi_2: document.getElementById('cfgKop2').value.trim(),
    kop_instansi_3: document.getElementById('cfgKop3').value.trim(),
    kop_alamat: document.getElementById('cfgAlamat').value.trim(),
    ttd_kota: document.getElementById('cfgTtdKota').value.trim(),
    ttd_jabatan: document.getElementById('cfgTtdJabatan').value.trim(),
    ttd_nama: document.getElementById('cfgTtdNama').value.trim(),
    ttd_nip: document.getElementById('cfgTtdNip').value.trim()
  };

  formKopError.textContent = 'Menyimpan...';

  try {
    const response = await fetch('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const result = await response.json();

    if (result.success) {
      modalKop.classList.add('hidden');
      alert('Konfigurasi berhasil disimpan! Kop surat di laporan PDF akan otomatis terupdate.');
    } else {
      formKopError.textContent = result.message;
    }
  } catch (err) {
    formKopError.textContent = 'Gagal terhubung ke server!';
  }
});