import React from 'react';
import { AppState, BackHandler, ScrollView, StyleSheet, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { RadioButton, Snackbar, Text } from 'react-native-paper';
import { FooterActions, WizardScreen } from './WizardScreen';
import { useTranslation } from 'react-i18next';
import { usePipelineStore } from '../store/pipelineStore';
import { countSelectedSaveableFiles } from '../store/selectionLogic';
import { buildSelectedPreview } from '../store/selectedPreview';
import { hasAllFilesAccess, openAllFilesAccessSettings } from '../native/allFilesAccess';
import { openOutputFolderPicker, testPickedFolderTimestampSupport } from '../native/outputFolderPicker';
import { useSettingsStore } from '../store/settingsStore';
import { useAppTheme } from '../theme/useAppTheme';
import {
  buildOutputPathPreview,
  buildTermuxParityOutputPath,
  formatExportTimestamp,
  sanitizePathSegment
} from '../lib/termuxParityOutput';
import type { DuplicateHandlingMode, OutputOrganizationMode } from '../types/media';
import {
  InfoRow,
  MetricTile,
  PrimaryButton,
  SecondaryButton,
  SelectableOptionCard,
  SettingsSectionCard,
  SettingRow,
  StatusBadge,
  textStyles
} from '../components/AppUi';
import { spacing } from '../theme/designTokens';

const organizationModes: OutputOrganizationMode[] = ['all-in-one', 'by-type', 'by-sender', 'by-sender-and-type'];
const duplicateModes: DuplicateHandlingMode[] = ['keep-both', 'skip-existing', 'replace-existing'];

export function OutputFolderScreen() {
  const { t } = useTranslation();
  const theme = useAppTheme();
  const zipName = usePipelineStore((state) => state.zipName);
  const mediaFiles = usePipelineStore((state) => state.mediaFiles);
  const selectedSenders = usePipelineStore((state) => state.selectedSenders);
  const selectedMediaTypes = usePipelineStore((state) => state.selectedMediaTypes);
  const selectedFileIds = usePipelineStore((state) => state.selectedFileIds);
  const setStage = usePipelineStore((state) => state.setStage);
  const settings = useSettingsStore((state) => state.settings);
  const updateSettings = useSettingsStore((state) => state.updateSettings);
  const resetSaveLocation = useSettingsStore((state) => state.resetSaveLocation);
  const [allFilesAccessGranted, setAllFilesAccessGranted] = React.useState(false);
  const [checking, setChecking] = React.useState(true);
  const [snackbar, setSnackbar] = React.useState<string | undefined>();

  const preview = buildSelectedPreview(mediaFiles, selectedSenders, selectedMediaTypes, selectedFileIds);
  const selectedCount = countSelectedSaveableFiles(mediaFiles, selectedSenders, selectedMediaTypes, selectedFileIds);
  const chatName = sanitizePathSegment(zipName?.replace(/\.zip$/i, '') ?? t('common.importedChat'));
  const previewTimestamp = React.useMemo(() => formatExportTimestamp(new Date('2026-05-02T14:30:00')), []);
  const outputRoot = settings.saveDestinationMode === 'custom-folder'
    ? `${settings.customFolder?.readablePathLabel ?? settings.customFolder?.displayName ?? t('outputOptions.selectedFolder')}/${chatName}${settings.outputOrganization.createExportTimestampFolder ? `/Export ${previewTimestamp}` : ''}`
    : buildTermuxParityOutputPath(chatName, {
        baseFolder: settings.baseFolder,
        exportTimestamp: previewTimestamp,
        organization: settings.outputOrganization
      });

  const previewPaths = preview.selectedFiles.slice(0, 3).map((file) =>
    buildOutputPathPreview({
      chatName,
      filename: file.filename,
      mediaType: file.mediaType,
      sender: file.sender,
      baseFolder:
        settings.saveDestinationMode === 'default-accurate-folder'
          ? settings.baseFolder
          : settings.customFolder?.readablePathLabel ?? settings.customFolder?.displayName ?? t('outputOptions.selectedFolder'),
      exportTimestamp: previewTimestamp,
      organization: settings.outputOrganization
    })
  );

  const refreshPermission = React.useCallback(async () => {
    setChecking(true);
    try {
      setAllFilesAccessGranted(await hasAllFilesAccess());
    } finally {
      setChecking(false);
    }
  }, []);

  React.useEffect(() => {
    void refreshPermission();
    const appStateSubscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void refreshPermission();
    });
    const backSubscription = BackHandler.addEventListener('hardwareBackPress', () => {
      setStage('selectFiles');
      return true;
    });
    return () => {
      appStateSubscription.remove();
      backSubscription.remove();
    };
  }, [refreshPermission, setStage]);

  async function chooseFolder() {
    try {
      const folder = await openOutputFolderPicker();
      const support = await testPickedFolderTimestampSupport(folder.treeUri);
      await updateSettings({
        saveDestinationMode: 'custom-folder',
        useDefaultFolder: false,
        customFolder: folder,
        customFolderTimestampSupport: support
      });
    } catch (error) {
      setSnackbar(error instanceof Error ? error.message : t('settings.folderPickFailed'));
    }
  }

  const canSave =
    selectedCount > 0 &&
    (settings.saveDestinationMode === 'custom-folder'
      ? Boolean(settings.customFolder?.treeUri)
      : allFilesAccessGranted && !checking);

  return (
    <WizardScreen
      stage="outputOptions"
      title={t('outputOptions.title')}
      subtitle={t('outputOptions.subtitle')}
      onBack={() => setStage('selectFiles')}
      footer={
        <FooterActions>
          <PrimaryButton icon="content-save-check-outline" disabled={!canSave} onPress={() => setStage('saving')}>
            {t('outputOptions.save')}
          </PrimaryButton>
        </FooterActions>
      }
    >
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Section title={t('outputOptions.destinationTitle')} icon="folder-cog-outline">
          <ChoiceCard
            title={t('outputOptions.defaultAccurateFolder')}
            body={t('outputOptions.defaultAccurateFolderBody')}
            selected={settings.saveDestinationMode === 'default-accurate-folder'}
            badge={t('outputOptions.recommended')}
            onPress={() =>
              void updateSettings({
                saveDestinationMode: 'default-accurate-folder',
                useDefaultFolder: true
              })
            }
          />
          <ChoiceCard
            title={t('outputOptions.customFolder')}
            body={
              settings.customFolder?.readablePathLabel ??
              settings.customFolder?.displayName ??
              t('outputOptions.customFolderBody')
            }
            selected={settings.saveDestinationMode === 'custom-folder'}
            onPress={() =>
              void updateSettings({
                saveDestinationMode: 'custom-folder',
                useDefaultFolder: false
              })
            }
          />
          <View style={styles.buttonRow}>
            <SecondaryButton icon="folder-plus-outline" onPress={() => void chooseFolder()}>
              {t('outputOptions.chooseFolder')}
            </SecondaryButton>
            <SecondaryButton onPress={() => void resetSaveLocation()}>
              {t('outputOptions.resetFolder')}
            </SecondaryButton>
          </View>
        </Section>

        <Section title={t('outputOptions.organizationTitle')} icon="folder-multiple-outline">
          <View style={styles.modeList}>
            {organizationModes.map((mode) => (
              <ChoiceCard
                key={mode}
                title={t(`outputOptions.organizationModes.${mode}.title`)}
                body={t(`outputOptions.organizationModes.${mode}.body`)}
                example={t(`outputOptions.organizationModes.${mode}.example`)}
                selected={settings.outputOrganization.mode === mode}
                onPress={() =>
                  void updateSettings({
                    outputOrganization: {
                      ...settings.outputOrganization,
                      mode
                    }
                  })
                }
              />
            ))}
          </View>
          <SettingRow
            icon="calendar-clock-outline"
            title={t('outputOptions.createExportTimestampFolder')}
            description={t('outputOptions.createExportTimestampFolderBody')}
            value={settings.outputOrganization.createExportTimestampFolder}
            onValueChange={(value) =>
              void updateSettings({
                outputOrganization: { ...settings.outputOrganization, createExportTimestampFolder: value }
              })
            }
          />
          <Text variant="labelLarge">{t('outputOptions.duplicateHandling')}</Text>
          <RadioButton.Group
            value={settings.outputOrganization.duplicateHandling}
            onValueChange={(value) =>
              void updateSettings({
                outputOrganization: {
                  ...settings.outputOrganization,
                  duplicateHandling: normalizeDuplicateMode(value)
                }
              })
            }
          >
            {duplicateModes.map((mode) => (
              <RadioItem key={mode} label={t(`outputOptions.duplicateModes.${mode}`)} value={mode} />
            ))}
          </RadioButton.Group>
          <StatusBadge label={t(`outputOptions.organizationModes.${settings.outputOrganization.mode}.title`)} selected />
          <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
            {getOrganizationSummaryText(t, settings.outputOrganization)}
          </Text>
        </Section>

        <Section title={t('outputOptions.accessTitle')} icon="shield-outline">
          {settings.saveDestinationMode === 'default-accurate-folder' ? (
            <>
              <StatusRow
                icon={allFilesAccessGranted ? 'shield-check-outline' : 'shield-alert-outline'}
                label={t('outputOptions.allFilesAccess')}
                value={checking ? t('outputOptions.checkingPermission') : allFilesAccessGranted ? t('outputOptions.granted') : t('outputOptions.needed')}
              />
              {!allFilesAccessGranted ? (
                <SecondaryButton icon="cog-outline" onPress={() => void openAllFilesAccessSettings()}>
                  {t('outputOptions.grantAccess')}
                </SecondaryButton>
              ) : null}
            </>
          ) : (
            <StatusRow
              icon={settings.customFolderTimestampSupport?.timestampVerified ? 'calendar-check-outline' : 'calendar-alert-outline'}
              label={t('outputOptions.customFolderSupport')}
              value={
                settings.customFolderTimestampSupport?.timestampVerified
                  ? t('outputOptions.customFolderSupportReady')
                  : t('outputOptions.customFolderSupportLimited')
              }
            />
          )}
        </Section>

        <Section title={t('outputOptions.summaryTitle')} icon="image-multiple-outline">
          <View style={styles.metricRow}>
            <MetricPill label={t('outputOptions.selectedItems')} value={String(selectedCount)} />
            <MetricPill label={t('outputOptions.selectedSenders')} value={String(new Set(preview.selectedFiles.map((file) => file.sender)).size)} />
            <MetricPill label={t('outputOptions.other')} value={String(preview.selectedOther)} />
          </View>
          <StatusRow icon="image-outline" label={t('outputOptions.photos')} value={String(preview.selectedPhotos)} />
          <StatusRow icon="video-outline" label={t('outputOptions.videos')} value={String(preview.selectedVideos)} />
          <StatusRow icon="archive-outline" label={t('outputOptions.outputFolder')} value={outputRoot} />
        </Section>

        <Section title={t('outputOptions.previewTitle')} icon="file-tree-outline">
          <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
            {t('outputOptions.previewBody')}
          </Text>
          <FolderTreePreview paths={[outputRoot, ...previewPaths]} />
        </Section>
      </ScrollView>
      <Snackbar visible={Boolean(snackbar)} onDismiss={() => setSnackbar(undefined)} duration={3200}>
        {snackbar}
      </Snackbar>
    </WizardScreen>
  );
}

