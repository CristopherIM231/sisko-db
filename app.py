from flask import Flask, render_template, request, jsonify, send_file, make_response
import pymysql
import os
from werkzeug.utils import secure_filename
from xhtml2pdf import pisa
from io import BytesIO
from datetime import datetime

app = Flask(__name__)

def get_db_connection():
    connection = pymysql.connect(
        host='localhost',
        port=8111,
        user='root',
        password='',
        database='db_sisko',
        cursorclass=pymysql.cursors.DictCursor
    )
    return connection

@app.route('/')
def home():
    return render_template('index.html')

# ---- API LOGIN ----
@app.route('/api/login', methods=['POST'])
def login():
    data = request.get_json()
    username = data.get('username')
    password = data.get('password')

    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute(
            "SELECT * FROM users WHERE username = %s AND password = %s",
            (username, password)
        )
        user = cursor.fetchone()
        conn.close()

        if user:
            return jsonify({
                "success": True,
                "role": user['role'],
                "nisn": user['nisn'],
                "nama": user['nama_lengkap'],
                "username": user['username']
            })
        else:
            return jsonify({"success": False, "message": "Username atau password salah!"})

    except Exception as e:
        return jsonify({"success": False, "message": str(e)})

# ---- API: AMBIL SEMUA DATA SISWA ----
@app.route('/api/siswa', methods=['GET'])
def get_siswa():
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM data_siswa ORDER BY nama ASC")
        siswa = cursor.fetchall()
        conn.close()

        for s in siswa:
            if s['tgl_lahir']:
                s['tgl_lahir'] = s['tgl_lahir'].strftime('%Y-%m-%d')
            if s['timestamp']:
                s['timestamp'] = s['timestamp'].strftime('%d/%m/%Y %H:%M:%S')

        return jsonify({"success": True, "data": siswa})
    except Exception as e:
        return jsonify({"success": False, "message": str(e)})

# ---- API: TAMBAH SISWA BARU ----
@app.route('/api/siswa', methods=['POST'])
def add_siswa():
    data = request.get_json()

    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        cursor.execute("SELECT id FROM data_siswa WHERE nisn = %s", (data.get('nisn'),))
        if cursor.fetchone():
            conn.close()
            return jsonify({"success": False, "message": "NISN sudah terdaftar!"})

        cursor.execute("""
            INSERT INTO data_siswa
            (nama, nisn, jk, tgl_lahir, nama_ayah, nama_ibu, no_hp, kelas, jurusan, alamat, kode_pos)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """, (
            data.get('nama'), data.get('nisn'), data.get('jk'),
            data.get('tglLahir') or None, data.get('namaAyah'), data.get('namaIbu'),
            data.get('noHp'), data.get('kelas'), data.get('jurusan'),
            data.get('alamat'), data.get('kodePos')
        ))
        conn.commit()
        conn.close()

        return jsonify({"success": True, "message": "Data Siswa berhasil ditambahkan!"})

    except Exception as e:
        return jsonify({"success": False, "message": str(e)})

# ---- API: EDIT DATA SISWA ----
@app.route('/api/siswa/<nisn>', methods=['PUT'])
def update_siswa(nisn):
    data = request.get_json()

    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        cursor.execute("""
            UPDATE data_siswa SET
                nama = %s, jk = %s, tgl_lahir = %s, nama_ayah = %s,
                nama_ibu = %s, no_hp = %s, kelas = %s, jurusan = %s,
                alamat = %s, kode_pos = %s
            WHERE nisn = %s
        """, (
            data.get('nama'), data.get('jk'), data.get('tglLahir') or None,
            data.get('namaAyah'), data.get('namaIbu'), data.get('noHp'),
            data.get('kelas'), data.get('jurusan'), data.get('alamat'),
            data.get('kodePos'), nisn
        ))
        conn.commit()
        conn.close()

        return jsonify({"success": True, "message": "Data Siswa berhasil diperbarui!"})

    except Exception as e:
        return jsonify({"success": False, "message": str(e)})

