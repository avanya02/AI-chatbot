const lottieLoad = document.getElementById("lottie-load");
const submitButton = document.getElementById("submit-button");
let storedContent = "";
const lottieResponse = document.getElementById("lottie-response");
let stored_questions = [];
let currentQuestionIndex = 0;
let practise = document.getElementById("practise")
let here = document.getElementById("here");
let que_status = false;
let lottie_que = document.getElementById("lottie-que")

//let listen = document.getElementById("listen") 
//let listen_status = false;
let currentQuestionController = null;
let currentTypewriterTimeout = null;

document.getElementById("prompt").addEventListener("keydown", function(event) {
    
    if (event.key === "Enter") {
    event.preventDefault();
    sendPrompt();
  }
});

function play() {
    console.log("play button clicked");
    window.speechSynthesis.cancel();

    if (storedContent.length === 0) {
        let noContentSpeech = new SpeechSynthesisUtterance("No content available to read");
        window.speechSynthesis.speak(noContentSpeech);
        return;
    }

    function splitText(text, maxLength = 200) {
        let parts = [];
        while (text.length > maxLength) {
            let lastSpace = text.lastIndexOf(" ", maxLength);
            let chunk = lastSpace > 0 ? text.slice(0, lastSpace) : text.slice(0, maxLength);
            parts.push(chunk);
            text = text.slice(chunk.length).trim();
        }
        if (text.length > 0) {
            parts.push(text);
        }
        return parts;
    }

    const textChunks = splitText(storedContent, 200);

    function speakChunks(index = 0) {
        if (index >= textChunks.length) return;

        let speech = new SpeechSynthesisUtterance(textChunks[index]);
        speech.rate = 1;
        speech.pitch = 1;

        speech.onend = () => speakChunks(index + 1);
        window.speechSynthesis.speak(speech);
    }

    if (window.speechSynthesis.getVoices().length > 0) {
        speakChunks();
    } else {
        window.speechSynthesis.onvoiceschanged = function () {
            speakChunks();
        };
    }
}

function prevQuestion() {
    if (currentQuestionIndex > 0) {
        currentQuestionIndex--;
        showQuestion(currentQuestionIndex);
    } else {
        console.warn("Already at the first question.");
    }
}

async function sendPrompt() {
    const prompt = document.getElementById("prompt").value;

    if (!prompt.trim()) {
        alert("Please enter a prompt.");
        return;
    }


    document.getElementById("response").innerText = "";
    document.getElementById("questions").innerHTML = "";
    practise.style.display = 'none';
    here.style.display = 'none';
    submitButton.style.display = 'none';
    //listen.style.display = 'none';
    lottieLoad.style.display = 'block';
    console.log("..generating content..");

    if (currentTypewriterTimeout) {
        clearTimeout(currentTypewriterTimeout);
        currentTypewriterTimeout = null;
    }

    // Abort any pending question requests
    if (currentQuestionController) {
        currentQuestionController.abort();
        currentQuestionController = null;
    }


    stored_questions = [];
    currentQuestionIndex = 0;
    que_status = false;

    fetchContent(prompt);
}

