# Discord Widget Setup

## Installation

Run this command in the overlay folder:
```bash
npm install
```

This will install `discord.js` which is required for the Discord widget.

## Configuration

1. Get your Discord user token:
   - Open Discord in your browser
   - Open DevTools (F12) → Application → Cookies → discord.com
   - Find and copy the `__Secure-next-auth.session-token` value

2. In the overlay app Settings tab, paste your token in the Discord Token field

3. The widget will connect automatically

## Usage

- **View Chats**: Select from DMs or guild channels in the dropdown
- **Send Messages**: Type in the message box and press Enter
- **Refresh**: Messages auto-refresh; you can manually refresh with the refresh button

## Notes

- User tokens are less secure than bot tokens (Discord ToS), but simpler for personal use
- The token is stored locally in `config.json`
- Messages will show who sent them with a timestamp
