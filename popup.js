// Popup script for Hush Calendar

document.addEventListener('DOMContentLoaded', async () => {
    const volumeToggle = document.getElementById('volumeToggle');
    const volumeSlider = document.getElementById('volumeSlider');
    const volumeValue = document.getElementById('volumeValue');
    const volumeControl = document.getElementById('volumeControl');
    const calendarTabCount = document.getElementById('calendarTabCount');
    const activeTabInfo = document.getElementById('activeTabInfo');
    const faviconToggle = document.getElementById('faviconToggle');

    // Load saved settings
    chrome.storage.sync.get(['volumeEnabled', 'volumeLevel', 'faviconEnabled'], (result) => {
        volumeToggle.checked = result.volumeEnabled || false;
        const level = result.volumeLevel || 50;
        volumeSlider.value = level;
        volumeValue.textContent = level;
        volumeControl.style.display = volumeToggle.checked ? 'block' : 'none';
        faviconToggle.checked = result.faviconEnabled !== false; // Default true
    });

    // Cache for tab status
    let updateInterval = null;

    // Update tab status
    async function updateTabStatus() {
        try {
            const tabs = await chrome.tabs.query({});
            const calendarTabs = tabs.filter(tab =>
                tab.url && tab.url.includes('calendar.google.com')
            );

            if (calendarTabs.length === 0) {
                calendarTabCount.textContent = 'No Google Calendar tabs open';
                activeTabInfo.textContent = '';
            } else if (calendarTabs.length === 1) {
                calendarTabCount.textContent = '1 Calendar tab open (unmuted)';
                activeTabInfo.textContent = '';
            } else {
                const mutedCount = calendarTabs.filter(t => t.mutedInfo && t.mutedInfo.muted).length;
                const unmutedCount = calendarTabs.length - mutedCount;
                calendarTabCount.textContent = `${calendarTabs.length} Calendar tabs open`;
                activeTabInfo.textContent = `${unmutedCount} active, ${mutedCount} muted`;
            }
        } catch (error) {
            console.error('Error updating tab status:', error);
        }
    }

    // Initial status update
    updateTabStatus();

    // Volume toggle change
    volumeToggle.addEventListener('change', () => {
        const enabled = volumeToggle.checked;
        volumeControl.style.display = enabled ? 'block' : 'none';

        chrome.storage.sync.set({
            volumeEnabled: enabled,
            volumeLevel: parseInt(volumeSlider.value)
        });
    });

    // Volume slider change
    volumeSlider.addEventListener('input', () => {
        const level = parseInt(volumeSlider.value);
        volumeValue.textContent = level;
    });

    volumeSlider.addEventListener('change', () => {
        const level = parseInt(volumeSlider.value);
        chrome.storage.sync.set({
            volumeLevel: level,
            volumeEnabled: volumeToggle.checked,
            faviconEnabled: faviconToggle.checked
        });
    });

    // Favicon toggle change
    faviconToggle.addEventListener('change', () => {
        chrome.storage.sync.set({
            faviconEnabled: faviconToggle.checked,
            volumeEnabled: volumeToggle.checked,
            volumeLevel: parseInt(volumeSlider.value)
        });
    });

    // Update status every 3 seconds while popup is open (reduced frequency)
    updateInterval = setInterval(updateTabStatus, 3000);

    // Clean up interval when popup closes
    window.addEventListener('beforeunload', () => {
        if (updateInterval) {
            clearInterval(updateInterval);
        }
    });
});

