import { css } from '@emotion/css';
import { type ComponentType, memo, useCallback, useMemo } from 'react';

import {
  LoadingState,
  type VariableOption,
  type VariableWithMultiSupport,
  type VariableWithOptions,
} from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { ClickOutsideWrapper } from '@grafana/ui';
import { type StoreState, useDispatch, useSelector } from 'app/types/store';

import { VARIABLE_PREFIX } from '../../constants';
import { isMulti } from '../../guard';
import { getVariableQueryRunner } from '../../query/VariableQueryRunner';
import { formatVariableLabel } from '../../shared/formatVariable';
import { toKeyedAction } from '../../state/keyedVariablesReducer';
import { getVariablesState } from '../../state/selectors';
import { toKeyedVariableIdentifier } from '../../utils';
import { VariableInput } from '../shared/VariableInput';
import { VariableLink } from '../shared/VariableLink';
import { VariableOptions } from '../shared/VariableOptions';
import { type NavigationKey, type VariablePickerProps } from '../types';

import { commitChangesToVariable, filterOrSearchOptions, navigateOptions, openOptions } from './actions';
import { initialOptionPickerState, toggleAllOptions, toggleOption } from './reducer';

export const optionPickerFactory = <Model extends VariableWithOptions | VariableWithMultiSupport>(): ComponentType<
  VariablePickerProps<Model>
> => {
  interface OwnProps extends VariablePickerProps<Model> {}

  const OptionsPicker = memo(function OptionsPicker({ variable, readOnly, onVariableChange }: OwnProps) {
    const dispatch = useDispatch();

    const picker = useSelector((state: StoreState) => {
      const { rootStateKey } = variable;
      if (!rootStateKey) {
        console.error('OptionPickerFactory: variable has no rootStateKey');
        return initialOptionPickerState;
      }
      return getVariablesState(rootStateKey, state).optionsPicker;
    });

    const keyedId = useMemo(() => toKeyedVariableIdentifier(variable), [variable]);

    const onShowOptions = useCallback(() => {
      dispatch(openOptions(keyedId, onVariableChange));
    }, [dispatch, keyedId, onVariableChange]);

    const onHideOptions = useCallback(() => {
      if (!variable.rootStateKey) {
        console.error('Variable has no rootStateKey');
        return;
      }
      dispatch(commitChangesToVariable(variable.rootStateKey, onVariableChange));
    }, [dispatch, variable.rootStateKey, onVariableChange]);

    const onToggleOption = useCallback(
      (option: VariableOption, clearOthers: boolean) => {
        dispatch(
          toKeyedAction(keyedId.rootStateKey, toggleOption({ option, clearOthers, forceSelect: false }))
        );
        if (!(isMulti(variable) && variable.multi) && variable.rootStateKey) {
          dispatch(commitChangesToVariable(variable.rootStateKey, onVariableChange));
        }
      },
      [dispatch, keyedId.rootStateKey, variable, onVariableChange]
    );

    const onToggleAllOptions = useCallback(() => {
      dispatch(toKeyedAction(keyedId.rootStateKey, toggleAllOptions()));
    }, [dispatch, keyedId.rootStateKey]);

    const onFilterOrSearchOptions = useCallback(
      (filter: string) => {
        dispatch(filterOrSearchOptions(keyedId, filter));
      },
      [dispatch, keyedId]
    );

    const onNavigate = useCallback(
      (key: NavigationKey, clearOthers: boolean) => {
        if (!variable.rootStateKey) {
          console.error('Variable has no rootStateKey');
          return;
        }
        dispatch(navigateOptions(variable.rootStateKey, key, clearOthers));
      },
      [dispatch, variable.rootStateKey]
    );

    const onCancel = useCallback(() => {
      getVariableQueryRunner().cancelRequest(keyedId);
    }, [keyedId]);

    const showOptionsOpen = picker.id === variable.id;
    const styles = useMemo(() => getStyles(), []);

    const linkText = formatVariableLabel(variable);
    const loading = variable.state === LoadingState.Loading;

    return (
      <div className={styles.variableLinkWrapper} data-testid={selectors.components.Variables.variableLinkWrapper}>
        {showOptionsOpen ? (
          <ClickOutsideWrapper onClick={onHideOptions}>
            <VariableInput
              id={VARIABLE_PREFIX + variable.id}
              value={picker.queryValue}
              onChange={onFilterOrSearchOptions}
              onNavigate={onNavigate}
              aria-expanded={true}
              aria-controls={`options-${variable.id}`}
            />
            <VariableOptions
              values={picker.options}
              onToggle={onToggleOption}
              onToggleAll={onToggleAllOptions}
              highlightIndex={picker.highlightIndex}
              multi={picker.multi}
              selectedValues={picker.selectedValues}
              id={`options-${variable.id}`}
            />
          </ClickOutsideWrapper>
        ) : (
          <VariableLink
            id={VARIABLE_PREFIX + variable.id}
            text={linkText}
            onClick={onShowOptions}
            loading={loading}
            onCancel={onCancel}
            disabled={readOnly}
          />
        )}
      </div>
    );
  });

  OptionsPicker.displayName = 'OptionsPicker';

  return OptionsPicker;
};

const getStyles = () => ({
  variableLinkWrapper: css({
    display: 'inline-block',
    position: 'relative',
  }),
});
