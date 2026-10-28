# Viva Beta V1 — consolidated release

## This pass
- Complete redesigned 7-day rewards display, real daily/hourly readiness and bonuses.
- Case result keep-all/sell-new-items/roll-again actions; individual server sell validations retained.
- Fishing location info, rounded fish odds, expanded visual polishing and pass shortcut.
- Corrected cooldown message (one attempt per minute).
- Preserved Telegram admin DB backup, pass/shop, invitations and prior admin controls.

## Not verified or incomplete
- Live Telegram payment workflow and UI end-to-end interactions require deploying this build.
- Per-location rarity leader records, bespoke human/rod procedural animation and full moderator redesign are not implemented here.
- Selling a batch of new identical items processes them sequentially (not as an atomic transaction).
- Database restoration still requires offline application of staged backup.
