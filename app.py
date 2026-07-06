from flask import Flask, render_template, request, jsonify
import pymysql

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
        
if __name__ == '__main__':
    app.run(debug=True, port=5000, use_reloader=False)