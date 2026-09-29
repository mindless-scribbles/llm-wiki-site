# Registered wikis

One folder per wiki: `sites/<wiki-id>/`.

- `site.json` — where the wiki lives and where its site is built:

  ```json
  {
    "source": "wikis/trading-wiki",
    "out": "~/sites/trading-wiki",
    "title": "Trading Field Logs",
    "brandLetters": "TF",
    "footer": "SYS.TRADING_WIKI / 2026",
    "accent": "#ff3300"
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

`source` is relative to the machine's vault root (`llm-wiki-site vault <path>`,
stored in the git-ignored `local.json`, or `LLM_WIKI_VAULT`), and `out` sits under
`~`, so these files work on every machine that sets its vault root. `register`
writes them that way automatically once the vault root is set.
