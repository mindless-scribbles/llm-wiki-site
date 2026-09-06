# Registered wikis

One folder per wiki: `sites/<wiki-id>/`.

- `site.json` — where the wiki lives and where its site is built:

  ```json
  {
    "source": "/home/you/Obsidian/Vault/trading-wiki",
    "out": "/home/you/sites/trading-wiki",
    "title": "Trading Field Logs",
    "brandLetters": "TF",
    "footer": "SYS.TRADING_WIKI / 2026",
    "accent": "#33ccff"
  }
  ```

  Only `source` is required. Branding keys here override whatever the wiki itself
  declares — leave them out unless you need to override.

- `widgets/*.js` — optional per-concept visualizations for this wiki. They live
  here rather than in the wiki because a wiki inside an Obsidian vault should
  hold nothing but markdown. See `../widgets/README.md`.

Register a wiki with:

```bash
llm-wiki-site register trading-wiki ~/Obsidian/Vault/trading-wiki --out ~/sites/trading-wiki
```

`site.json` records absolute paths, so these files are machine-specific. If you
share this repo across machines, expect to re-run `register` on each.
