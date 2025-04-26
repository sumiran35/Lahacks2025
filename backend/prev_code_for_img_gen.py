# Configure OpenAI
#openai.api_key = os.getenv("OPENAI_API_KEY")


# @app.route('/generate', methods=['POST'])
# def generate_image():
#     data = request.get_json()
#     fname = data.get('filename', '').strip()
#     prompt = data.get('prompt', '').strip()
#
#     if not fname or not prompt:
#         return jsonify({"error": "Both 'filename' and 'prompt' are required"}), 400
#
#     orig_path = os.path.join(app.config['UPLOAD_FOLDER'], fname)
#     if not os.path.isfile(orig_path):
#         return jsonify({"error": "File not found"}), 404
#
#     with open(orig_path, 'rb') as img_file:
#         try:
#             response = client.images.create(
#                 model="dall-e-3",
#                 prompt=prompt,
#                 image=img_file,
#                 n=1,
#                 size="1024x1024"
#             )
#             gen_url = response.data[0].url
#             return jsonify({"generated_url": gen_url}), 200
#         except Exception as e:
#             return jsonify({"error": f"OpenAI API error: {e}"}), 500