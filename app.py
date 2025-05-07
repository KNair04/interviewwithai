import os
import json
import random
from flask import Flask, render_template, request, jsonify
from twelvelabs import TwelveLabs
from twelvelabs.models.task import Task
import requests
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)

API_KEY = os.getenv('API_KEY')
API_URL = os.getenv('API_URL')
index_id = os.getenv('index_id')

client = TwelveLabs(api_key=API_KEY)

print("Environment Variables:")
print(f"API_URL exists: {'API_URL' in os.environ}")
print(f"API_KEY exists: {'API_KEY' in os.environ}")
print(f"index_id exists: {'index_id' in os.environ}")

INTERVIEW_QUESTIONS = [
    "Tell me about yourself.",
    "What are your greatest strengths?",
    "What do you consider to be your weaknesses?",
    "Where do you see yourself in five years?",
    "Why should we hire you?",
    "What motivates you?",
    "What are your career goals?",
    "How do you work in a team?",
    "What's your leadership style?"
]

def check_api_connection():
    try:
        api_url = "https://api.twelvelabs.io/v1.3/tasks" 
        print(f"Attempting to connect to API: {api_url}")
        print(f"API Key (first 4 chars): {API_KEY[:4]}...")
        
        response = requests.get(api_url, headers={
            "x-api-key": API_KEY,
            "Accept": "application/json"
        })
        print(f"Response status code: {response.status_code}")
        return response.status_code in [200, 401, 403]
    except requests.RequestException as e:
        print(f"API connection check failed. Detailed error: {str(e)}")
        return False

def process_api_response(data):
    processed_data = {
        "confidence": 0,
        "clarity": 0,
        "speech_rate": 0,
        "eye_contact": 0,
        "body_language": 0,
        "voice_tone": 0,
        "relevance": 0,
        "pronunciation": 0,
        "word_accuracy": 0,
        "imp_points": [],
        "improvement_tips": []
    }
    
    try:
        if isinstance(data, str):
            try:
                import re
                json_match = re.search(r'\{[\s\S]*\}', data)
                if json_match:
                    data = json.loads(json_match.group())
                else:
                    data = json.loads(data)
            except json.JSONDecodeError as e:
                print(f"JSON parsing error: {e}")
                print(f"Raw data: {data}")
                return processed_data
        
        if isinstance(data, dict):
            for key in processed_data.keys():
                if key in data:
                    if isinstance(data[key], (int, float)):
                        processed_data[key] = data[key]
                    elif isinstance(data[key], str) and data[key].replace('.', '').isdigit():
                        processed_data[key] = float(data[key])
                    elif key in ['imp_points', 'improvement_tips'] and isinstance(data[key], list):
                        processed_data[key] = data[key]
                        
    except Exception as e:
        print(f"Error processing response: {e}")
        print(f"Raw data: {data}")
    
    return processed_data

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/get_question')
def get_question():
    # Returns a random interview question
    question = random.choice(INTERVIEW_QUESTIONS)
    return jsonify({"question": question})

@app.route('/upload', methods=['POST'])
def upload():
    # Check API connectivity
    if not check_api_connection():
        return jsonify({"error": "Failed to connect to the Twelve Labs API."}), 500
    
    # Ensure video file is provided
    if 'video' not in request.files:
        return jsonify({"error": "No video file provided"}), 400
    
    # Require the interview question provided by the get_question endpoint
    if 'question' not in request.form or not request.form.get('question').strip():
        return jsonify({"error": "No interview question provided. Please use the question displayed on the screen."}), 400
    
    video = request.files['video']
    question = request.form.get('question').strip()
    
    if video.filename == '':
        return jsonify({"error": "No video file selected"}), 400

    video_path = os.path.join('uploads', 'interview.mp4')
    video.save(video_path)
    
    file_size = os.path.getsize(video_path)
    if file_size > 2 * 1024 * 1024 * 1024:  
        return jsonify({"error": "Video file size exceeds 2GB limit"}), 400

    try:
        task = client.task.create(
            index_id=index_id,
            file=video_path
        )
        
        def on_task_update(task: Task):
            print(f"Task Status={task.status}")

        task.wait_for_done(sleep_interval=5, callback=on_task_update)
        
        if task.status != "ready":
            raise RuntimeError(f"Indexing failed with status {task.status}")

        print("Task completed successfully. Video ID:", task.video_id)
        
                        # Optimized prompt to fit within API limits
        prompt = f"""You are an AI interviewer analyzing the candidate's response to: "{question}".  

**Evaluation Criteria (1-10 Scale):**  
**Relevance:** Lower scores if the response does not directly answer the question.  
**Clarity & Pronunciation:** Penalize unclear speech, mumbling, or mispronunciations.  
**Speech Rate & Confidence:** Deduct points for nervousness, monotone delivery, or excessive pauses.  
**Body Language & Eye Contact:** Reduce scores for poor posture, fidgeting, or lack of engagement.  

**Strictly grade responses:**  
- **10 = Excellent (clear, confident, fully relevant)**  
- **4-6 = Average (some mistakes, weak engagement, slightly off-topic)**  
- **1-3 = Poor (unclear, off-topic, lacks confidence, poor posture)**  

**JSON Output:**  
{{
    "confidence": <number>,
    "clarity": <number>,
    "speech_rate": <number>,
    "eye_contact": <number>,
    "body_language": <number>,
    "voice_tone": <number>,
    "relevance": <number>,
    "pronunciation": <number>,
    "word_accuracy": <number>,
    "imp_points": [<key issues>],
    "improvement_tips": [<suggestions>],
}}  

**Be strict**—penalize off-topic responses, weak body language, or unclear speech. Provide constructive improvement tips."""



        result = client.generate.text(
            video_id=task.video_id,
            prompt=prompt
        )
 
        print("Raw API Response:", result.data)
        
        processed_data = process_api_response(result.data)
        return jsonify(processed_data), 200
        
    except Exception as e:
        print(f"Error processing video: {str(e)}")
        return jsonify({"error": f"Error processing video: {str(e)}"}), 500
    
if __name__ == '__main__':
    os.makedirs('uploads', exist_ok=True)
    app.run(debug=True)