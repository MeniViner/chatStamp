import React from 'react';
import { AppState, BackHandler, ScrollView, StyleSheet, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Snackbar, Text } from 'react-native-paper';
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
  ExpandableTechnicalDetails,
  FilePathText,
  InfoRow,
  OptionCard,
  PremiumCard,
  PrimaryButton,
  SecondaryButton,
  SettingRow,
  SummaryMetricCard,
  StatusBanner,
  SectionHeader,
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
  const disabledReason = getSaveDisabledReason({
    selectedCount,
    checking,
    allFilesAccessGranted,
    customFolderSelected: settings.saveDestinationMode === 'custom-folder',
    hasCustomFolder: Boolean(settings.customFolder?.treeUri),
    t
  });
  const ready = canSave;
  const destinationName =
    settings.saveDestinationMode === 'custom-folder'
      ? settings.customFolder?.displayName ?? settings.customFolder?.readablePathLabel ?? t('outputOptions.selectedFolder')
      : getFriendlyFolderName(settings.baseFolder);

  return (
    <WizardScreen
      stage="outputOptions"
      title={t('outputOptions.title')}
      subtitle={t('outputOptions.subtitle')}
      onBack={() => setStage('selectFiles')}
      footer={
        <FooterActions>
          {!canSave && disabledReason ? (
            <Text variant="bodySmall" style={[textStyles.start, { color: theme.colors.error }]}>
              {disabledReason}
            </Text>
          ) : (
            <Text variant="bodySmall" style={[textStyles.start, { color: theme.colors.onSurfaceVariant }]}>
              {t('outputOptions.footerReadyCount', { count: selectedCount })}
            </Text>
          )}
          <PrimaryButton icon="content-save-check-outline" disabled={!canSave} onPress={() => setStage('saving')}>
            {t('outputOptions.save')}
          </PrimaryButton>
        </FooterActions>
      }
    >
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <StatusBanner
          tone={ready ? 'success' : 'warning'}
          icon={ready ? 'check-circle-outline' : 'alert-circle-outline'}
          title={ready ? t('outputOptions.readyTitle') : disabledReason ?? t('outputOptions.notReadyTitle')}
        />

        <Section title={t('outputOptions.destinationTitle')} icon="folder-cog-outline">
          <PremiumCard>
            <View style={styles.destinationHeader}>
              <View style={[styles.destinationIcon, { backgroundColor: theme.colors.secondaryContainer }]}>
                <MaterialCommunityIcons name="folder-heart-outline" size={28} color={theme.colors.primary} />
              </View>
              <View style={styles.flex}>
                <Text variant="titleMedium" style={[textStyles.start, styles.strongText]}>
                  {settings.saveDestinationMode === 'custom-folder' && !settings.customFolder
                    ? t('outputOptions.noFolderSelected')
                    : destinationName}
                </Text>
                <Text variant="bodySmall" style={[textStyles.start, { color: theme.colors.onSurfaceVariant }]}>
                  {settings.saveDestinationMode === 'custom-folder'
                    ? t('outputOptions.customFolderBody')
                    : t('outputOptions.defaultAccurateFolderBody')}
                </Text>
              </View>
            </View>

            {settings.saveDestinationMode === 'default-accurate-folder' && !allFilesAccessGranted ? (
              <StatusBanner tone="warning" title={t('settings.permissionMissingTitle')} body={disabledReason ?? t('outputOptions.needed')} />
            ) : null}

            <View style={styles.buttonRow}>
              <SecondaryButton icon="folder-plus-outline" onPress={() => void chooseFolder()}>
                {settings.customFolder ? t('outputOptions.changeFolder') : t('outputOptions.chooseFolder')}
              </SecondaryButton>
              {settings.saveDestinationMode !== 'default-accurate-folder' ? (
                <SecondaryButton
                  icon="folder-outline"
                  onPress={() =>
                    void updateSettings({
                      saveDestinationMode: 'default-accurate-folder',
                      useDefaultFolder: true
                    })
                  }
                >
                  {t('outputOptions.useDefaultFolder')}
                </SecondaryButton>
              ) : null}
              {settings.saveDestinationMode === 'default-accurate-folder' && !allFilesAccessGranted ? (
                <SecondaryButton icon="cog-outline" onPress={() => void openAllFilesAccessSettings()}>
                  {t('outputOptions.grantAccess')}
                </SecondaryButton>
              ) : null}
            </View>

            <ExpandableTechnicalDetails collapsedTitle={t('outputOptions.showFullPath')} expandedTitle={t('common.hideTechnicalDetails')}>
              <FilePathText value={outputRoot} maxLines={4} />
            </ExpandableTechnicalDetails>
          </PremiumCard>
        </Section>

        <Section title={t('outputOptions.organizationTitle')} icon="folder-multiple-outline">
          <View style={styles.modeList}>
            {organizationModes.map((mode) => (
              <OptionCard
                key={mode}
                title={t(`outputOptions.organizationModes.${mode}.title`)}
                description={t(`outputOptions.organizationModes.${mode}.body`)}
                selected={settings.outputOrganization.mode === mode}
                badge={mode === 'by-type' ? t('outputOptions.recommended') : undefined}
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
        </Section>

        <Section title={t('outputOptions.duplicateHandling')} icon="content-copy">
          <View style={styles.modeList}>
            {duplicateModes.map((mode) => (
              <OptionCard
                key={mode}
                title={t(`outputOptions.duplicateModes.${mode}.title`)}
                description={t(`outputOptions.duplicateModes.${mode}.body`)}
                selected={settings.outputOrganization.duplicateHandling === mode}
                caution={mode === 'replace-existing'}
                onPress={() =>
                  void updateSettings({
                    outputOrganization: {
                      ...settings.outputOrganization,
                      duplicateHandling: mode
                    }
                  })
                }
              />
            ))}
          </View>
        </Section>

        <Section title={t('outputOptions.advancedTitle')} icon="tune-variant">
          <ExpandableTechnicalDetails collapsedTitle={t('common.showTechnicalDetails')} expandedTitle={t('common.hideTechnicalDetails')}>
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
            {settings.saveDestinationMode === 'default-accurate-folder' ? (
              <StatusRow
                icon={allFilesAccessGranted ? 'shield-check-outline' : 'shield-alert-outline'}
                label={t('outputOptions.allFilesAccess')}
                value={checking ? t('outputOptions.checkingPermission') : allFilesAccessGranted ? t('outputOptions.granted') : t('outputOptions.needed')}
              />
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
            <Text variant="bodySmall" style={[textStyles.start, { color: theme.colors.onSurfaceVariant }]}>
              {getOrganizationSummaryText(t, settings.outputOrganization)}
            </Text>
            <FolderTreePreview paths={[outputRoot, ...previewPaths]} />
            <SecondaryButton onPress={() => void resetSaveLocation()}>
              {t('outputOptions.resetFolder')}
            </SecondaryButton>
          </ExpandableTechnicalDetails>
        </Section>

        <Section title={t('outputOptions.summaryTitle')} icon="clipboard-check-outline">
          <View style={styles.metricRow}>
            <SummaryMetricCard icon="check-circle-outline" label={t('outputOptions.selectedItems')} value={selectedCount} />
            <SummaryMetricCard icon="image-outline" label={t('outputOptions.photos')} value={preview.selectedPhotos} />
            <SummaryMetricCard icon="video-outline" label={t('outputOptions.videos')} value={preview.selectedVideos} />
            <SummaryMetricCard icon="file-outline" label={t('outputOptions.other')} value={preview.selectedOther} />
          </View>
          <StatusRow icon="folder-outline" label={t('outputOptions.destinationFriendly')} value={destinationName} />
          <StatusRow icon="folder-multiple-outline" label={t('outputOptions.organization')} value={t(`outputOptions.organizationModes.${settings.outputOrganization.mode}.title`)} />
          <StatusRow icon="content-copy" label={t('outputOptions.duplicateHandling')} value={t(`outputOptions.duplicateModes.${settings.outputOrganization.duplicateHandling}.title`)} />
        </Section>
      </ScrollView>
      <Snackbar visible={Boolean(snackbar)} onDismiss={() => setSnackbar(undefined)} duration={3200}>
        {snackbar}
      </Snackbar>
    </WizardScreen>
  );
}

function Section({ title, icon, children }: { title: string; icon: React.ComponentProps<typeof MaterialCommunityIcons>['name']; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <SectionHeader icon={icon} label={title} />
      <View style={styles.sectionBody}>{children}</View>
    </View>
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
  parts.push(t(`outputOptions.duplicateModes.${organization.duplicateHandling}.title`));
  return parts.join(' • ');
}

function getFriendlyFolderName(path: string): string {
  const normalized = path.replace(/\\/g, '/');
  return normalized.split('/').filter(Boolean).pop() ?? path;
}

function getSaveDisabledReason({
  selectedCount,
  checking,
  allFilesAccessGranted,
  customFolderSelected,
  hasCustomFolder,
  t
}: {
  selectedCount: number;
  checking: boolean;
  allFilesAccessGranted: boolean;
  customFolderSelected: boolean;
  hasCustomFolder: boolean;
  t: (key: string, options?: Record<string, unknown>) => string;
}): string | undefined {
  if (selectedCount === 0) return t('outputOptions.disabledNoSelection');
  if (customFolderSelected && !hasCustomFolder) return t('outputOptions.disabledChooseFolder');
  if (!customFolderSelected && checking) return t('outputOptions.disabledCheckingPermission');
  if (!customFolderSelected && !allFilesAccessGranted) return t('outputOptions.disabledPermission');
  return undefined;
}

const styles = StyleSheet.create({
  content: {
    gap: spacing.section,
    paddingBottom: 144
  },
  section: {
    gap: spacing.smallGap
  },
  sectionBody: {
    gap: spacing.gap
  },
  destinationHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.gap
  },
  destinationIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center'
  },
  strongText: {
    fontWeight: '800'
  },
  modeList: {
    gap: spacing.gap
  },
  treePreview: {
    gap: spacing.tinyGap,
    marginTop: spacing.smallGap
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
    gap: spacing.smallGap
  },
  metricRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.smallGap
  },
  flex: {
    flex: 1,
    minWidth: 0
  }
});
