document.addEventListener('DOMContentLoaded', function() {
    const openRecorderButton = document.getElementById('open-recorder');
    const statusDiv = document.getElementById('status');

    // Check if recording window is already open
    chrome.runtime.sendMessage({command: 'checkRecorderWindow'}, function(response) {
        if (response && response.windowOpen) {
            statusDiv.textContent = 'Recorder window is already open';
            openRecorderButton.textContent = 'Focus Recorder Window';
        }
    });

    openRecorderButton.addEventListener('click', function() {
        chrome.runtime.sendMessage({command: 'openRecorderWindow'}, function(response) {
            if (response && response.success) {
                window.close(); // Close the popup
            }
        });
    });
});