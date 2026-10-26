import { t } from '@grafana/i18n';
import { Badge, Icon, useStyles2 } from '@grafana/ui';

import { getCardHeaderStyles } from './sharedStyles';

interface Props {
  label: string;
  complete: boolean;
  isNext: boolean;
}

export const CardStatus = ({ label, complete, isNext }: Props) => {
  const styles = useStyles2(getCardHeaderStyles, complete);

  return (
    <div className={styles.header}>
      <span className={styles.status}>
        {complete && <Icon name="check-circle" aria-hidden />}
        {complete ? t('gettingstarted.card-status.complete', 'Complete') : label}
      </span>
      {isNext && <Badge color="brand" text={t('gettingstarted.card-status.up-next', 'Up next')} />}
    </div>
  );
};