function Section({ title, icon, children }: { title: string; icon: React.ComponentProps<typeof MaterialCommunityIcons>['name']; children: React.ReactNode }) {
  return <SettingsSectionCard title={title} icon={icon}>{children}</SettingsSectionCard>;
}

function ChoiceCard({
  title,
  body,
  selected,
  onPress,
  badge,
  example
}: {
  title: string;
  body: string;
  selected: boolean;
  onPress: () => void;
  badge?: string;
  example?: string;
}) {
  return (
    <SelectableOptionCard title={title} description={body} selected={selected} badge={badge} example={example} onPress={onPress} />
  );
}

function MetricPill({ label, value }: { label: string; value: string }) {
  return (
    <MetricTile label={label} value={value} />
  );
}

function StatusRow({ icon, label, value }: { icon: React.ComponentProps<typeof MaterialCommunityIcons>['name']; label: string; value: string }) {
  return <InfoRow icon={icon} label={label} value={value} path={value.includes('/') || value.includes('\\')} />;
}

function FolderTreePreview({ paths }: { paths: string[] }) {
  const rows = React.useMemo(() => buildTreeRows(paths), [paths]);
  const theme = useAppTheme();
  return (
    <View style={styles.treePreview}>
      {rows.map((row) => (
        <View key={row.key} style={[styles.treeRow, { paddingStart: row.level * 12 }]}>
          <MaterialCommunityIcons
            name={row.isLeaf ? 'file-outline' : 'folder-outline'}
            size={16}
            color={row.isLeaf ? theme.colors.onSurfaceVariant : theme.colors.primary}
          />
          <Text
            variant="bodySmall"
            numberOfLines={1}
            ellipsizeMode="tail"
            style={[styles.flex, textStyles.start, { color: theme.colors.onSurfaceVariant }]}
          >
            {row.label}
          </Text>
        </View>
      ))}
    </View>
  );
}

