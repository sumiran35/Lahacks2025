from flask import Flask, request, jsonify, render_template
import psycopg2
from psycopg2 import OperationalError, errors
import os
import uuid
from flask_cors import CORS
app = Flask(__name__)
CORS(app)

DB_NAME = os.environ.get("PG_DB_NAME", "sumiranmishra")
DB_USER = os.environ.get("PG_DB_USER", "sumiranmishra")
DB_PASSWORD = os.environ.get("PG_DB_PASSWORD", "Employee12@")
DB_HOST = os.environ.get("PG_DB_HOST", "localhost")
DB_PORT = os.environ.get("PG_DB_PORT", "5432")


def get_db_connection():
    try:
        return psycopg2.connect(
            database=DB_NAME,
            user=DB_USER,
            password=DB_PASSWORD,
            host=DB_HOST,
            port=DB_PORT
        )
    except OperationalError as e:
        print(f"Database connection failed: {e}")
        return None


def create_users_table():
    conn = get_db_connection()
    if conn:
        try:
            with conn.cursor() as cursor:

                cursor.execute("CREATE EXTENSION IF NOT EXISTS pgcrypto;")


                cursor.execute("""
                    CREATE TABLE IF NOT EXISTS users_la_hacks (
                        uid UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                        ufname VARCHAR(255) NOT NULL,
                        ulname VARCHAR(255) NOT NULL,
                        uemail VARCHAR(255) UNIQUE NOT NULL,
                        amazon_pts INT DEFAULT 0,
                        costco_pts INT DEFAULT 0,
                        walmart_pts INT DEFAULT 0,
                        ngo_pts INT DEFAULT 0,
                        password_hash TEXT NOT NULL,
                        created_at TIMESTAMP DEFAULT NOW()
                    );
                """)
                conn.commit()
                print("Users table created successfully.")
        except Exception as e:
            print(f"Error creating table: {e}")
            conn.rollback()
        finally:
            conn.close()


with app.app_context():
    create_users_table()

@app.route('/')
def index():
    return render_template('index.html')
# User Registration Endpoint
@app.route('/register', methods=['POST'])
def register_user():
    conn = get_db_connection()
    if not conn:
        return jsonify({"error": "Database connection failed"}), 500

    try:
        data = request.get_json()
        required_fields = ['ufname', 'ulname', 'uemail', 'password']
        if not all(field in data for field in required_fields):
            return jsonify({"error": "Missing required fields"}), 400

        with conn.cursor() as cursor:
            # Insert user with hashed password
            cursor.execute("""
                INSERT INTO users_la_hacks 
                    (ufname, ulname, uemail, password_hash)
                VALUES
                    (%s, %s, %s, crypt(%s, gen_salt('bf')))
                RETURNING uid;
            """, (data['ufname'], data['ulname'],
                  data['uemail'], data['password']))

            user_id = cursor.fetchone()[0]
            conn.commit()
            return jsonify({
                "message": "User registered successfully",
                "uid": str(user_id)
            }), 201

    except errors.UniqueViolation:
        conn.rollback()
        return jsonify({"error": "Email already exists"}), 409
    except Exception as e:
        conn.rollback()
        return jsonify({"error": str(e)}), 500
    finally:
        conn.close()


# User Login Endpoint
@app.route('/login', methods=['POST'])
def login_user():
    conn = get_db_connection()
    if not conn:
        return jsonify({"error": "Database connection failed"}), 500

    try:
        data = request.get_json()
        if not data or 'uemail' not in data or 'password' not in data:
            return jsonify({"error": "Email and password required"}), 400

        with conn.cursor() as cursor:
            cursor.execute("""
                SELECT uid, ufname, ulname, uemail,
                       amazon_pts, costco_pts, walmart_pts, ngo_pts
                FROM users_la_hacks
                WHERE uemail = %s 
                AND password_hash = crypt(%s, password_hash);
            """, (data['uemail'], data['password']))

            user = cursor.fetchone()
            if user:
                return jsonify({
                    "uid": user[0],
                    "ufname": user[1],
                    "ulname": user[2],
                    "uemail": user[3],
                    "points": {
                        "amazon": user[4],
                        "costco": user[5],
                        "walmart": user[6],
                        "ngo": user[7]
                    }
                }), 200
            else:
                return jsonify({"error": "Invalid credentials"}), 401

    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        conn.close()


if __name__ == '__main__':
    app.run(debug=True)