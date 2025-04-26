#working on the genration portion no db with uploaded pic path here yet
# @app.route('/generate', methods=['POST'])
# def generate_image():
#
#     data = request.get_json()
#     fname = data.get('filename', '').strip()
#     prompt = data.get('prompt', '').strip()
#
#
#     if not fname or not prompt:
#         return jsonify({"error": "Both 'filename' and 'prompt' are required"}), 400
#
#
#     orig_path = os.path.join(app.config['UPLOAD_FOLDER'], fname)
#     if not os.path.isfile(orig_path):
#         return jsonify({"error": "File not found"}), 404
#
#
#     mask_path = os.path.join(app.config['UPLOAD_FOLDER'], f"mask_{fname}")
#
#     with open(orig_path, 'rb') as src, open(mask_path, 'wb') as dst:
#         dst.write(src.read())
#
#
#     try:
#         with open(orig_path, 'rb') as img_file, open(mask_path, 'rb') as mask_file:
#             api_resp = openai.Image.create_edit(
#                 image=img_file,
#                 mask=mask_file,
#                 prompt=prompt,
#                 n=1,
#                 size="1024x1024"
#             )
#     except Exception as e:
#         return jsonify({"error": f"OpenAI API error: {e}"}), 500
#
#     gen_url = api_resp['data'][0]['url']
#
#     return jsonify({
#         "original_file": orig_path,
#         "generated_url": gen_url
#     }), 200
# @app.route('/generate', methods=['POST'])
# def generate_image():
#     data = request.get_json()
#     fname = data.get('filename', '').strip()
#     prompt = data.get('prompt', '').strip()
#
#     if not fname or not prompt:
#         return jsonify({"error": "Both 'filename' and 'prompt' are required"}), 400
#
#     # Use the correct absolute path to the uploaded file
#     orig_path = os.path.join(app.config['UPLOAD_FOLDER'], fname)
#     if not os.path.isfile(orig_path):
#         return jsonify({"error": "File not found"}), 404
#
#     # Create an all-white mask of the same size (reuse original file for simplicity)
#     mask_path = os.path.join(app.config['UPLOAD_FOLDER'], f"mask_{fname}")
#     with open(orig_path, 'rb') as src, open(mask_path, 'wb') as dst:
#         dst.write(src.read())  # Simple copy for mask
#
#     # Call OpenAI API
#     try:
#         with open(orig_path, 'rb') as img_file, open(mask_path, 'rb') as mask_file:
#             api_resp = openai.Image.create_edit(
#                 image=img_file,
#                 mask=mask_file,
#                 prompt=prompt,
#                 n=1,
#                 size="1024x1024"
#             )
#     except Exception as e:
#         return jsonify({"error": f"OpenAI API error: {e}"}), 500
#
#     gen_url = api_resp['data'][0]['url']
#
#     return jsonify({
#         "original_file": orig_path,
#         "generated_url": gen_url
#     }), 200