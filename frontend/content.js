// Helper function to extract video ID from the URL
function getVideoIdFromUrl(url) {
    const urlObj = new URL(url);
    return urlObj.searchParams.get('v');
}

// Simple helper to show messages (using alert for MVP)
function showMessage(msg) {
    alert(msg);
}

function displayTranscript(text) {
    // Check for user theme preference
    const isDarkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;

    // Create a modal dialog for better visibility
    const modal = document.createElement('div');
    modal.style.position = 'fixed';
    modal.style.left = '50%';
    modal.style.top = '50%';
    modal.style.transform = 'translate(-50%, -50%)';
    modal.style.backgroundColor = isDarkMode ? 'black' : 'white';
    modal.style.color = isDarkMode ? 'white' : 'black';
    modal.style.padding = '20px';
    modal.style.borderRadius = '8px';
    modal.style.border = isDarkMode ? '1px solid white' : '1px solid black';
    modal.style.boxShadow = isDarkMode
        ? '0 4px 6px rgba(255, 255, 255, 0.1)'
        : '0 4px 6px rgba(0, 0, 0, 0.1)';
    modal.style.maxWidth = '80%';
    modal.style.maxHeight = '80vh';
    modal.style.overflow = 'auto';
    modal.style.zIndex = '10000';

    // Add close button
    const closeButton = document.createElement('button');
    closeButton.textContent = 'X';
    closeButton.style.cursor = 'pointer';
    closeButton.style.backgroundColor = isDarkMode ? '#151515' : '#f0f0f0';
    closeButton.style.color = isDarkMode ? 'white' : 'black';
    closeButton.style.border = isDarkMode ? '1px solid white' : '1px solid black';
    closeButton.style.borderRadius = '4px';
    closeButton.style.position = 'relative';
    closeButton.style.height = '25px';
    closeButton.style.width = '25px';
    closeButton.style.marginRight = '10px';
    closeButton.style.marginTop = '15px';
    closeButton.onclick = () => {
        overlay.remove();
        modal.remove();
    };

    //Add title
    const TitleContent = document.createElement('p');
    TitleContent.style.margin = '0';
    TitleContent.style.fontSize = '2.5rem';
    TitleContent.style.padding = '10px';
    TitleContent.textContent = "Özet";

    // Add buttons in a button container to keep them aligned
    const buttonContainer = document.createElement('div');
    buttonContainer.style.display = 'flex';
    buttonContainer.style.justifyContent = 'space-between';
    buttonContainer.appendChild(TitleContent);
    buttonContainer.appendChild(closeButton);
    
    modal.appendChild(buttonContainer);

    // Add transcript text
    const textContent = document.createElement('p');
    textContent.style.margin = '0';
    textContent.style.fontSize = '1.5rem';
    textContent.style.textAlign = 'justify';
    textContent.style.padding = '10px';
    textContent.textContent = text;

    // Add overlay
    const overlay = document.createElement('div');
    overlay.style.position = 'fixed';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.width = '100%';
    overlay.style.height = '100%';
    overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
    overlay.style.zIndex = '9999';
    overlay.onclick = () => {
        overlay.remove();
        modal.remove();
    };

    modal.appendChild(textContent);

    document.body.appendChild(overlay);
    document.body.appendChild(modal);
}

// Zamanı güzel formatlama fonksiyonu
function formatTime(seconds) {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}

// Show Loading Spinner
function showLoadingSpinner() {
    // Check if spinner already exists
    if (document.getElementById('loading-spinner-overlay')) return;

    const overlay = document.createElement('div');
    overlay.id = 'loading-spinner-overlay';

    const spinner = document.createElement('div');
    spinner.id = 'loading-spinner';

    overlay.appendChild(spinner);
    document.body.appendChild(overlay);

    // Display the spinner
    overlay.style.display = 'flex';
}

// Hide Loading Spinner
function hideLoadingSpinner() {
    const overlay = document.getElementById('loading-spinner-overlay');
    if (overlay) {
        overlay.remove();
    }
}

