import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { colorManipulator, createTheme, type GrafanaTheme2 } from '@grafana/data';

// Run from the repo root; see desktop/resources/startup/README.md.
const outputPath = resolve(process.cwd(), 'desktop', 'resources', 'startup', 'theme-vars.css');

type Vars = Array<[string, string | number]>;

function colorVars(theme: GrafanaTheme2): Vars {
  const { colors } = theme;
  return [
    ['--gf-color-background-canvas', colors.background.canvas],
    ['--gf-color-background-primary', colors.background.primary],
    ['--gf-color-background-secondary', colors.background.secondary],
    ['--gf-color-text-primary', colors.text.primary],
    ['--gf-color-text-secondary', colors.text.secondary],
    ['--gf-color-text-max-contrast', colors.text.maxContrast],
    ['--gf-color-border-weak', colors.border.weak],
    ['--gf-color-border-medium', colors.border.medium],
    ['--gf-color-primary-main', colors.primary.main],
    ['--gf-color-primary-hover', primaryHover(theme)],
    ['--gf-color-primary-contrast-text', colors.primary.contrastText],
    ['--gf-color-secondary-main', colors.secondary.main],
    ['--gf-color-secondary-shade', colors.secondary.shade],
    ['--gf-color-secondary-contrast-text', colors.secondary.contrastText],
    ['--gf-color-secondary-border', colors.secondary.border],
    // Matches the hover border of the @grafana/ui secondary Button.
    ['--gf-color-secondary-border-hover', colors.emphasize(colors.secondary.border, 0.25)],
    ['--gf-shadow-z1', theme.shadows.z1],
  ];
}

function sharedVars(theme: GrafanaTheme2): Vars {
  const { typography, spacing, shape, components, transitions } = theme;
  return [
    ['--gf-typography-html-font-size', `${typography.htmlFontSize}px`],
    ['--gf-typography-font-family', typography.fontFamily],
    ['--gf-typography-font-family-monospace', typography.fontFamilyMonospace],
    ['--gf-typography-font-weight-regular', typography.fontWeightRegular],
    ['--gf-typography-font-weight-medium', typography.fontWeightMedium],
    ['--gf-typography-size-sm', typography.size.sm],
    ['--gf-typography-size-md', typography.size.md],
    ['--gf-typography-body-font-size', typography.body.fontSize],
    ['--gf-typography-body-line-height', typography.body.lineHeight],
    ['--gf-typography-body-letter-spacing', typography.body.letterSpacing ?? 'normal'],
    ['--gf-typography-body-small-font-size', typography.bodySmall.fontSize],
    ['--gf-typography-body-small-line-height', typography.bodySmall.lineHeight],
    ['--gf-typography-h3-font-size', typography.h3.fontSize],
    ['--gf-typography-h3-line-height', typography.h3.lineHeight],
    ['--gf-typography-h4-font-size', typography.h4.fontSize],
    ['--gf-typography-h4-line-height', typography.h4.lineHeight],
    ['--gf-spacing-0-5', spacing(0.5)],
    ['--gf-spacing-1', spacing(1)],
    ['--gf-spacing-1-5', spacing(1.5)],
    ['--gf-spacing-2', spacing(2)],
    ['--gf-spacing-3', spacing(3)],
    ['--gf-spacing-4', spacing(4)],
    ['--gf-radius-default', shape.radius.default],
    ['--gf-components-height-md', spacing(components.height.md)],
    ['--gf-transition-duration-short', `${transitions.duration.short}ms`],
    ['--gf-transition-easing-in-out', transitions.easing.easeInOut],
  ];
}

function block(selector: string, vars: Vars): string {
  const lines = vars.map(([name, value]) => `  ${name}: ${String(value).replace(/\s+/g, ' ')};`);
  return `${selector} {\n${lines.join('\n')}\n}\n`;
}

const AA_TEXT = 4.5;

// Composites a possibly translucent color over an opaque one, returning an opaque rgb().
function flatten(color: string, under: string): string {
  const top = colorManipulator.decomposeColor(colorManipulator.asRgbString(color));
  const base = colorManipulator.decomposeColor(colorManipulator.asRgbString(under));
  const a: number = top.values[3] ?? 1;
  const values = [0, 1, 2].map((i) => Math.round(top.values[i] * a + base.values[i] * (1 - a)));
  return colorManipulator.recomposeColor({ type: 'rgb', values });
}

function contrast(fg: string, bg: string, canvas: string): number {
  const opaqueBg = flatten(bg, canvas);
  return colorManipulator.getContrastRatio(flatten(fg, opaqueBg), opaqueBg);
}

// @grafana/ui darkens primary buttons to primary.shade on hover, which drops below AA in the
// dark theme. Keep primary.main on hover whenever the shade wouldn't pass.
function primaryHover(theme: GrafanaTheme2): string {
  const { primary, background } = theme.colors;
  return contrast(primary.contrastText, primary.shade, background.canvas) >= AA_TEXT ? primary.shade : primary.main;
}

// Text/background pairs the startup page actually renders.
function checkContrast(theme: GrafanaTheme2): string[] {
  const { colors } = theme;
  const canvas = colors.background.canvas;
  const pairs: Array<[string, string, string]> = [
    ['text.primary on canvas', colors.text.primary, canvas],
    ['text.secondary on canvas', colors.text.secondary, canvas],
    ['text.primary on background.secondary', colors.text.primary, colors.background.secondary],
    ['primary.contrastText on primary.main', colors.primary.contrastText, colors.primary.main],
    ['primary.contrastText on primary hover', colors.primary.contrastText, primaryHover(theme)],
    ['secondary.contrastText on secondary.main', colors.secondary.contrastText, colors.secondary.main],
    ['secondary.contrastText on secondary.shade', colors.secondary.contrastText, colors.secondary.shade],
  ];
  const failures: string[] = [];
  for (const [label, fg, bg] of pairs) {
    const ratio = contrast(fg, bg, canvas);
    const line = `${theme.colors.mode} ${label}: ${ratio.toFixed(2)}:1`;
    console.log(line);
    if (ratio < AA_TEXT) {
      failures.push(line);
    }
  }
  return failures;
}

function generate() {
  const dark = createTheme({ colors: { mode: 'dark' } });
  const light = createTheme({ colors: { mode: 'light' } });

  const failures = [...checkContrast(dark), ...checkContrast(light)];
  if (failures.length > 0) {
    console.error(`\nWCAG AA contrast check failed:\n${failures.join('\n')}`);
    process.exit(1);
  }

  const css = [
    '/*\n * Generated from GrafanaTheme2 (createTheme in @grafana/data). Do not edit by hand.\n' +
      ' * Regenerate: see desktop/resources/startup/README.md.\n */\n',
    block(':root', sharedVars(dark)),
    // Dark is the default when main doesn't pass a theme.
    block(":root,\n:root[data-theme='dark']", [['color-scheme', 'dark'], ...colorVars(dark)]),
    block(":root[data-theme='light']", [['color-scheme', 'light'], ...colorVars(light)]),
  ].join('\n');

  writeFileSync(outputPath, css);
  console.log(`\nWrote ${outputPath}`);
  console.log(`backgroundColor dark: ${dark.colors.background.canvas}`);
  console.log(`backgroundColor light: ${light.colors.background.canvas}`);
}

generate();
