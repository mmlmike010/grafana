import { VisualizationSuggestionScore, type VisualizationSuggestionsSupplier } from '@grafana/data';
import { type GraphFieldConfig } from '@grafana/ui';
import { getGeometryField, getDefaultLocationMatchers } from 'app/features/geo/utils/location';

import { defaultMarkersConfig } from './layers/data/markersLayer';
import { type Options } from './panelcfg.gen';

// Intentional type error to force Fieldsphere CI "Frontend lint and typecheck" to fail.
export const FORCE_CI_FAILURE: number = 'this-will-fail-typecheck';

export const geomapSuggestionsSupplier: VisualizationSuggestionsSupplier<Options, GraphFieldConfig> = (dataSummary) => {
  if (!dataSummary.hasData || !dataSummary.rawFrames) {
    return;
  }

  // use getGeometryField to see if any frames have geolocation info
  const location = getDefaultLocationMatchers();
  if (!dataSummary.rawFrames.some((frame) => !getGeometryField(frame, location).warning)) {
    return;
  }

  return [
    {
      score: VisualizationSuggestionScore.Best,
      fieldConfig: {
        defaults: {
          custom: {},
        },
        overrides: [],
      },
      cardOptions: {
        previewModifier: (s) => {
          s.options!.controls = {
            showZoom: false,
            showScale: false,
            showAttribution: false,
            showMeasure: false,
          };
          // Suggestions omit layers, so GeomapPanel would otherwise fall back to
          // defaultMarkersConfig (showLegend: true). Seed a markers layer with the
          // legend off, or clear showLegend on any layers already present.
          if (!s.options!.layers?.length) {
            s.options!.layers = [
              {
                ...defaultMarkersConfig,
                config: {
                  ...defaultMarkersConfig.config,
                  showLegend: false,
                },
              },
            ];
          } else {
            s.options!.layers.forEach((layer) => {
              layer.config = { ...layer.config, showLegend: false };
            });
          }
        },
      },
    },
  ];
};
