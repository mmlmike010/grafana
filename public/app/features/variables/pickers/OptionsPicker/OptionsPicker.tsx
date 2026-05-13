import { css } from '@emotion/css';
import { type ComponentType, memo, useCallback } from 'react';

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
import { initialOptionPickerState, type OptionsPickerState, toggleAllOptions, toggleOption } from './reducer';

export const optionPickerFactory = <Model extends VariableWithOptions | VariableWithMultiSupport>(): ComponentType<
  VariablePickerProps<Model>
> => {
  const OptionsPicker = memo(function OptionsPicker({
    variable,
    onVariableChange,
    readOnly,
  }: VariablePickerProps<Model>) {
    const dispatch = useDispatch();
    const picker = useSelector((state: StoreState) => {
      const { rootStateKey } = variable;
      if (!rootStateKey) {
        console.error('OptionPickerFactory: variable has no rootStateKey');
        return initialOptionPickerState;
      }

      return getVariablesState(rootStateKey, state).optionsPicker;
    });
    const showOptions = picker.id === variable.id;
    const styles = getStyles();

    const onHideOptions = useCallback(() => {
      if (!variable.rootStateKey) {
        console.error('Variable has no rootStateKey');
        return;
      }

      dispatch(commitChangesToVariable(variable.rootStateKey, onVariableChange));
    }, [dispatch, onVariableChange, variable.rootStateKey]);

    const onShowOptions = useCallback(() => {
      dispatch(openOptions(toKeyedVariableIdentifier(variable), onVariableChange));
    }, [dispatch, onVariableChange, variable]);

    const onToggleSingleValueVariable = useCallback(
      (option: VariableOption, clearOthers: boolean) => {
        const identifier = toKeyedVariableIdentifier(variable);
        dispatch(toKeyedAction(identifier.rootStateKey, toggleOption({ option, clearOthers, forceSelect: false })));
        onHideOptions();
      },
      [dispatch, onHideOptions, variable]
    );

    const onToggleMultiValueVariable = useCallback(
      (option: VariableOption, clearOthers: boolean) => {
        const identifier = toKeyedVariableIdentifier(variable);
        dispatch(toKeyedAction(identifier.rootStateKey, toggleOption({ option, clearOthers, forceSelect: false })));
      },
      [dispatch, variable]
    );

    const onToggleOption = useCallback(
      (option: VariableOption, clearOthers: boolean) => {
        const toggleFunc =
          isMulti(variable) && variable.multi ? onToggleMultiValueVariable : onToggleSingleValueVariable;
        toggleFunc(option, clearOthers);
      },
      [onToggleMultiValueVariable, onToggleSingleValueVariable, variable]
    );

    const onToggleAllOptions = useCallback(() => {
      const identifier = toKeyedVariableIdentifier(variable);
      dispatch(toKeyedAction(identifier.rootStateKey, toggleAllOptions()));
    }, [dispatch, variable]);

    const onFilterOrSearchOptions = useCallback(
      (filter: string) => {
        dispatch(filterOrSearchOptions(toKeyedVariableIdentifier(variable), filter));
      },
      [dispatch, variable]
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
      getVariableQueryRunner().cancelRequest(toKeyedVariableIdentifier(variable));
    }, [variable]);

    const renderLink = (variable: VariableWithOptions) => {
      const linkText = formatVariableLabel(variable);
      const loading = variable.state === LoadingState.Loading;

      return (
        <VariableLink
          id={VARIABLE_PREFIX + variable.id}
          text={linkText}
          onClick={onShowOptions}
          loading={loading}
          onCancel={onCancel}
          disabled={readOnly}
        />
      );
    };

    const renderOptions = (picker: OptionsPickerState) => {
      const { id } = variable;
      return (
        <ClickOutsideWrapper onClick={onHideOptions}>
          <VariableInput
            id={VARIABLE_PREFIX + id}
            value={picker.queryValue}
            onChange={onFilterOrSearchOptions}
            onNavigate={onNavigate}
            aria-expanded={true}
            aria-controls={`options-${id}`}
          />
          <VariableOptions
            values={picker.options}
            onToggle={onToggleOption}
            onToggleAll={onToggleAllOptions}
            highlightIndex={picker.highlightIndex}
            multi={picker.multi}
            selectedValues={picker.selectedValues}
            id={`options-${id}`}
          />
        </ClickOutsideWrapper>
      );
    };

    return (
      <div className={styles.variableLinkWrapper} data-testid={selectors.components.Variables.variableLinkWrapper}>
        {showOptions ? renderOptions(picker) : renderLink(variable)}
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
