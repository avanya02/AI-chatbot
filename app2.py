from flask import Flask, request, jsonify, render_template
import ollama
from flask_cors import CORS
import json

app = Flask(__name__)
CORS(app)

@app.route('/')
def home():
    return render_template("index.html")


@app.route('/generate', methods=['POST'])
def generate_text():
    data = request.get_json()
    prompt = data.get("prompt", "")
    print(f"Received prompt: {prompt}...")        

    if not prompt:
        return jsonify({"error": "No prompt provided"}), 400

    try:
        response = ollama.chat(
            model='qwen2.5:0.5b',
            messages=[{'role': 'user', 'content': prompt}],
            stream=False
        )

        content = response['message']['content']
        return jsonify({"response": content})
    
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/get_questions", methods=["POST"])
def generate_questions():
    data = request.json
    print("Data received")

    if not data or "content" not in data:
        return jsonify({"error": "No content provided"}), 400

    context = data["content"]

    combined_prompt = (
        f"Based on the following text, generate 5 question-answer pairs in JSON format.\n"
        f"Text:\n{context}\n\n"
        f"Format the output as:\n"
        f"[\n"
        f"  {{\n"
        f"    \"question\": \"Your question here\",\n"
        f"    \"answer\": \"Answer to the question\"\n"
        f"  }},\n"
        #f"  ... (repeat for 5 total pairs)\n"
        f"]\n"
    )

    try:
        response = ollama.chat(
            model='llama3.2:1b',
            messages=[{'role': 'user', 'content': combined_prompt}],
            stream=False 
        )

        content = response['message']['content']

        
        start_idx = content.find('[')
        end_idx = content.rfind(']') + 1

        if start_idx >= 0 and end_idx > start_idx:
            json_str = content[start_idx:end_idx]
            try:
                qa_pairs = json.loads(json_str)
                return jsonify({"qa_pairs": qa_pairs})
            except json.JSONDecodeError:
                return jsonify({
                    "error": "Failed to parse model response",
                    "raw_response": content
                }), 500
        else:
            return jsonify({
                "error": "Invalid response format",
                "raw_response": content
            }), 500

    except Exception as e:
        return jsonify({"error": str(e)}), 500



if __name__ == '__main__':
    app.run(debug=True, threaded=True)