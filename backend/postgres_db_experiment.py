from flask import Flask, request, jsonify, render_template
import psycopg2
from psycopg2 import OperationalError, errors
import os
import uuid
from flask_cors import CORS
from openai import OpenAI
import base64
from PIL import Image
import io
import tempfile

app = Flask(__name__)
CORS(app)

DB_NAME = os.environ.get("PG_DB_NAME", "postgres")
DB_USER = os.environ.get("PG_DB_USER", "postgres")
DB_PASSWORD = os.environ.get("PG_DB_PASSWORD", "")
DB_HOST = os.environ.get("PG_DB_HOST", "localhost")
DB_PORT = os.environ.get("PG_DB_PORT", "5432")
UPLOAD_FOLDER = os.path.join(os.getcwd(), 'uploads')

if not os.path.exists(UPLOAD_FOLDER):
    os.makedirs(UPLOAD_FOLDER)

ALLOWED_EXTENSIONS = {'txt', 'pdf', 'png', 'jpg', 'jpeg', 'gif'}

app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024

# Initialize OpenAI client
client = OpenAI(api_key=os.environ.get("OPENAI_API_KEY"))

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

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

@app.route('/upload', methods=['POST'])
def upload_file():
    if 'file' not in request.files:
        return jsonify({"error": "No file part"}), 400
    file = request.files['file']
    if file.filename == '':
        return jsonify({"error": "No selected file"}), 400

    if file and allowed_file(file.filename):
        filename = str(uuid.uuid4()) + '.' + file.filename.rsplit('.', 1)[1].lower()  # Unique file name
        file_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        file.save(file_path)
        return jsonify({"message": f"File uploaded successfully! File path: {file_path}"}), 200
    else:
        return jsonify({"error": "Invalid file type"}), 400

@app.route('/generate-image-variation', methods=['POST'])
def generate_image_variation():
    """Generate variations of an uploaded image using OpenAI API"""
    
    # Check if image file is included in the request
    if 'image' not in request.files:
        return jsonify({"error": "No image file provided"}), 400
    
    image_file = request.files['image']
    
    # Check if a prompt was provided
    prompt = request.form.get('prompt', '')
    
    # Get number of variations (default to 1)
    n_variations = int(request.form.get('n', 1))
    if n_variations < 1 or n_variations > 4:  # OpenAI API limitation
        n_variations = 1
    
    # Get size parameter (default to 1024x1024)
    size = request.form.get('size', '1024x1024')
    if size not in ['256x256', '512x512', '1024x1024']:
        size = '1024x1024'
    
    # Get model parameter (default to dall-e-2)
    model = request.form.get('model', 'dall-e-2')
    
    try:
        # Save the uploaded image with a unique filename
        if image_file and allowed_file(image_file.filename):
            filename = str(uuid.uuid4()) + '.' + image_file.filename.rsplit('.', 1)[1].lower()
            image_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
            image_file.save(image_path)
            
            # Process the image to ensure it meets OpenAI requirements
            img = Image.open(image_path)
            
            # OpenAI requires square images
            # Resize and crop to square if needed
            width, height = img.size
            new_size = min(width, height)
            left = (width - new_size) / 2
            top = (height - new_size) / 2
            right = (width + new_size) / 2
            bottom = (height + new_size) / 2
            img = img.crop((left, top, right, bottom))
            
            # Resize to appropriate size for API
            img = img.resize((1024, 1024))
            
            # Save processed image
            img.save(image_path)
            
            try:
                # Call OpenAI API to generate variations
                with open(image_path, "rb") as img_file:
                    response = client.images.create_variation(
                        model=model,
                        image=img_file,
                        n=n_variations,
                        size=size,
                        prompt=prompt if prompt else None
                    )
                
                # Process the response
                variations = []
                for data in response.data:
                    variations.append({
                        "url": data.url,
                    })
                
                return jsonify({
                    "success": True,
                    "variations": variations,
                    "prompt_used": prompt,
                    "size": size,
                    "model": model
                })
                
            except Exception as e:
                return jsonify({
                    "success": False,
                    "error": str(e)
                }), 500
        else:
            return jsonify({"error": "Invalid file type"}), 400
                
    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500

if __name__ == '__main__':
    app.run(debug=True, host="localhost", port=8000)