# ---- API: HAPUS DATA SISWA ----
@app.route('/api/siswa/<nisn>', methods=['DELETE'])
def delete_siswa(nisn):
    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        cursor.execute("DELETE FROM data_siswa WHERE nisn = %s", (nisn,))
        conn.commit()
        conn.close()

        return jsonify({"success": True, "message": "Data Siswa berhasil dihapus!"})

    except Exception as e:
        return jsonify({"success": False, "message": str(e)})
# ---- API: UPLOAD FOTO SISWA ----
UPLOAD_FOLDER = os.path.join('static', 'uploads')

@app.route('/api/siswa/<nisn>/foto', methods=['POST'])
def upload_foto(nisn):
    try:
        if 'foto' not in request.files:
            return jsonify({"success": False, "message": "Tidak ada file yang dikirim!"})

        file = request.files['foto']
        if file.filename == '':
            return jsonify({"success": False, "message": "Nama file kosong!"})

        # Pastikan folder uploads ada, kalau belum, buat otomatis
        os.makedirs(UPLOAD_FOLDER, exist_ok=True)

        # Amankan nama file & buat nama unik berdasarkan NISN
        ext = file.filename.rsplit('.', 1)[-1].lower()
        filename = secure_filename(f"{nisn}.{ext}")
        filepath = os.path.join(UPLOAD_FOLDER, filename)
        file.save(filepath)

        # Simpan path relatif ke database (supaya bisa diakses lewat browser)
        foto_url = f"/static/uploads/{filename}"

        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("UPDATE data_siswa SET foto_url = %s WHERE nisn = %s", (foto_url, nisn))
        conn.commit()
        conn.close()

        return jsonify({"success": True, "message": "Foto berhasil diupload!", "foto_url": foto_url})

    except Exception as e:
        return jsonify({"success": False, "message": str(e)})

# ---- API: EXPORT PDF DATA SISWA ----
@app.route('/api/export/siswa/pdf', methods=['GET'])
def export_siswa_pdf():
    try:
        kelas = request.args.get('kelas', 'all')
        jurusan = request.args.get('jurusan', 'all')

        conn = get_db_connection()
        cursor = conn.cursor()

        query = "SELECT * FROM data_siswa WHERE 1=1"
        params = []

        if kelas != 'all':
            query += " AND kelas = %s"
            params.append(kelas)
        if jurusan != 'all':
            query += " AND jurusan = %s"
            params.append(jurusan)

        query += " ORDER BY nama ASC"
        cursor.execute(query, params)
        siswa = cursor.fetchall()
        conn.close()

        # Format tanggal lahir supaya rapi tampil di PDF
        for s in siswa:
            if s['tgl_lahir']:
                s['tgl_lahir'] = s['tgl_lahir'].strftime('%d-%m-%Y')

        # Bangun isi tabel HTML baris per baris
        rows_html = ""
        if not siswa:
            rows_html = '<tr><td colspan="9" style="text-align:center; padding:20px;">Data tidak tersedia</td></tr>'
        else:
            for i, s in enumerate(siswa, start=1):
                rows_html += f"""
                <tr>
                    <td>{i}</td>
                    <td>{s['nama']}</td>
                    <td>{s['nisn']}</td>
                    <td>{s['jk'] or '-'}</td>
                    <td>{s['tgl_lahir'] or '-'}</td>
                    <td>{s['kelas'] or '-'}</td>
                    <td>{s['jurusan'] or '-'}</td>
                    <td>{s['no_hp'] or '-'}</td>
                    <td>{s['alamat'] or '-'}</td>
                </tr>
                """

        subtitle = f"KELAS {kelas}" if kelas != 'all' else "SEMUA SISWA"
        tanggal_cetak = datetime.now().strftime('%d-%m-%Y %H:%M')

        html_content = f"""
        <html>
        <head>
        <style>
            @page {{ size: A4 landscape; margin: 1.5cm; }}
            body {{ font-family: Helvetica, sans-serif; font-size: 10px; }}
            h2 {{ text-align: center; margin-bottom: 2px; }}
            h4 {{ text-align: center; margin-top: 0; font-weight: normal; color: #555; }}
            table {{ width: 100%; border-collapse: collapse; margin-top: 15px; }}
            th, td {{ border: 1px solid #333; padding: 5px; text-align: left; }}
            th {{ background-color: #2b2560; color: white; }}
            .footer {{ margin-top: 20px; font-size: 9px; color: #666; text-align: right; }}
        </style>
        </head>
        <body>
            <h2>LAPORAN DATA SISWA</h2>
            <h4>{subtitle}</h4>
            <table>
                <thead>
                    <tr>
                        <th>No</th><th>Nama</th><th>NISN</th><th>L/P</th><th>Tgl Lahir</th>
                        <th>Kelas</th><th>Jurusan</th><th>No HP</th><th>Alamat</th>
                    </tr>
                </thead>
                <tbody>
                    {rows_html}
                </tbody>
            </table>
            <p class="footer">Dicetak pada: {tanggal_cetak}</p>
        </body>
        </html>
        """

        # Ubah HTML jadi PDF, simpan sementara di memori (bukan file fisik di komputer)
        pdf_buffer = BytesIO()
        pisa.CreatePDF(html_content, dest=pdf_buffer)
        pdf_buffer.seek(0)

        response = make_response(pdf_buffer.read())
        response.headers['Content-Type'] = 'application/pdf'
        response.headers['Content-Disposition'] = 'inline; filename=laporan_data_siswa.pdf'
        return response

    except Exception as e:
        return jsonify({"success": False, "message": str(e)})

