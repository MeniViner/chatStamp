import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Button, Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { readTranscriptPage, type TranscriptPage } from '../services/transcriptReader';
import { useAppTheme } from '../theme/useAppTheme';

type Props = { uri: string; filename: string };

export function TranscriptReader(props: Props) {
  return <TranscriptDocument key={props.uri} {...props} />;
}

function TranscriptDocument({ uri, filename }: Props) {
  const { t } = useTranslation();
  const theme = useAppTheme();
  const [position, setPosition] = React.useState({ offset: 0, previous: [] as number[] });
  const [page, setPage] = React.useState<TranscriptPage>();
  const [failed, setFailed] = React.useState(false), [retry, setRetry] = React.useState(0);
  React.useEffect(() => {
    let alive = true;
    setPage(undefined); setFailed(false);
    void readTranscriptPage(uri, position.offset).then((result) => {
      if (alive) setPage(result);
    }, () => { if (alive) setFailed(true); });
    return () => { alive = false; };
  }, [position.offset, retry, uri]);
  const current = page?.offset === position.offset ? page : undefined;
  const previous = position.previous.length > 0;
  return <View style={styles.reader}>
    {failed ? <View style={styles.status}>
      <Text accessibilityRole="alert">{t('viewer.transcriptError')}</Text>
      <Button onPress={() => setRetry((value) => value + 1)}>{t('viewer.transcriptRetry')}</Button>
    </View> : current ? <>
      <ScrollView key={current.offset} style={styles.scroll} contentContainerStyle={styles.content}
        accessibilityLabel={filename} nestedScrollEnabled>
        <Text selectable style={[styles.text, { color: theme.colors.onSurface }]}>{current.text || t('viewer.transcriptEmpty')}</Text>
      </ScrollView>
      <View style={[styles.footer, { borderTopColor: theme.colors.outlineVariant }]}>
        {previous || current.nextOffset !== null ? <>
          <Text variant="bodySmall" style={styles.section}>{t('viewer.transcriptSection', { current: position.previous.length + 1 })}</Text>
          <View style={styles.controls}>
            <Button mode="outlined" style={styles.button} disabled={!previous} onPress={() => setPosition((value) => value.offset !== current.offset ? value : ({
              offset: value.previous[value.previous.length - 1] ?? 0, previous: value.previous.slice(0, -1),
            }))}>{t('viewer.transcriptPreviousSection')}</Button>
            <Button mode="contained-tonal" style={styles.button} disabled={current.nextOffset === null} onPress={() => {
              const nextOffset = current.nextOffset;
              if (nextOffset !== null) setPosition((value) => value.offset !== current.offset ? value : ({ offset: nextOffset, previous: [...value.previous, value.offset] }));
            }}>{t('viewer.transcriptNextSection')}</Button>
          </View>
        </> : null}
        {current.nextOffset === null ? <Text variant="bodySmall" style={styles.section}>{t('viewer.transcriptEnd')}</Text> : null}
      </View>
    </> : <View style={styles.status}><ActivityIndicator accessibilityLabel={t('viewer.transcriptLoading')} /></View>}
  </View>;
}

const styles = StyleSheet.create({
  reader: { flex: 1, width: '100%' }, scroll: { flex: 1 }, content: { padding: 16 },
  text: { fontSize: 16, lineHeight: 25, textAlign: 'auto', writingDirection: 'auto' },
  status: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 16, gap: 12 },
  footer: { padding: 8, gap: 6, borderTopWidth: StyleSheet.hairlineWidth },
  section: { textAlign: 'center' }, controls: { flexDirection: 'row', gap: 8 }, button: { flex: 1, minHeight: 48 },
});
