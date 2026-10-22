## Download

| Your system | File |
|---|---|
| Mac with Apple Silicon (M1 or newer) | `lookout-*-mac-arm64.dmg` |
| Mac with an Intel processor | `lookout-*-mac-x64.dmg` |
| Windows 10 / 11 | `lookout-*-win-x64.exe` |

Not sure which Mac you have? Apple menu, then *About This Mac*: "Chip: Apple M…" means Apple Silicon.
`SHA256SUMS.txt` lets you check that a download is intact.

## First launch (these builds are not code-signed yet)

- **macOS**: open the `.dmg`, drag the app to *Applications*. If macOS says the app is damaged or from an unidentified
  developer, run `xattr -cr /Applications/lookout.app` in a terminal, or right-click the app and choose *Open*.
- **Windows**: if SmartScreen blocks the installer, click *More info*, then *Run anyway*.

---
