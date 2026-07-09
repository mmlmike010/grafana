import { css, keyframes } from '@emotion/css';
import { type FormEvent, memo, useCallback, useEffect, useState } from 'react';

import {
  type GrafanaTheme2,
  LoadingState,
  type SelectableValue,
  type VariableHide,
  type VariableType,
  type VariableWithOptions,
} from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { Trans, t } from '@grafana/i18n';
import { locationService } from '@grafana/runtime';
import { Button, Stack, Icon, type Themeable2, withTheme2 } from '@grafana/ui';
import { type StoreState, useDispatch, useSelector } from 'app/types/store';

import { VariableHideSelect } from '../../dashboard-scene/settings/variables/components/VariableHideSelect';
import { VariableLegend } from '../../dashboard-scene/settings/variables/components/VariableLegend';
import { VariableTextAreaField } from '../../dashboard-scene/settings/variables/components/VariableTextAreaField';
import { VariableTextField } from '../../dashboard-scene/settings/variables/components/VariableTextField';
import { VariableValuesPreview } from '../../dashboard-scene/settings/variables/components/VariableValuesPreview';
import { variableAdapters } from '../adapters';
import { hasOptions } from '../guard';
import { updateOptions } from '../state/actions';
import { toKeyedAction } from '../state/keyedVariablesReducer';
import { getVariable, getVariablesState } from '../state/selectors';
import { changeVariableProp, changeVariableType, removeVariable } from '../state/sharedReducer';
import { type KeyedVariableIdentifier } from '../state/types';
import { toKeyedVariableIdentifier, toVariablePayload } from '../utils';

import { ConfirmDeleteModal } from './ConfirmDeleteModal';
import { VariableTypeSelect } from './VariableTypeSelect';
import { changeVariableName, variableEditorMount, variableEditorUnMount } from './actions';
import { type OnPropChangeArguments, VariableNameConstraints } from './types';

// Adapter to make legacy VariableWithOptions compatible with VariableValuesPreview
function LegacyVariableValuesPreview({ variable }: { variable: VariableWithOptions }) {
  const options = variable.options.map((opt) => ({
    label: String(opt.text),
    value: Array.isArray(opt.value) ? opt.value.join(', ') : opt.value,
    properties: opt.properties,
  }));
  return <VariableValuesPreview options={options} staticOptions={[]} />;
}

export interface OwnProps extends Themeable2 {
  identifier: KeyedVariableIdentifier;
}

