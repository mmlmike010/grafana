# Grafana Desktop build resources

Platform icons and installer art for the Grafana Desktop (Electron) shell. Every asset is derived from the
in-repo Grafana mark at [`public/img/grafana_icon.svg`](../../public/img/grafana_icon.svg). The mark is
embedded verbatim (never redrawn, recolored, or reshaped); each generated SVG records the mark's sha256.

File names follow electron-builder's defaults, so `directories.buildResources: desktop/resources` picks
everything up with no extra `mac`/`win`/`linux`/`dmg`/`nsis` config.

## Files

| File                       | Used by                                             | Notes                                                                                        |
| -------------------------- | --------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `icon.svg`                 | Source                                              | 1024×1024 macOS app icon: mark on a rounded tile using Apple's 824/1024 grid.                |
| `icon.icns`                | macOS app, dmg (`mac.icon`)                         | 16, 32, 64, 128, 256, 512, 1024 px: every 16–512 slot at @1x and @2x.                        |
| `icon.ico`                 | Windows app, NSIS (`win.icon`)                      | 16, 24, 32, 48, 64, 128, 256 px.                                                             |
| `icons/<size>x<size>.png`  | Linux (`linux.icon`)                                | 16, 32, 48, 64, 128, 256, 512 px. electron-builder installs these into the hicolor theme.    |
| `background.png`           | dmg window (`dmg.background`)                       | 540×380 @1x, 72 DPI. Drag-to-Applications cue for electron-builder's default icon positions. |
| `background@2x.png`        | dmg window, Retina                                  | 1080×760, 144 DPI. electron-builder pairs it with `background.png` automatically.            |
| `installerHeader.bmp`      | NSIS assisted installer (`nsis.installerHeader`)    | 150×57, 24-bit BMP. Only shown when `nsis.oneClick: false`.                                  |
| `installerSidebar.bmp`     | NSIS welcome/finish pages (`nsis.installerSidebar`) | 164×314, 24-bit BMP. Also the default `uninstallerSidebar`.                                  |
| `src/icon-small.svg`       | Source                                              | macOS 16 and 32 px slots (16@1x, 16@2x, 32@1x): same tile, larger mark, so it stays legible. |
| `src/icon-flat.svg`        | Source                                              | Windows and Linux: bare mark on a transparent square, near full-bleed for 16–32 px.          |
| `src/background.svg`       | Source                                              | dmg background layout.                                                                       |
| `src/installerHeader.svg`  | Source                                              | NSIS header layout.                                                                          |
| `src/installerSidebar.svg` | Source                                              | NSIS sidebar layout.                                                                         |
| `scripts/build-icons.sh`   | Manual                                              | Regenerates everything listed here.                                                          |

On Linux, the `.desktop` entry's `Icon=` name is set by electron-builder from `linux.executableName`
(the desktop scaffold owns that config). No icon-specific setting is needed.

## Regenerating

Run this after changing the layout templates in `scripts/build-icons.sh`, or if `public/img/grafana_icon.svg` changes:

```sh
desktop/resources/scripts/build-icons.sh
```

The script overwrites every file in the table, including the SVG sources, so edit the templates in the
script rather than the generated SVGs. Output is byte-for-byte reproducible for a given toolchain. This is a
manual design step: it is not part of CI, the root build, or the desktop package's install.

### Dependencies

Only system tools are used, with no Node packages:

| Tool                        | Debian/Ubuntu              | macOS (Homebrew)           |
| --------------------------- | -------------------------- | -------------------------- |
| `rsvg-convert` (librsvg)    | `apt install librsvg2-bin` | `brew install librsvg`     |
| ImageMagick (6 or 7)        | `apt install imagemagick`  | `brew install imagemagick` |
| Inter font (installer text) | `apt install fonts-inter`  | `brew install font-inter`  |
| `bash`, `awk`, `sha256sum`  | preinstalled               | preinstalled (`shasum`)    |

`icon.icns` is written directly by the script (PNG payloads in the `icp4`, `icp5`, and `ic07`–`ic14`
slots), so neither `iconutil` nor `png2icns` is required. To spot-check it, run `iconutil -c iconset icon.icns`
on macOS, or `icns2png -l icon.icns` from `icnsutils` on Linux. libicns reports `icp4`/`icp5` as unknown, but
macOS has read PNG data in those slots since 10.7.

## Colors

Installer art uses Grafana theme values from `packages/grafana-data/src/themes`:

| Use                              | Token                                                  | Value                 |
| -------------------------------- | ------------------------------------------------------ | --------------------- |
| Installer surface (dmg, NSIS)    | `palette.gray45`                                       | `#6e7177`             |
| Installer headings, arrow        | `palette.gray95` (light `background.secondary`)        | `#f4f5f5`             |
| Installer secondary text         | `palette.gray90` (light `secondary.main`)              | `#ececed`             |
| Icon tile gradient, top → bottom | `palette.gray15` → `palette.gray05` (dark backgrounds) | `#22252b` → `#111217` |
| Accent strip                     | dark `colors.gradients.brandHorizontal`                | `#FF8833` → `#F55F3E` |
| Text font and weight             | `typography.fontFamily`, `typography.fontWeightMedium` | Inter, 500            |

Why `gray45`: the dmg background is a static image, but Finder draws icon labels in black in light
appearance and in white in dark appearance. `gray45` is the palette step where both are readable (about 4.3:1
with black and 4.9:1 with white), and it is neither pure white nor pure black. The NSIS bitmaps use the same
surface so they read as a deliberate panel on both light and dark windows. The mark always sits on its dark
tile, so its own contrast does not depend on the surface.

The icon tile's drop shadow (`#000000` at 30% opacity) follows Apple's icon template rather than a theme
token. The mark keeps its original `#F05A28` → `#FBCA0A` gradient.