function buildTreeRows(paths: string[]): { key: string; label: string; level: number; isLeaf: boolean }[] {
  const normalizedPaths = paths.map((path) => path.replace(/\\/g, '/')).filter(Boolean);
  const prefixSet = new Set<string>();
  const fullPathSet = new Set(normalizedPaths);
  const rows: { key: string; label: string; level: number; isLeaf: boolean }[] = [];

  normalizedPaths.forEach((path) => {
    const segments = path.split('/').filter(Boolean).slice(-6);
    segments.forEach((segment, index) => {
      const prefix = segments.slice(0, index + 1).join('/');
      if (prefixSet.has(prefix)) return;
      prefixSet.add(prefix);
      rows.push({
        key: prefix,
        label: segment,
        level: index,
        isLeaf: fullPathSet.has(prefix) || index === segments.length - 1
      });
    });
  });

  return rows.slice(0, 18);
}

function RadioItem({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.radioRow}>
      <Text variant="bodyMedium" numberOfLines={2} style={[styles.flex, textStyles.start]}>
        {label}
      </Text>
      <RadioButton value={value} />
    </View>
  );
}

function normalizeDuplicateMode(value: string): DuplicateHandlingMode {
  if (value === 'skip-existing' || value === 'replace-existing') return value;
  return 'keep-both';
}

function getOrganizationSummaryText(
  t: (key: string) => string,
  organization: { mode: OutputOrganizationMode; createExportTimestampFolder: boolean; duplicateHandling: DuplicateHandlingMode }
): string {
  const parts = [t(`outputOptions.organizationModes.${organization.mode}.title`)];
  parts.push(
    organization.createExportTimestampFolder
      ? t('outputOptions.createExportTimestampFolder')
      : t('settings.noExportTimestampFolder')
  );
  parts.push(t(`outputOptions.duplicateModes.${organization.duplicateHandling}`));
  return parts.join(' • ');
}

const styles = StyleSheet.create({
  content: {
    gap: spacing.card,
    paddingBottom: spacing.section
  },
  modeList: {
    gap: 8
  },
  treePreview: {
    gap: spacing.tinyGap
  },
  treeRow: {
    minHeight: 24,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.tinyGap
  },
  buttonRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6
  },
  radioRow: {
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  metricRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8
  },
  metricPill: {
    minWidth: 92,
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 2
  },
  flex: {
    flex: 1
  }
});