const VariableEditorEditorComponent = memo(function VariableEditorEditorComponent({ theme, identifier }: OwnProps) {
  const dispatch = useDispatch();
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const editor = useSelector((state: StoreState) => getVariablesState(identifier.rootStateKey, state).editor);
  const variable = useSelector((state: StoreState) => getVariable(identifier, state));

  useEffect(() => {
    dispatch(variableEditorMount(identifier));
    return () => {
      dispatch(variableEditorUnMount(identifier));
    };
    // Match legacy mount/unmount: only re-run when the keyed variable identity changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- identifier object identity may change without id change
  }, [dispatch, identifier.id, identifier.rootStateKey, identifier.type]);

  const changeVariablePropAction = useCallback(
    (id: KeyedVariableIdentifier, propName: string, propValue: unknown) => {
      dispatch(
        toKeyedAction(id.rootStateKey, changeVariableProp(toVariablePayload(id, { propName, propValue })))
      );
    },
    [dispatch]
  );

  const changeVariableTypeAction = useCallback(
    (id: KeyedVariableIdentifier, newType: VariableType) => {
      dispatch(toKeyedAction(id.rootStateKey, changeVariableType(toVariablePayload(id, { newType }))));
    },
    [dispatch]
  );

  const removeVariableAction = useCallback(
    (id: KeyedVariableIdentifier) => {
      dispatch(toKeyedAction(id.rootStateKey, removeVariable(toVariablePayload(id, { reIndex: true }))));
    },
    [dispatch]
  );

  const onNameChange = useCallback(
    (event: FormEvent<HTMLInputElement>) => {
      event.preventDefault();
      dispatch(changeVariableName(identifier, event.currentTarget.value));
    },
    [dispatch, identifier]
  );

  const onTypeChange = useCallback(
    (option: SelectableValue<VariableType>) => {
      if (!option.value) {
        return;
      }
      changeVariableTypeAction(identifier, option.value);
    },
    [changeVariableTypeAction, identifier]
  );

  const onLabelChange = useCallback(
    (event: FormEvent<HTMLInputElement>) => {
      event.preventDefault();
      changeVariablePropAction(identifier, 'label', event.currentTarget.value);
    },
    [changeVariablePropAction, identifier]
  );

  const onDescriptionChange = useCallback(
    (event: FormEvent<HTMLTextAreaElement>) => {
      changeVariablePropAction(identifier, 'description', event.currentTarget.value);
    },
    [changeVariablePropAction, identifier]
  );

  const onHideChange = useCallback(
    (option: VariableHide) => {
      changeVariablePropAction(identifier, 'hide', option);
    },
    [changeVariablePropAction, identifier]
  );

  const onPropChanged = useCallback(
    ({ propName, propValue, updateOptions: shouldUpdateOptions = false }: OnPropChangeArguments) => {
      changeVariablePropAction(identifier, propName, propValue);
      if (shouldUpdateOptions) {
        dispatch(updateOptions(toKeyedVariableIdentifier(variable)));
      }
    },
    [changeVariablePropAction, dispatch, identifier, variable]
  );

  const onHandleSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!editor.isValid) {
        return;
      }
      dispatch(updateOptions(toKeyedVariableIdentifier(variable)));
    },
    [dispatch, editor.isValid, variable]
  );

  const onModalOpen = useCallback(() => {
    setShowDeleteModal(true);
  }, []);

  const onModalClose = useCallback(() => {
    setShowDeleteModal(false);
  }, []);

  const onDelete = useCallback(() => {
    removeVariableAction(identifier);
    onModalClose();
    locationService.partial({ editIndex: null });
  }, [identifier, onModalClose, removeVariableAction]);

  const onApply = useCallback(() => {
    locationService.partial({ editIndex: null });
  }, []);

  const EditorToRender = variableAdapters.get(variable.type).editor;
  if (!EditorToRender) {
    return null;
  }
  const loading = variable.state === LoadingState.Loading;
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const styles = getStyles(theme);

  return (
    <>
      <form
        aria-label={t(
          'variables.variable-editor-editor-un-connected.aria-label-variable-editor-form',
          'Variable editor Form'
        )}
        onSubmit={onHandleSubmit}
      >
        <VariableTypeSelect onChange={onTypeChange} type={variable.type} />

        <VariableLegend>
          <Trans i18nKey="variables.variable-editor-editor-un-connected.general">General</Trans>
        </VariableLegend>
        <VariableTextField
          value={editor.name}
          onChange={onNameChange}
          name={t('variables.variable-editor-editor-un-connected.name-name', 'Name')}
          placeholder={t('variables.variable-editor-editor-un-connected.placeholder-variable-name', 'Variable name')}
          description={t(
            'variables.variable-editor-editor-un-connected.description-template-variable-characters',
            'The name of the template variable. (Max. 50 characters)'
          )}
          invalid={!!editor.errors.name}
          error={editor.errors.name}
          testId={selectors.pages.Dashboard.Settings.Variables.Edit.General.generalNameInputV2}
          maxLength={VariableNameConstraints.MaxSize}
          required
        />

        <VariableTextField
          name={t('variables.variable-editor-editor-un-connected.name-label', 'Label')}
          description={t(
            'variables.variable-editor-editor-un-connected.description-optional-display-name',
            'Optional display name'
          )}
          value={variable.label ?? ''}
          placeholder={t('variables.variable-editor-editor-un-connected.placeholder-label-name', 'Label name')}
          onChange={onLabelChange}
          testId={selectors.pages.Dashboard.Settings.Variables.Edit.General.generalLabelInputV2}
        />
        <VariableTextAreaField
          name={t('variables.variable-editor-un-connected.name-description', 'Description')}
          value={variable.description ?? ''}
          placeholder={t(
            'variables.variable-editor-un-connected.placeholder-descriptive-text',
            'Descriptive text'
          )}
          onChange={onDescriptionChange}
          width={52}
        />
        <VariableHideSelect onChange={onHideChange} hide={variable.hide} type={variable.type} />

        {EditorToRender && <EditorToRender variable={variable} onPropChange={onPropChanged} />}

        {hasOptions(variable) ? <LegacyVariableValuesPreview variable={variable} /> : null}

        <div style={{ marginTop: '16px' }}>
          <Stack gap={2} height="inherit">
            <Button variant="destructive" fill="outline" onClick={onModalOpen}>
              <Trans i18nKey="variables.variable-editor-editor-un-connected.delete">Delete</Trans>
            </Button>
            <Button
              type="submit"
              data-testid={selectors.pages.Dashboard.Settings.Variables.Edit.General.submitButton}
              disabled={loading}
              variant="secondary"
            >
              <Trans i18nKey="variables.variable-editor-editor-un-connected.run-query">Run query</Trans>
              {loading && (
                <Icon
                  className={styles.spin}
                  name={prefersReducedMotion ? 'hourglass' : 'sync'}
                  size="sm"
                  style={{ marginLeft: '2px' }}
                />
              )}
            </Button>
            <Button
              variant="primary"
              onClick={onApply}
              data-testid={selectors.pages.Dashboard.Settings.Variables.Edit.General.applyButton}
            >
              <Trans i18nKey="variables.variable-editor-editor-un-connected.apply">Apply</Trans>
            </Button>
          </Stack>
        </div>
      </form>
      <ConfirmDeleteModal
        isOpen={showDeleteModal}
        varName={editor.name}
        onConfirm={onDelete}
        onDismiss={onModalClose}
      />
    </>
  );
});

export const VariableEditorEditor = withTheme2(VariableEditorEditorComponent);

const spin = keyframes({
  '0%': {
    transform: 'rotate(0deg) scaleX(-1)', // scaleX flips the `sync` icon so arrows point the correct way
  },
  '100%': {
    transform: 'rotate(359deg) scaleX(-1)',
  },
});

const getStyles = (theme: GrafanaTheme2) => {
  return {
    spin: css({
      [theme.transitions.handleMotion('no-preference')]: {
        animation: `${spin} 3s linear infinite`,
      },
    }),
  };
};
