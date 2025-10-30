// Background service worker for Hush Calendar

// Track the active (unmuted) Google Calendar tab per window
let activeCalendarTabIds = {}; // {windowId: tabId}

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

        // Group tabs by window
        const tabsByWindow = {};
        calendarTabs.forEach(tab => {
            if (!tabsByWindow[tab.windowId]) tabsByWindow[tab.windowId] = [];
            tabsByWindow[tab.windowId].push(tab);
        });

        for (const windowId in tabsByWindow) {
            const windowTabs = tabsByWindow[windowId];

            // Find or set active tab for this window
            let windowActiveId = activeCalendarTabIds[windowId] && windowTabs.find(t => t.id === activeCalendarTabIds[windowId]) ? activeCalendarTabIds[windowId] : null;

            if (!windowActiveId) {
                const activeTab = windowTabs.find(t => t.active);
                windowActiveId = activeTab ? activeTab.id : windowTabs[0].id;
                activeCalendarTabIds[windowId] = windowActiveId;
            }

            // Mute all except active in this window
            for (const tab of windowTabs) {
                const shouldMute = tab.id !== windowActiveId;
                const currentlyMuted = tab.mutedInfo ? tab.mutedInfo.muted : false;

                if (currentlyMuted !== shouldMute) {
                    await chrome.tabs.update(tab.id, { muted: shouldMute });
                    console.log(`Hush Calendar: Tab ${tab.id} in window ${windowId} ${shouldMute ? 'muted' : 'unmuted'}`);

                    try {
                        await chrome.tabs.sendMessage(tab.id, {
                            action: 'muteStatusChanged',
                            isMuted: shouldMute
                        }).catch(() => { });
                    } catch (e) { }
                }
            }
        }

        console.log(`Hush Calendar: Managing ${calendarTabs.length} calendar tabs across ${Object.keys(tabsByWindow).length} windows`);
    } catch (error) {
        console.error('Error managing calendar tabs:', error);
    }
}

// Set a specific tab as the active calendar tab
async function setActiveCalendarTab(tabId) {
    chrome.tabs.get(tabId, (tab) => {
        if (tab && tab.windowId) {
            activeCalendarTabIds[tab.windowId] = tabId;
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
    for (const windowId in activeCalendarTabIds) {
        if (activeCalendarTabIds[windowId] === tabId) {
            activeCalendarTabIds[windowId] = null;
            manageCalendarTabs();
            break;
        }
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
            sendResponse({ activeTabId: activeCalendarTabIds[sender.tab.windowId] });
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