# ---- API: EXPORT EXCEL DATA SISWA ----
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill

@app.route('/api/export/siswa/excel', methods=['GET'])
def export_siswa_excel():
    try:
        kelas = request.args.get('kelas', 'all')
        jurusan = request.args.get('jurusan', 'all')

        conn = get_db_connection()
        cursor = conn.cursor()

        query = "SELECT * FROM data_siswa WHERE 1=1"
        params = []
        if kelas != 'all':
            query += " AND kelas = %s"
            params.append(kelas)
        if jurusan != 'all':
            query += " AND jurusan = %s"
            params.append(jurusan)
        query += " ORDER BY nama ASC"

        cursor.execute(query, params)
        siswa = cursor.fetchall()
        conn.close()

        wb = Workbook()
        ws = wb.active
        ws.title = "Data Siswa"

        headers = ["No", "Nama", "NISN", "L/P", "Tgl Lahir", "Nama Ayah", "Nama Ibu", "No HP", "Kelas", "Jurusan", "Alamat", "Kode Pos"]
        ws.append(headers)

        # Styling header (mirip logika Apps Script lama: header kuning tebal)
        for cell in ws[1]:
            cell.font = Font(bold=True)
            cell.fill = PatternFill(start_color="FFFF00", end_color="FFFF00", fill_type="solid")

        for i, s in enumerate(siswa, start=1):
            tgl_lahir = s['tgl_lahir'].strftime('%d-%m-%Y') if s['tgl_lahir'] else ''
            ws.append([
                i, s['nama'], s['nisn'], s['jk'], tgl_lahir,
                s['nama_ayah'], s['nama_ibu'], s['no_hp'],
                s['kelas'], s['jurusan'], s['alamat'], s['kode_pos']
            ])

        # Auto-lebar kolom biar rapi
        for col in ws.columns:
            max_length = max(len(str(cell.value)) if cell.value else 0 for cell in col)
            ws.column_dimensions[col[0].column_letter].width = max_length + 3

        excel_buffer = BytesIO()
        wb.save(excel_buffer)
        excel_buffer.seek(0)

        response = make_response(excel_buffer.read())
        response.headers['Content-Type'] = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        response.headers['Content-Disposition'] = 'attachment; filename=laporan_data_siswa.xlsx'
        return response

    except Exception as e:
        return jsonify({"success": False, "message": str(e)})

