import logging
import os
import uvicorn
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Query
from youtube_transcript_api import YouTubeTranscriptApi, NoTranscriptFound
from fastapi.middleware.cors import CORSMiddleware
from semantic_kernel import Kernel
from semantic_kernel.connectors.ai.google.google_ai import GoogleAIChatCompletion, GoogleAIChatPromptExecutionSettings
from semantic_kernel.contents import ChatHistory
from google.protobuf.json_format import MessageToDict

# Logging setup
def setup_logging():
    logger = logging.getLogger("app_logger")
    logger.setLevel(logging.DEBUG)

    console_handler = logging.StreamHandler()
    console_handler.setLevel(logging.DEBUG)
    console_format = logging.Formatter('%(asctime)s - %(levelname)s - %(message)s')
    console_handler.setFormatter(console_format)

    file_handler = logging.FileHandler("app.log", encoding='utf-8')
    file_handler.setLevel(logging.INFO)
    file_format = logging.Formatter('%(asctime)s - %(levelname)s - %(message)s')
    file_handler.setFormatter(file_format)

    logger.addHandler(console_handler)
    logger.addHandler(file_handler)

    return logger

logger = setup_logging()

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify your domains
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

logger.info("Application starting and CORS middleware added.")

# Load .env file
load_dotenv()

# Load API key from environment variable
api_key = os.getenv("AI_KEY")
if not api_key:
    logger.error("API key is missing.")
    raise RuntimeError("API key is missing.")

# Map language codes to English language names for better clarity in prompts
language_map = {
    "en": "English",
    "tr": "Turkish",
    "es": "Spanish",
    "fr": "French",
    "de": "German",
    "hi": "Hindi",
    "pt": "Portuguese",
    "ru": "Russian",
    "ja": "Japanese",
    "zh-Hans": "Simplified Chinese"
}

# Fetch transcript function
def fetch_transcript(video_id, preferred_languages):
    try:
        transcripts = YouTubeTranscriptApi.list_transcripts(video_id)
        logger.info("Transcripts listed successfully.")
        transcript_data = None

        # Try to find a manually created transcript in preferred languages
        for lang in preferred_languages:
            try:
                transcript_data = transcripts.find_transcript([lang]).fetch()
                logger.info(f"Manually created transcript found: Language = {lang}")
                break
            except NoTranscriptFound:
                logger.debug(f"No manually created transcript found for: {lang}")
                continue

        # Try to find a generated transcript in preferred languages
        if not transcript_data:
            for lang in preferred_languages:
                try:
                    transcript_data = transcripts.find_generated_transcript([lang]).fetch()
                    logger.info(f"Generated transcript found: Language = {lang}")
                    break
                except NoTranscriptFound:
                    logger.debug(f"No generated transcript found for: {lang}")
                    continue

        # Fallback to any available transcript if none of the above worked
        if not transcript_data:
            try:
                first_transcript = next(iter(transcripts))
                transcript_data = first_transcript.fetch()
                logger.info(f"Any available transcript found: Language = {first_transcript.language}")
            except StopIteration:
                logger.error("No transcripts found at all.")
                raise HTTPException(status_code=400, detail="No transcripts found.")
        return transcript_data
    except Exception as e:
        logger.error(f"Error fetching transcript: {e}")
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/transcript")
async def get_transcript(
    video_id: str = Query(..., description="The YouTube video ID"),
    summary_language: str = Query("tr", description="Preferred summary language (e.g., 'en', 'tr', 'es')")
):
    logger.info(f"Transcript request received. Video ID: {video_id}, Summary language: {summary_language}")

    # Validate summary_language parameter
    if summary_language not in language_map:
        logger.warning(f"Invalid language code: {summary_language}. Defaulting to 'tr'.")
        summary_language = "tr"

    # Preferred languages for transcripts (in order)
    preferred_languages = [
        "en", "es", "zh-Hans", "hi", "ar", "pt", "ru", "ja", "fr", "de"
    ]

    try:
        transcript_data = fetch_transcript(video_id, preferred_languages)

        # Combine transcript text
        full_transcript_text = " ".join([entry['text'] for entry in transcript_data])
        logger.info("Transcript text combined successfully.")

        # Determine the target language name from the map, defaulting to Turkish if not found
        chosen_language_name = language_map.get(summary_language, "Turkish")

        # Create Microsoft Semantic Kernel
        kernel = Kernel()
        chat_completion_service = GoogleAIChatCompletion(
            gemini_model_id="gemini-2.0-flash-exp",
            api_key=api_key,
            service_id="gemini"
        )
        execution_settings = GoogleAIChatPromptExecutionSettings()
        kernel.add_service(chat_completion_service)

        chat_history = ChatHistory()
        chat_history.add_system_message(f"Please summarize the following transcript in {chosen_language_name}. Just summarize and do not add any headings.")
        chat_history.add_user_message(f"{full_transcript_text}")
        
        response = await chat_completion_service.get_chat_message_content(
            chat_history=chat_history,
            settings=execution_settings,
        )

        logger.info("Microsoft Semantic Kernel created successfully.")
        
        summary = response.content if hasattr(response, 'content') else str(response)
        logger.info("Summary successfully created.")
        
        return {"summary": summary}

    except HTTPException as http_exc:
        logger.error(f"HTTP error occurred: {http_exc.detail}")
        raise http_exc
    except Exception as e:
        logger.error(f"General error occurred: {e}")
        raise HTTPException(status_code=400, detail=str(e))

if __name__ == "__main__":
    uvicorn.run(app, host="localhost", port=8000)