// Handle Summarize Button Click
async function handleSummarizeButtonClick() {
    const videoId = getVideoIdFromUrl(window.location.href);
    if (!videoId) {
        showMessage("No video ID found. Cannot get transcript.");
        return;
    }

    const storage = typeof browser !== 'undefined' ? browser.storage.sync : chrome.storage.sync;
    // Retrieve the user's preferred language
    const preferredLanguage = await new Promise((resolve) => {
        storage.get(['preferredLanguage'], (result) => {
            if(result !== 'undefined'){
                console.log("Undo");
                resolve('tr')
            }
            else{
                resolve(result.preferredLanguage);
            }
        });
    });

    try {
        showLoadingSpinner();

        const response = await fetch(`http://localhost:8000/transcript?video_id=${videoId}&summary_language=${preferredLanguage}`, {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            },
            mode: 'cors'
        });

        if (!response.ok) {
            const errorText = await response.text();
            if (response.status === 404) {
                showMessage("No captions or transcript found for this video.");
            } else if (response.status === 500) {
                showMessage("Error fetching transcript from the server.");
            } else {
                showMessage("An unexpected error occurred: " + errorText);
            }
            return;
        }

        const data = await response.json();
        if (data && data.summary) {
            displayTranscript(data.summary);
        } else {
            showMessage("No summary returned from the server.");
        }        
    } catch (error) {
        console.error("Error fetching transcript:", error);
        showMessage("Failed to connect to the transcript service.");
    } finally {
        hideLoadingSpinner();
    }
}


function addSummarizeButtonIfNeeded() {
    // Try the selector related to the Subscribe button
    const subscribeBtnDiv = document.querySelector("#subscribe-button > ytd-button-renderer > yt-button-shape > a > yt-touch-feedback-shape > div");

    if (subscribeBtnDiv && !document.querySelector('#mySummarizeButton')) {
        const summarizeBtn = document.createElement('button');
        summarizeBtn.id = 'mySummarizeButton';
        summarizeBtn.textContent = 'Ai ile Özetle';

        summarizeBtn.style.display = 'inline-flex';
        summarizeBtn.style.alignItems = 'center';
        summarizeBtn.style.justifyContent = 'center';
        summarizeBtn.style.padding = '9px 18px';
        summarizeBtn.style.marginLeft = '12px';
        summarizeBtn.style.backgroundColor = 'rgb(39, 39, 39)';
        summarizeBtn.style.color = '#ffffff';
        summarizeBtn.style.border = 'none';
        summarizeBtn.style.borderRadius = '20px';
        summarizeBtn.style.cursor = 'pointer';
        summarizeBtn.style.fontWeight = '600';
        summarizeBtn.style.fontSize = '14px';
        summarizeBtn.style.boxShadow = '0 2px 4px rgba(0,0,0,0.2)';

        summarizeBtn.addEventListener('mouseenter', () => {
            summarizeBtn.style.backgroundColor = 'rgb(63, 63, 63)';
        });
        summarizeBtn.addEventListener('mouseleave', () => {
            summarizeBtn.style.backgroundColor = 'rgb(39, 39, 39)';
        });

        subscribeBtnDiv.insertAdjacentElement('afterend', summarizeBtn);

        summarizeBtn.addEventListener('click', async () => {
            console.log('Summarize button clicked!');
            await handleSummarizeButtonClick();
        });
    } else if (!subscribeBtnDiv && !document.querySelector('#mySummarizeButton')) {
        // Fallback in case subscribe button is not found
        const actionButtonsContainer = document.querySelector('#top-level-buttons-computed');
        if (actionButtonsContainer && !document.querySelector('#mySummarizeButton')) {
            const summarizeBtn = document.createElement('button');
            summarizeBtn.id = 'mySummarizeButton';
            summarizeBtn.textContent = 'Ai ile Özetle';

            summarizeBtn.style.display = 'inline-flex';
            summarizeBtn.style.alignItems = 'center';
            summarizeBtn.style.justifyContent = 'center';
            summarizeBtn.style.padding = '9px 18px';
            summarizeBtn.style.marginLeft = '12px';
            summarizeBtn.style.backgroundColor = 'rgb(39, 39, 39)';
            summarizeBtn.style.color = '#ffffff';
            summarizeBtn.style.border = 'none';
            summarizeBtn.style.borderRadius = '20px';
            summarizeBtn.style.cursor = 'pointer';
            summarizeBtn.style.fontWeight = '600';
            summarizeBtn.style.fontSize = '14px';
            summarizeBtn.style.boxShadow = '0 2px 4px rgba(0,0,0,0.2)';

            summarizeBtn.addEventListener('mouseenter', () => {
                summarizeBtn.style.backgroundColor = 'rgb(63, 63, 63)';
            });
            summarizeBtn.addEventListener('mouseleave', () => {
                summarizeBtn.style.backgroundColor = 'rgb(39, 39, 39)';
            });

            actionButtonsContainer.appendChild(summarizeBtn);

            summarizeBtn.addEventListener('click', async () => {
                console.log('Summarize button clicked!');
                await handleSummarizeButtonClick();
            });
        }
    }
}

// Observe changes in the DOM and try adding the button
const observer = new MutationObserver(() => {
    addSummarizeButtonIfNeeded();
});
observer.observe(document.body, { childList: true, subtree: true });

// Run once on load
addSummarizeButtonIfNeeded();