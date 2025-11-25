// Background service worker for Hush Calendar

// Track the single active (unmuted) Google Calendar tab globally
// There should never be more than one unmuted Calendar tab at a time
let activeCalendarTabId = null;

// Main function to manage calendar tabs
async function manageCalendarTabs() {
    try {
        const tabs = await chrome.tabs.query({});
        const calendarTabs = tabs.filter(tab =>
            tab.url && tab.url.includes('calendar.google.com')
        );

        if (calendarTabs.length === 0) {
            // activeCalendarTabId = null; // This line is removed as per the new_code
            return;
        }

        // Find or set the single global active Calendar tab
        let globalActiveId =
            activeCalendarTabId &&
                calendarTabs.find(t => t.id === activeCalendarTabId)
                ? activeCalendarTabId
                : null;

        if (!globalActiveId) {
            const activeTab = calendarTabs.find(t => t.active);
            globalActiveId = activeTab ? activeTab.id : calendarTabs[0].id;
            activeCalendarTabId = globalActiveId;
        }

        // Mute all Calendar tabs except the single active one
        for (const tab of calendarTabs) {
            const shouldMute = tab.id !== globalActiveId;
            const currentlyMuted = tab.mutedInfo ? tab.mutedInfo.muted : false;

            if (currentlyMuted !== shouldMute) {
                await chrome.tabs.update(tab.id, { muted: shouldMute });
                console.log(
                    `Hush Calendar: Tab ${tab.id} ${shouldMute ? 'muted' : 'unmuted'} (global active: ${globalActiveId})`
                );

                try {
                    await chrome.tabs.sendMessage(tab.id, {
                        action: 'muteStatusChanged',
                        isMuted: shouldMute
                    }).catch(() => { });
                } catch (e) { }
            }
        }

        console.log(`Hush Calendar: Managing ${calendarTabs.length} calendar tabs with 1 active globally`);
    } catch (error) {
        console.error('Error managing calendar tabs:', error);
    }
}

// Set a specific tab as the active calendar tab
async function setActiveCalendarTab(tabId) {
    chrome.tabs.get(tabId, (tab) => {
        if (tab) {
            activeCalendarTabId = tabId;
        }
    });
    await manageCalendarTabs();
}

// Debounce function to prevent rapid repeated calls
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Debounced version of manageCalendarTabs (300ms delay)
const debouncedManageTabs = debounce(manageCalendarTabs, 300);

// Listen for tab updates
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.url || changeInfo.status === 'complete') {
        // Only process calendar tabs
        if (tab.url && tab.url.includes('calendar.google.com')) {
            debouncedManageTabs();
        }
    }
});

// Listen for tab activation
chrome.tabs.onActivated.addListener((activeInfo) => {
    chrome.tabs.get(activeInfo.tabId, (tab) => {
        if (chrome.runtime.lastError) return;
        if (tab.url && tab.url.includes('calendar.google.com')) {
            // User switched to a calendar tab, make it the active one immediately
            setActiveCalendarTab(activeInfo.tabId);
        }
    });
});

// Listen for tab removal
chrome.tabs.onRemoved.addListener((tabId) => {
    if (activeCalendarTabId === tabId) {
        activeCalendarTabId = null;
        manageCalendarTabs();
    }
});

// Listen for tab creation (only manage if it might be a calendar tab)
chrome.tabs.onCreated.addListener((tab) => {
    // Wait a bit for the tab to load before checking
    setTimeout(() => {
        if (tab.url && tab.url.includes('calendar.google.com')) {
            debouncedManageTabs();
        }
    }, 500);
});

// Listen for messages from popup or content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    try {
        if (message.action === 'getActiveTab') {
            sendResponse({ activeTabId: activeCalendarTabId });
            return false;
        } else if (message.action === 'setActiveTab') {
            setActiveCalendarTab(message.tabId).then(() => {
                sendResponse({ success: true });
            }).catch((error) => {
                console.error('Error setting active tab:', error);
                sendResponse({ success: false, error: error.message });
            });
            return true; // Will respond asynchronously
        } else if (message.action === 'isThisTabMuted') {
            // Check if the sender's tab is muted
            if (sender.tab && sender.tab.id) {
                chrome.tabs.get(sender.tab.id, (tab) => {
                    if (chrome.runtime.lastError) {
                        sendResponse({ isMuted: false });
                        return;
                    }
                    const isMuted = tab.mutedInfo && tab.mutedInfo.muted;
                    sendResponse({ isMuted: isMuted });
                });
                return true; // Will respond asynchronously
            } else {
                sendResponse({ isMuted: false });
                return false;
            }
        }
    } catch (error) {
        console.error('Error handling message:', error);
        sendResponse({ error: error.message });
        return false;
    }
});

// Initialize on startup
chrome.runtime.onStartup.addListener(() => {
    manageCalendarTabs();
});

// Initialize on install
chrome.runtime.onInstalled.addListener(() => {
    // Set default settings
    chrome.storage.sync.set({
        volumeEnabled: false,
        volumeLevel: 50
    });
    manageCalendarTabs();
});

// Periodic check (every 10 seconds) to ensure tabs stay managed
// Reduced frequency since we have event listeners for most changes
setInterval(manageCalendarTabs, 10000);