async function fetchContent(prompt) {
    try {
        const response = await fetch('http://127.0.0.1:5000/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt: prompt })
        })


        if (!response.ok) throw new Error("Error in response from API");

        const data = await response.json();
        storedContent = data.response.replace(/[*/_#@$%^&+=<>{}[\]|\\]/g, "");
        
        


        lottieLoad.style.display = 'none';
        submitButton.style.display = 'block';
        //listen.style.display = 'block';

        typeWriterEffect(storedContent, "response", 30);

        console.log("content received!!");
        await fetchQuestions();

    } catch (error) {
        console.error("error:", error);
        document.getElementById("response").innerText = "Error getting response.";
        lottieLoad.style.display = 'none';
        submitButton.style.display = 'block';
    }
}


async function fetchQuestions() {
    if (!storedContent) {
        console.log("no content available");
        return;
    }

    console.log('...generating questions...');
    que_status = true;

    if (currentQuestionController) {
        currentQuestionController.abort();
    }

    currentQuestionController = new AbortController();
    const signal = currentQuestionController.signal;

    try {
        const questionsResponse = await fetch('http://127.0.0.1:5000/get_questions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content: storedContent }),
            signal: signal
        });

        if (!questionsResponse.ok) throw new Error("Error fetching questions");

        const questionsData = await questionsResponse.json();

        let raw_questions = questionsData.qa_pairs || [];

        stored_questions = raw_questions.filter(q => q.question && !q.question.startsWith("Here are"));
        que_status = false;

        console.log("questions:", stored_questions);

    } catch (error) {
        if (error.name === 'AbortError') {
            console.log('Question fetch aborted');
        } else {
            console.error("error fetching questions:", error);
            que_status = false;
        }
    } finally {
        if (currentQuestionController && currentQuestionController.signal.aborted) {
            currentQuestionController = null;
        }
    }
}

function getQuestions() {
    lottie_que.style.display = 'block';

    let checkques = setInterval(() => {
        if (stored_questions.length > 0) {
            lottie_que.style.display = 'none';
            displayQuestions(stored_questions);
            clearInterval(checkques);
        }
        if (stored_questions.length === 0 && que_status == false) {
            lottie_que.style.display = 'none';
            document.getElementById("questions").innerText = "No questions available";
            clearInterval(checkques);
        }
    }, 500);
}

function displayQuestions(qaPairs) {
    const questionsContainer = document.getElementById("questions");
    questionsContainer.innerHTML = "";
    if (qaPairs.length === 0) {
        questionsContainer.innerHTML = "<p>No questions available.</p>";
        return;
    }

    stored_questions = qaPairs;
    showQuestion(currentQuestionIndex);
}

function showQuestion(index) {
    if (index < 0 || index >= stored_questions.length) {
        console.error("invalid question index:", index);
        return;
    }

    const questionsContainer = document.getElementById("questions");
    questionsContainer.innerHTML = "";

    const pair = stored_questions[index];

    const questionCard = document.createElement("div");
    questionCard.classList.add("question-card");

    questionCard.innerHTML = `
        <button class="nav-btn left" onclick="prevQuestion()" ${index === 0 ? "disabled" : ""}>&#9664;</button>

        <div class="question-content">
            <p class="question-text"> ${pair.question}</p>
            <button class="show-answer-btn" onclick="toggleAnswer(${index})">Answer</button>
            <p class="answer-text" id="answer-${index}" style="display: none;"> ${pair.answer}</p>
        </div>

        <button class="nav-btn right" onclick="nextQuestion()" ${index === stored_questions.length - 1 ? "disabled" : ""}>&#9654;</button>
    `;

    questionsContainer.appendChild(questionCard);
}

function toggleAnswer(index) {
    const answer = document.getElementById(`answer-${index}`);
    const button = document.querySelector(`.show-answer-btn`);

    if (answer.style.display === "none") {
        answer.style.display = "block";
        button.innerText = "Hide";
    } else {
        answer.style.display = "none";
        button.innerText = "Answer";
    }
}

function nextQuestion() {
    if (currentQuestionIndex < stored_questions.length - 1) {
        currentQuestionIndex++;
        showQuestion(currentQuestionIndex);
    } else {
        console.warn("Already at the last question.");
    }
}

function typeWriterEffect(text, elementId, speed = 50) {
    let i = 0;
    const element = document.getElementById(elementId);
    //const cursor = document.getElementById("cursor");

    if (currentTypewriterTimeout) {
        clearTimeout(currentTypewriterTimeout);
        currentTypewriterTimeout = null;
    }

    element.innerHTML = "";
    //cursor.style.display = "inline-block";

    function type() {
        if (i < text.length) {
            element.innerHTML = text.substring(0, i + 1);
            i++;
            currentTypewriterTimeout = setTimeout(type, speed);
        } else {
            currentTypewriterTimeout = null;
            practise.style.display = "block";
            here.style.display = "block";
        }
    }

    type();
}