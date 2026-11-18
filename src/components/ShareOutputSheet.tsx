import React from 'react';
import { View } from 'react-native';
import { Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { MAX_SHARE_FILES, selectShareableOutputFiles, ShareLimitError } from '../lib/outputSharing';
import { shareOutputFiles } from '../native/outputFiles';
import type { MediaType, SaveFileResult } from '../types/media';
import { PremiumBottomSheet } from './BottomSheet';
import { PrimaryButton, SecondaryButton, textStyles } from './AppUi';

export function ShareOutputSheet({ visible, results, onDismiss, onError, subtitle, preferVisualTypes = false }: {
  visible: boolean;
  results: readonly SaveFileResult[];
  onDismiss: () => void;
  onError: (message: string) => void;
  subtitle?: string;
  preferVisualTypes?: boolean;
}) {
  const { t } = useTranslation();
  const available = React.useMemo(() => [...new Set(results.filter((row) => row.ok && row.mediaType)
    .map((row) => row.mediaType!))], [results]);
  const [selected, setSelected] = React.useState<MediaType[]>([]);
  const [batch, setBatch] = React.useState(0), [busy, setBusy] = React.useState(false);
  const requestActive = React.useRef(false);
  React.useEffect(() => {
    if (!visible) return;
    const visual = available.filter((type) => type === 'photo' || type === 'video');
    setSelected(preferVisualTypes && visual.length ? visual : available);
    setBatch(0);
  }, [available, preferVisualTypes, visible]);
  const files = React.useMemo(() => selectShareableOutputFiles(results, selected), [results, selected]);
  const batches = Math.ceil(files.length / MAX_SHARE_FILES);
  const currentBatch = Math.min(batch, Math.max(0, batches - 1));
  const from = currentBatch * MAX_SHARE_FILES;
  const current = files.slice(from, from + MAX_SHARE_FILES);
  async function share() {
    if (requestActive.current || !current.length) return;
    requestActive.current = true;
    setBusy(true);
    try {
      const outcome = await shareOutputFiles(current, selected);
      if (!outcome.opened) onError(t('results.shareFailed'));
      // Launching a chooser is not a delivery receipt. The user chooses when
      // to return and explicitly request the next group of files.
    } catch (error) {
      onError(error instanceof ShareLimitError ? t('results.shareLimit', { limit: MAX_SHARE_FILES }) : t('results.shareFailed'));
    } finally {
      requestActive.current = false;
      setBusy(false);
    }
  }
  return <PremiumBottomSheet visible={visible} title={t('results.shareSheetTitle')} subtitle={subtitle} onDismiss={onDismiss}
    footer={<PrimaryButton disabled={busy || !current.length} onPress={() => { void share(); }}>{t('results.shareAction')}</PrimaryButton>}>
    <Text style={textStyles.start}>{t('results.shareBatchHint', { limit: MAX_SHARE_FILES })}</Text>
    {current.length ? <Text style={textStyles.start}>{t('results.shareBatchRange', { from: from + 1, to: from + current.length, total: files.length })}</Text> : null}
    {batches > 1 ? <View>
      <SecondaryButton disabled={busy || currentBatch === 0} onPress={() => setBatch(currentBatch - 1)}>{t('results.sharePreviousBatch')}</SecondaryButton>
      <SecondaryButton disabled={busy || currentBatch + 1 >= batches} onPress={() => setBatch(currentBatch + 1)}>{t('results.shareNextBatch')}</SecondaryButton>
    </View> : null}
    <SecondaryButton disabled={busy} selected={selected.length === available.length && available.length > 0}
      onPress={() => { setSelected(available); setBatch(0); }}>
      {t('results.shareAll', { count: results.filter((row) => row.ok && row.mediaType).length })}
    </SecondaryButton>
    {available.map((type) => <SecondaryButton key={type} disabled={busy} selected={selected.includes(type)} onPress={() => {
      setSelected((old) => old.includes(type) ? old.filter((value) => value !== type) : [...old, type]); setBatch(0);
    }}>{t('results.shareCategory', { label: t(`media.plural.${type}`), count: results.filter((row) => row.ok && row.mediaType === type).length })}</SecondaryButton>)}
  </PremiumBottomSheet>;
}
