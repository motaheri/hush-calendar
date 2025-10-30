// Content script for Google Calendar pages
// This script controls the volume of audio elements and shows mute status

(function () {
    'use strict';

    let volumeLevel = 0.5; // Default 50%
    let volumeEnabled = false;
    let originalFavicon = null;
    let isMuted = false;

    // Check if extension context is still valid
    function isExtensionContextValid() {
        try {
            return chrome.runtime && chrome.runtime.id;
        } catch (e) {
            return false;
        }
    }

    // Load settings from storage
    if (isExtensionContextValid()) {
        chrome.storage.sync.get(['volumeEnabled', 'volumeLevel'], (result) => {
            if (chrome.runtime.lastError || !isExtensionContextValid()) return;
            volumeEnabled = result.volumeEnabled || false;
            volumeLevel = (result.volumeLevel || 50) / 100;
            applyVolumeToAllAudio();
        });

        // Listen for settings changes
        chrome.storage.onChanged.addListener((changes, namespace) => {
            if (!isExtensionContextValid()) return;
            if (namespace === 'sync') {
                if (changes.volumeEnabled) {
                    volumeEnabled = changes.volumeEnabled.newValue;
                }
                if (changes.volumeLevel) {
                    volumeLevel = changes.volumeLevel.newValue / 100;
                }
                applyVolumeToAllAudio();
            }
        });
    }

    // Apply volume to all existing audio elements
    function applyVolumeToAllAudio() {
        const audioElements = document.querySelectorAll('audio, video');
        audioElements.forEach(element => {
            if (volumeEnabled) {
                element.volume = volumeLevel;
            } else {
                element.volume = 1.0; // Reset to full volume
            }
        });
    }

    // Override Audio constructor to set volume immediately
    const OriginalAudio = window.Audio;
    window.Audio = function (...args) {
        const audio = new OriginalAudio(...args);
        if (volumeEnabled) {
            audio.volume = volumeLevel;
        }

        // Watch for volume changes and override them
        const originalVolumeSetter = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, 'volume').set;
        Object.defineProperty(audio, 'volume', {
            get: function () {
                return this._customVolume !== undefined ? this._customVolume : 1.0;
            },
            set: function (value) {
                if (volumeEnabled) {
                    this._customVolume = volumeLevel;
                    originalVolumeSetter.call(this, volumeLevel);
                } else {
                    this._customVolume = value;
                    originalVolumeSetter.call(this, value);
                }
            }
        });

        return audio;
    };

    // Observer to watch for dynamically added audio elements
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            mutation.addedNodes.forEach((node) => {
                if (node.nodeName === 'AUDIO' || node.nodeName === 'VIDEO') {
                    if (volumeEnabled) {
                        node.volume = volumeLevel;
                    }
                }
            });
        });
    });

    // Start observing when DOM is ready
    if (document.body) {
        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
        applyVolumeToAllAudio();
    } else {
        document.addEventListener('DOMContentLoaded', () => {
            observer.observe(document.body, {
                childList: true,
                subtree: true
            });
            applyVolumeToAllAudio();
        });
    }

    // Override HTMLMediaElement volume property globally
    const originalVolumeDescriptor = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, 'volume');
    Object.defineProperty(HTMLMediaElement.prototype, 'volume', {
        get: function () {
            return originalVolumeDescriptor.get.call(this);
        },
        set: function (value) {
            if (volumeEnabled) {
                originalVolumeDescriptor.set.call(this, volumeLevel);
            } else {
                originalVolumeDescriptor.set.call(this, value);
            }
        }
    });

    // Periodic check to ensure volume is maintained
    setInterval(applyVolumeToAllAudio, 1000);

    // Apply mute indicator based on current state
    function applyMuteIndicator(shouldBeMuted) {
        if (!isExtensionContextValid()) {
            console.debug('Hush Calendar: Extension context invalidated, stopping');
            return;
        }

        if (shouldBeMuted !== isMuted) {
            isMuted = shouldBeMuted;

            chrome.storage.sync.get(['faviconEnabled'], (result) => {
                if (result.faviconEnabled !== false) { // Default true
                    if (isMuted) {
                        // Change favicon to muted version (red icon)
                        setMutedFavicon();
                    } else {
                        // Restore original favicon (Google Calendar icon)
                        restoreOriginalFavicon();
                    }
                } else if (!isMuted) {
                    restoreOriginalFavicon(); // Always restore if disabled and unmuted
                }
            });
        }
    }

    // Cache the muted favicon data URL to avoid recreating it
    let cachedMutedFaviconUrl = null;

    // Create a muted favicon (cached for performance)
    function setMutedFavicon() {
        // Save original favicon if not already saved
        if (!originalFavicon) {
            const existingFavicon = document.querySelector('link[rel*="icon"]');
            if (existingFavicon) {
                originalFavicon = existingFavicon.href;
            }
        }

        // Use cached version if available
        if (cachedMutedFaviconUrl) {
            updateFavicon(cachedMutedFaviconUrl);
            return;
        }

        // Create canvas to draw muted icon (only once)
        const canvas = document.createElement('canvas');
        canvas.width = 32;
        canvas.height = 32;
        const ctx = canvas.getContext('2d');

        // Red background circle
        ctx.fillStyle = '#dc3545';
        ctx.beginPath();
        ctx.arc(16, 16, 15, 0, Math.PI * 2);
        ctx.fill();

        // White mute symbol (speaker with X)
        ctx.fillStyle = 'white';
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 2;

        // Speaker
        ctx.beginPath();
        ctx.moveTo(10, 12);
        ctx.lineTo(7, 12);
        ctx.lineTo(7, 20);
        ctx.lineTo(10, 20);
        ctx.fill();

        ctx.beginPath();
        ctx.moveTo(10, 12);
        ctx.lineTo(13, 9);
        ctx.lineTo(13, 23);
        ctx.lineTo(10, 20);
        ctx.fill();

        // X mark
        ctx.lineWidth = 2.5;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(18, 12);
        ctx.lineTo(24, 20);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(24, 12);
        ctx.lineTo(18, 20);
        ctx.stroke();

        // Cache and update favicon
        cachedMutedFaviconUrl = canvas.toDataURL();
        updateFavicon(cachedMutedFaviconUrl);
    }

    // Restore original favicon
    function restoreOriginalFavicon() {
        if (originalFavicon) {
            updateFavicon(originalFavicon);
        }
    }

    // Helper to update favicon
    function updateFavicon(href) {
        // Remove existing favicons
        const existingFavicons = document.querySelectorAll('link[rel*="icon"]');
        existingFavicons.forEach(favicon => favicon.remove());

        // Add new favicon
        const link = document.createElement('link');
        link.rel = 'icon';
        link.href = href;
        document.head.appendChild(link);

        // Also add shortcut icon for better compatibility
        const shortcutLink = document.createElement('link');
        shortcutLink.rel = 'shortcut icon';
        shortcutLink.href = href;
        document.head.appendChild(shortcutLink);
    }

    // Listen for immediate mute status changes from background script
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (!isExtensionContextValid()) {
            return false;
        }

        if (message.action === 'muteStatusChanged') {
            applyMuteIndicator(message.isMuted);
            sendResponse({ received: true });
        }
        return false;
    });

    // Request initial mute status once (with retry logic)
    function requestInitialMuteStatus() {
        if (!isExtensionContextValid()) {
            console.debug('Hush Calendar: Extension context invalidated, skipping initial request');
            return;
        }

        try {
            chrome.runtime.sendMessage({ action: 'isThisTabMuted' }, (response) => {
                if (chrome.runtime.lastError) {
                    // Background script might not be ready yet or context invalidated
                    console.debug('Hush Calendar: Background script not ready yet');
                    return;
                }
                if (response && isExtensionContextValid()) {
                    applyMuteIndicator(response.isMuted);
                }
            });
        } catch (error) {
            // Extension context might be invalidated, silently fail
            console.debug('Hush Calendar: Could not send initial message');
        }
    }

    // Try to get initial status after a short delay to ensure background script is ready
    setTimeout(requestInitialMuteStatus, 1000);

    // No need to monitor title changes anymore since we're only changing favicons
})();

