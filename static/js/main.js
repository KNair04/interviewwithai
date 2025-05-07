document.addEventListener("DOMContentLoaded", () => {
    const elements = {
      startButton: document.getElementById("startInterviewButton"),
      sections: {
        start: document.getElementById("start-section"),
        interview: document.getElementById("interview-section"),
        result: document.getElementById("result-section"),
      },
      video: document.getElementById("videoElement"),
      videoContainer: document.getElementById("video-container"),
      question: document.getElementById("interview-question"),
      timers: {
        prep: document.getElementById("preparation-timer"),
        rec: document.getElementById("recording-timer"),
      },
      timerDisplays: {
        prep: document.getElementById("prep-time"),
        rec: document.getElementById("rec-time"),
      },
      status: document.getElementById("status-message"),
      result: document.getElementById("result"),
      progressBar: {
        container: document.getElementById("progress-bar-container"),
        progress: document.getElementById("analysis-progress"),
      },
    }
  
    let mediaRecorder
    let recordedChunks = []
    const prepTime = 20
    const recTime = 30
    let currentTimer
  
    // Add smooth page transitions
    function animateTransition(callback) {
      document.body.style.opacity = "0"
      setTimeout(() => {
        callback()
        setTimeout(() => {
          document.body.style.opacity = "1"
        }, 50)
      }, 300)
    }
  
    async function setupCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 640, height: 480 },
          audio: true,
        })
        elements.video.srcObject = stream
  
        const options = { mimeType: "video/mp4" }
        mediaRecorder = new MediaRecorder(stream, options)
  
        mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            recordedChunks.push(event.data)
          }
        }
  
        mediaRecorder.onstop = () => {
          const blob = new Blob(recordedChunks, { type: "video/mp4" })
          console.log("Recording stopped. Blob size:", blob.size, "bytes")
          if (blob.size > 0) {
            uploadVideo(blob)
          } else {
            showError("Recording failed: No data captured.")
          }
        }
      } catch (error) {
        console.error("Error accessing camera:", error)
        showError("Unable to access camera. Please ensure you have given permission and try again.")
      }
    }
  
    function showSection(section) {
      animateTransition(() => {
        Object.values(elements.sections).forEach((s) => s.classList.add("hidden"))
        elements.sections[section].classList.remove("hidden")
      })
    }
  
    function updateTimer(timerElement, time) {
      const minutes = Math.floor(time / 60)
      const seconds = time % 60
      timerElement.textContent = `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`
    }
  
    function startTimer(phase) {
      let timeLeft = phase === "prep" ? prepTime : recTime
      updateTimer(elements.timerDisplays[phase], timeLeft)
      elements.timers[phase].classList.remove("hidden")
  
      // Add pulse animation to timer
      elements.timers[phase].classList.add("pulse-animation")
  
      return setInterval(() => {
        timeLeft--
        updateTimer(elements.timerDisplays[phase], timeLeft)
        if (timeLeft <= 0) {
          clearInterval(currentTimer)
          elements.timers[phase].classList.remove("pulse-animation")
          elements.timers[phase].classList.add("hidden")
          if (phase === "prep") startRecording()
          else stopRecording()
        }
      }, 1000)
    }
  
    function startPreparationTimer() {
      showSection("interview")
      elements.status.textContent = "Prepare your answer..."
      currentTimer = startTimer("prep")
    }
  
    function startRecording() {
      // Enlarge the video container for a better recording view
      elements.videoContainer.classList.remove("hidden")
      elements.videoContainer.classList.add("enlarged-video")
      // Automatically scroll to the video container so the user can see it
      elements.videoContainer.scrollIntoView({ behavior: "smooth" })
      recordedChunks = []
      mediaRecorder.start(1000) // Record in 1-second chunks
      elements.status.textContent = "Recording in progress..."
      currentTimer = startTimer("rec")
      console.log("Recording started")
  
      // Add recording indicator
      const recordingIndicator = document.createElement("div")
      recordingIndicator.className = "recording-indicator"
      elements.videoContainer.appendChild(recordingIndicator)
    }
  
    function stopRecording() {
      mediaRecorder.stop()
      elements.status.textContent = "Processing your response..."
      showSection("result")
      console.log("Recording stopped")
  
      // Show progress bar for analysis
      elements.progressBar.container.classList.remove("hidden")
      simulateProgress()
    }
  
    function simulateProgress() {
      let progress = 0
      const interval = setInterval(() => {
        progress += 1
        elements.progressBar.progress.style.width = `${progress}%`
        if (progress >= 100) {
          clearInterval(interval)
        }
      }, 300) // Adjust timing to match expected processing time
    }
  
    function uploadVideo(blob) {
      console.log("Uploading video. Blob size:", blob.size, "bytes")
      const formData = new FormData()
      formData.append("video", blob, "interview.mp4")
      // Append the interview question that was displayed
      formData.append("question", elements.question.textContent)
  
      fetch("/upload", {
        method: "POST",
        body: formData,
      })
        .then((response) => {
          if (!response.ok) {
            return response.json().then((err) => {
              throw new Error(err.error || `HTTP error! status: ${response.status}`)
            })
          }
          return response.json()
        })
        .then((data) => {
          console.log("Received data:", data)
          displayResults(data)
        })
        .catch((error) => {
          console.error("Error:", error)
          showError(error.message)
        })
    }
  
    function displayResults(data) {
      let resultHTML = "<h3>Analysis Results:</h3>"
  
      if (data.error) {
        resultHTML += `<p class="error">Error: ${data.error}</p>`
      } else {
        resultHTML += '<div class="score-grid">'
        const metrics = [
          { key: "confidence", label: "Confidence" },
          { key: "clarity", label: "Clarity" },
          { key: "speech_rate", label: "Speech Rate" },
          { key: "eye_contact", label: "Eye Contact" },
          { key: "body_language", label: "Body Language" },
          { key: "voice_tone", label: "Voice Tone" },
          { key: "relevance", label: "Relevance" },
          { key: "pronunciation", label: "Pronunciation" },
          { key: "word_accuracy", label: "Word Accuracy" },
        ]
  
        metrics.forEach((metric) => {
          resultHTML += `
                      <div class="score">
                          <span class="score-label">${metric.label}</span>
                          <span class="score-value">${data[metric.key]}/10</span>
                      </div>
                  `
        })
        resultHTML += "</div>"
  
        if (data.imp_points && data.imp_points.length > 0) {
          resultHTML += "<h4>Key Observations:</h4><ul>"
          data.imp_points.forEach((point) => {
            resultHTML += `<li>${point}</li>`
          })
          resultHTML += "</ul>"
        } else {
          resultHTML += "<p>No key observations found in the analysis.</p>"
        }
  
        if (data.improvement_tips && data.improvement_tips.length > 0) {
          resultHTML += "<h4>Improvement Tips:</h4>"
          resultHTML += '<div class="feedback-box">'
          resultHTML += "<ul>"
          data.improvement_tips.forEach((tip) => {
            resultHTML += `<li>${tip}</li>`
          })
          resultHTML += "</ul>"
          resultHTML += "</div>"
        }
      }

      // Add animation to the result display
      elements.result.innerHTML = resultHTML
      elements.progressBar.container.classList.add("hidden")
  
      // Animate score cards
      const scoreElements = document.querySelectorAll(".score")
      scoreElements.forEach((score, index) => {
        score.style.opacity = "0"
        score.style.transform = "translateY(20px)"
        setTimeout(() => {
          score.style.opacity = "1"
          score.style.transform = "translateY(0)"
        }, 100 * index)
      })
    }
  
    function showError(message) {
      elements.result.innerHTML = `
              <p class="error">Error: ${message}</p>
              <p>Please try again. If the problem persists, ensure you're recording for the full time and that your video and audio are working correctly.</p>
          `
      elements.progressBar.container.classList.add("hidden")
    }
  
    elements.startButton.addEventListener("click", () => {
      elements.startButton.classList.add("btn-clicked")
      setTimeout(() => {
        setupCamera().then(() => {
          fetch("/get_question")
            .then((response) => response.json())
            .then((data) => {
              elements.question.textContent = data.question
              startPreparationTimer()
            })
            .catch((error) => {
              console.error("Error fetching question:", error)
              showError("Failed to fetch interview question. Please try again.")
            })
        })
      }, 300)
    })
  
    // Add hover effects to buttons
    const buttons = document.querySelectorAll(".btn")
    buttons.forEach((button) => {
      button.addEventListener("mouseenter", () => {
        button.style.transform = "translateY(-3px)"
      })
      button.addEventListener("mouseleave", () => {
        button.style.transform = "translateY(0)"
      })
    })
  })
  
  