# ---- API: EXPORT PDF DATA GURU ----
@app.route('/api/export/guru/pdf', methods=['GET'])
def export_guru_pdf():
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM data_guru ORDER BY nama ASC")
        guru = cursor.fetchall()
        conn.close()

        rows_html = ""
        if not guru:
            rows_html = '<tr><td colspan="6" style="text-align:center; padding:20px;">Data tidak tersedia</td></tr>'
        else:
            for i, g in enumerate(guru, start=1):
                rows_html += f"""
                <tr>
                    <td>{i}</td>
                    <td>{g['nip']}</td>
                    <td>{g['nama']}</td>
                    <td>{g['mapel'] or '-'}</td>
                    <td>{g['kelas_ajar'] or '-'}</td>
                    <td>{g['jurusan_ajar'] or '-'}</td>
                </tr>
                """

        tanggal_cetak = datetime.now().strftime('%d-%m-%Y %H:%M')

        html_content = f"""
        <html>
        <head>
        <style>
            @page {{ size: A4 landscape; margin: 1.5cm; }}
            body {{ font-family: Helvetica, sans-serif; font-size: 11px; }}
            h2 {{ text-align: center; margin-bottom: 2px; }}
            h4 {{ text-align: center; margin-top: 0; font-weight: normal; color: #555; }}
            table {{ width: 100%; border-collapse: collapse; margin-top: 15px; }}
            th, td {{ border: 1px solid #333; padding: 6px; text-align: left; }}
            th {{ background-color: #2b2560; color: white; }}
            .footer {{ margin-top: 20px; font-size: 9px; color: #666; text-align: right; }}
        </style>
        </head>
        <body>
            <h2>LAPORAN DATA GURU</h2>
            <h4>DATA PENGAJAR AKTIF</h4>
            <table>
                <thead>
                    <tr><th>No</th><th>NIP</th><th>Nama Guru</th><th>Mata Pelajaran</th><th>Kelas Ajar</th><th>Jurusan Ajar</th></tr>
                </thead>
                <tbody>{rows_html}</tbody>
            </table>
            <p class="footer">Dicetak pada: {tanggal_cetak}</p>
        </body>
        </html>
        """

        pdf_buffer = BytesIO()
        pisa.CreatePDF(html_content, dest=pdf_buffer)
        pdf_buffer.seek(0)

        response = make_response(pdf_buffer.read())
        response.headers['Content-Type'] = 'application/pdf'
        response.headers['Content-Disposition'] = 'inline; filename=laporan_data_guru.pdf'
        return response

    except Exception as e:
        return jsonify({"success": False, "message": str(e)})


# ---- API: EXPORT EXCEL DATA GURU ----
@app.route('/api/export/guru/excel', methods=['GET'])
def export_guru_excel():
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM data_guru ORDER BY nama ASC")
        guru = cursor.fetchall()
        conn.close()

        wb = Workbook()
        ws = wb.active
        ws.title = "Data Guru"

        headers = ["No", "NIP", "Nama Guru", "Mata Pelajaran", "Kelas Ajar", "Jurusan Ajar"]
        ws.append(headers)

        for cell in ws[1]:
            cell.font = Font(bold=True)
            cell.fill = PatternFill(start_color="FFFF00", end_color="FFFF00", fill_type="solid")

        for i, g in enumerate(guru, start=1):
            ws.append([i, g['nip'], g['nama'], g['mapel'], g['kelas_ajar'], g['jurusan_ajar']])

        for col in ws.columns:
            max_length = max(len(str(cell.value)) if cell.value else 0 for cell in col)
            ws.column_dimensions[col[0].column_letter].width = max_length + 3

        excel_buffer = BytesIO()
        wb.save(excel_buffer)
        excel_buffer.seek(0)

        response = make_response(excel_buffer.read())
        response.headers['Content-Type'] = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        response.headers['Content-Disposition'] = 'attachment; filename=laporan_data_guru.xlsx'
        return response

    except Exception as e:
        return jsonify({"success": False, "message": str(e)})

# ---- API: AMBIL DATA GURU (untuk preview) ----
@app.route('/api/guru', methods=['GET'])
def get_guru():
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM data_guru ORDER BY nama ASC")
        guru = cursor.fetchall()
        conn.close()
        return jsonify({"success": True, "data": guru})
    except Exception as e:
        return jsonify({"success": False, "message": str(e)})
                        
if __name__ == '__main__':
    app.run(debug=True, port=5000, use_reloader=False)