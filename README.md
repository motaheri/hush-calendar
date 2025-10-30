# 🔇 Hush Calendar

A Chrome extension that prevents multiple notification chimes from Google Calendar by muting all but one calendar tab, with optional volume control.

## Features

- **Smart Tab Muting**: Automatically mutes all Google Calendar tabs except one, preventing annoying multiple notification chimes
- **Visual Indicators**: Muted tabs show a red mute icon as the favicon, making it instantly obvious which tabs are silenced
- **Volume Control**: Optional setting to reduce notification volume to a custom level (default 50%)
- **Auto-Management**: Automatically manages tabs as you open, close, or switch between them
- **Live Status**: Extension popup shows how many Calendar tabs are open and their mute status in real-time

## Installation

1. Open `generate-icons.html` in your browser and download the 3 icon files to the `icons/` folder
2. Go to `chrome://extensions/` and enable "Developer mode"
3. Click "Load unpacked" and select this folder
4. Done! Open multiple Calendar tabs to see it in action

### Keyboard Shortcut

- **Windows/Linux**: `Ctrl+Shift+M`  
- **Mac**: `⌘+Shift+M`

Press the shortcut to quickly open the extension popup from anywhere.

## Usage

1. **Install the extension** following the steps above
2. **Open multiple Google Calendar tabs** (e.g., in different windows or tabs)
3. **The extension automatically**:
   - Keeps one tab unmuted (the active one)
   - Mutes all other Calendar tabs
   - Updates when you switch tabs or open new ones

4. **Configure volume**:
   - Click the extension icon in Chrome toolbar
   - Toggle "Reduce notification volume"
   - Adjust the slider to your preferred level
   - Changes apply immediately to all Calendar tabs

## How It Works

### Tab Muting
- The background service worker monitors all open tabs
- When it detects multiple Google Calendar tabs, it keeps one unmuted
- The active or most recently used Calendar tab stays unmuted
- All other Calendar tabs are automatically muted
- Switches the unmuted tab when you activate a different Calendar tab

### Visual Indicators
- **Muted tabs** display:
  - Red circular favicon with a white speaker + X icon
- **Unmuted tab** shows:
  - Original Google Calendar favicon (unchanged)
- Indicators update instantly when mute status changes

### Volume Control
- A content script runs on all Google Calendar pages
- When volume control is enabled, it intercepts and reduces the volume of all audio elements
- Works by overriding the HTML5 Audio API to enforce the volume limit
- Persists across page reloads and new Calendar tabs

## Permissions

- **tabs**: Required to detect and manage Google Calendar tabs
- **storage**: Saves your volume preferences
- **host_permissions**: Access to `calendar.google.com` to inject volume control script

## Troubleshooting

### Icons not showing
Create icon images or temporarily remove icon references from `manifest.json`.

### Extension not working
1. Check that you have multiple Calendar tabs open
2. Refresh the extension on `chrome://extensions/`
3. Check the extension popup to see tab status
4. Look for errors in the extension's service worker console

### Volume control not working
1. Make sure the toggle is enabled in the popup
2. Reload the Calendar tab after changing settings
3. Check that you're on `calendar.google.com` (not other calendar sites)

### "Extension context invalidated" error during development
This is normal when reloading the extension while Calendar tabs are open:
1. **Best solution**: Close Calendar tabs → Reload extension → Reopen Calendar
2. **Quick fix**: Just reload the Calendar tabs after reloading the extension
3. The extension now handles this gracefully and will work once tabs are refreshed

## Privacy & Security

This extension:
- ✅ Only runs on Google Calendar pages
- ✅ Stores settings locally in your browser (synced if you're signed into Chrome)
- ✅ Does not collect, transmit, or share any data
- ✅ Does not require Google account access
- ✅ Does not use external servers or analytics
- ✅ All code is open source and reviewable
- ✅ No network requests made (except loading Calendar itself)

## License

MIT License - Feel free to modify and distribute